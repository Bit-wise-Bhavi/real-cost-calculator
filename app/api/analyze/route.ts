import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const genAI =
  new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY!
  );

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function getSupabaseForRequest(request: Request) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authorization.slice(7).trim();

  if (!accessToken) {
    return null;
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

function isRateLimited(userId: string) {
  const now = Date.now();
  const current = rateLimitStore.get(userId);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  return false;
}

export async function POST(
  request: Request
) {
  try {
    // ==================================================
    // AUTHENTICATION
    // ==================================================

    const supabase =
      getSupabaseForRequest(request);

    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (isRateLimited(user.id)) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many analysis requests. Please try again in a minute.",
          error_code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        }
      );
    }

    // ==================================================
    // REQUEST SIZE LIMIT
    // ==================================================

    const contentLength = Number(
      request.headers.get("content-length") || 0
    );

    if (
      contentLength > 0 &&
      contentLength > MAX_REQUEST_BYTES
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Image request is too large. Please use an image smaller than 8 MB.",
        },
        { status: 413 }
      );
    }

    // ==================================================
    // GET IMAGE
    // ==================================================

    const body =
      await request.json();

    const { image } = body;

    if (typeof image !== "string" || !image) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No image provided.",
        },
        { status: 400 }
      );
    }

    const dataUrlMatch =
      image.match(
        /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/=]+)$/i
      );

    if (!dataUrlMatch) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid image format. Supported formats are JPEG, PNG, WebP, HEIC and HEIF.",
        },
        { status: 400 }
      );
    }

    const mimeType =
      dataUrlMatch[1].toLowerCase();
    const base64Data = dataUrlMatch[2];

    if (!allowedMimeTypes.has(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported image type.",
        },
        { status: 415 }
      );
    }

    const estimatedImageBytes =
      Math.floor(
        (base64Data.length * 3) / 4
      );

    if (estimatedImageBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "Image is too large. Please use an image smaller than 8 MB.",
        },
        { status: 413 }
      );
    }

    // ==================================================
    // GEMINI PROMPT
    // ==================================================

    const prompt = `
You are a highly accurate financial document
extraction system.

Analyze the provided image.

Your primary job is to determine whether this image
is a genuine bill, receipt, purchase invoice or tax
invoice and, if it is, extract the information that
is visibly present.

DO NOT invent information.

==================================================
STEP 1 — BILL DETECTION
==================================================

Determine whether the image is actually:

- a bill
- receipt
- tax invoice
- purchase invoice
- payment receipt

If it is NOT a bill, receipt or invoice, return ONLY:

{
  "is_bill": false,
  "confidence": 0,
  "reason": "Explain why this is not a bill."
}

Do not extract financial information from a non-bill.

Examples of non-bills:

- selfies
- normal photographs
- landscapes
- video game screenshots
- social media screenshots
- product photographs without purchase information
- unrelated documents
- random text/images

Do not classify an image as a bill merely because
it contains numbers.

==================================================
STEP 2 — EXACT EXTRACTION
==================================================

If the image IS a bill, extract only information that
is actually visible and reasonably readable.

Never invent:

- prices
- taxes
- GST rates
- HSN/SAC codes
- invoice numbers
- dates
- merchant names
- customer names
- quantities
- discounts
- totals
- warranty information

If a value is not visible or cannot be reliably read,
return null.

Do not silently correct the invoice.

Do not replace a printed value with a calculated value.

==================================================
STEP 3 — PURCHASE TYPE
==================================================

Choose exactly ONE:

"ownership"
"consumable"
"service"
"unknown"

OWNERSHIP:

A durable physical product that is normally kept
and used for an extended period.

Examples:

- laptop
- desktop
- monitor
- phone
- refrigerator
- washing machine
- AC
- furniture
- camera
- bicycle
- vehicle
- printer
- PC component
- appliance

CONSUMABLE:

Something primarily consumed or used up.

Examples:

- food
- groceries
- beverages
- disposable products
- cleaning supplies

SERVICE:

A service rather than ownership of a physical product.

Examples:

- repair service
- consultation
- salon service
- installation service
- software service

UNKNOWN:

Use when the purchase type cannot be reliably determined.

==================================================
STEP 4 — OUTPUT STRUCTURE
==================================================

Return exactly this JSON structure:

{
  "is_bill": true,
  "confidence": 0.0,
  "reason": null,

  "invoice": {
    "invoice_number": null,
    "invoice_date": null,
    "supplier_name": null,
    "supplier_gstin": null,
    "buyer_name": null,
    "buyer_gstin": null,
    "place_of_supply": null,
    "currency": null
  },

  "purchase_type": "unknown",

  "items": [
    {
      "name": null,
      "category": null,

      "hsn_sac": null,

      "quantity": null,
      "unit": null,

      "unit_price": null,

      "gross_amount": null,
      "discount": null,

      "taxable_value": null,

      "gst_rate": null,

      "cgst_rate": null,
      "cgst_amount": null,

      "sgst_rate": null,
      "sgst_amount": null,

      "igst_rate": null,
      "igst_amount": null,

      "cess_rate": null,
      "cess_amount": null,

      "other_charges": null,

      "line_total": null
    }
  ],

  "totals": {
    "total_gross_amount": null,
    "total_discount": null,
    "total_taxable_value": null,

    "total_cgst": null,
    "total_sgst": null,
    "total_igst": null,
    "total_cess": null,

    "total_other_charges": null,

    "round_off": null,

    "total_invoice_value": null,

    "amount_paid": null,
    "change": null,
    "amount_due": null
  },

  "warranty": null
}

==================================================
ITEM EXTRACTION
==================================================

Extract EVERY individual purchased item.

Never merge separate products.

For each item:

quantity =
printed quantity

unit_price =
printed unit price

gross_amount =
gross amount before discount/tax, if visible

discount =
item-level discount, if visible

taxable_value =
actual taxable value, if visible

line_total =
final item amount, if visible

If any value is not visible, return null.

==================================================
TAX EXTRACTION
==================================================

Taxes MUST remain separate.

Never combine:

CGST
SGST
IGST
Cess

into a generic tax field.

If the invoice shows:

CGST 9% = ₹100
SGST 9% = ₹100

return:

"cgst_rate": 9,
"cgst_amount": 100,
"sgst_rate": 9,
"sgst_amount": 100

Do NOT create a generic tax amount of ₹200.

If the invoice shows:

IGST 18% = ₹200

return:

"igst_rate": 18,
"igst_amount": 200

If Cess is shown, preserve it separately.

If multiple tax rates exist across different items,
preserve them at item level.

==================================================
INVOICE TOTALS
==================================================

Extract printed invoice totals separately.

If the invoice explicitly shows:

Taxable Value
CGST
SGST
Round Off
Total

extract each separately.

Do not calculate a missing invoice total and pretend
that the calculated value was printed.

==================================================
CONFIDENCE
==================================================

confidence should represent how confident you are that
the image is a bill and that the extracted document
information is reliable.

Use a number between:

0 and 1.

Examples:

0.95 = very clear invoice

0.80 = clearly an invoice but some fields are difficult

0.60 = likely invoice but image quality is poor

0.20 = probably not an invoice

==================================================
FINAL RULE
==================================================

Return ONLY valid JSON.

Do not use markdown.

Do not add explanations outside JSON.

Do not invent information.
`;

    // ==================================================
    // GEMINI MODEL
    // ==================================================

    const model =
      genAI.getGenerativeModel({
        model:
          "gemini-3.6-flash",

        generationConfig: {
          responseMimeType:
            "application/json",
        },
      });

    // ==================================================
    // GEMINI REQUEST
    // ==================================================

    const MAX_RETRIES = 3;

    let result: any = null;

    for (
      let attempt = 0;
      attempt <= MAX_RETRIES;
      attempt++
    ) {
      try {
        result =
          await model.generateContent([
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            prompt,
          ]);

        break;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : String(error);

        const lowerMessage =
          errorMessage.toLowerCase();

        // ==================================================
        // 429 — QUOTA / RATE LIMIT
        // ==================================================

        if (
          errorMessage.includes(
            "429"
          ) ||
          lowerMessage.includes(
            "too many requests"
          ) ||
          lowerMessage.includes(
            "quota exceeded"
          ) ||
          lowerMessage.includes(
            "rate limit"
          )
        ) {
          console.error(
            "Gemini quota/rate limit reached:",
            errorMessage
          );

          return NextResponse.json(
            {
              success: false,

              error:
                "Gemini API quota has been reached. Please wait for the quota to reset or use a Gemini API project with available quota.",

              error_code:
                "GEMINI_QUOTA_EXCEEDED",
            },
            { status: 429 }
          );
        }

        // ==================================================
        // 503 — TEMPORARY SERVER ERROR
        // ==================================================

        const isTemporaryServerError =
          errorMessage.includes(
            "503"
          ) ||
          lowerMessage.includes(
            "service unavailable"
          );

        if (
          !isTemporaryServerError ||
          attempt === MAX_RETRIES
        ) {
          throw error;
        }

        const delay =
          1000 *
          Math.pow(
            2,
            attempt
          );

        console.log(
          `Gemini temporarily unavailable. ` +
          `Retrying in ${delay / 1000
          }s... ` +
          `Attempt ${attempt + 1
          }/${MAX_RETRIES}`
        );

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              delay
            )
        );
      }
    }

    if (!result) {
      throw new Error(
        "Gemini analysis failed after multiple retries."
      );
    }

    // ==================================================
    // PARSE RESPONSE
    // ==================================================

    const rawText =
      result.response
        .text()
        .trim();

    let bill: any;

    try {
      bill =
        JSON.parse(
          rawText
        );
    } catch {
      console.error(
        "INVALID GEMINI JSON:",
        rawText
      );

      throw new Error(
        "Gemini returned invalid JSON."
      );
    }

    // ==================================================
    // BILL VALIDATION
    // ==================================================

    if (
      bill.is_bill !== true
    ) {
      return NextResponse.json(
        {
          success: false,

          is_bill: false,

          error:
            bill.reason ||
            "This image does not appear to be a bill or receipt.",
        },
        { status: 422 }
      );
    }

    // ==================================================
    // STRUCTURE SAFETY
    // ==================================================

    if (!bill.invoice) {
      bill.invoice = {};
    }

    if (
      !Array.isArray(
        bill.items
      )
    ) {
      bill.items = [];
    }

    if (!bill.totals) {
      bill.totals = {};
    }

    // ==================================================
    // ITEM NORMALIZATION
    // ==================================================

    bill.items =
      bill.items.map(
        (item: any) => {
          const quantity =
            typeof item.quantity ===
              "number" &&
              item.quantity > 0
              ? item.quantity
              : null;

          let unitPrice =
            typeof item.unit_price ===
              "number"
              ? item.unit_price
              : null;

          const lineTotal =
            typeof item.line_total ===
              "number"
              ? item.line_total
              : null;

          // ==================================================
          // DERIVE UNIT PRICE
          // ==================================================

          if (
            unitPrice ===
            null &&
            quantity !==
            null &&
            lineTotal !==
            null
          ) {
            unitPrice =
              Number(
                (
                  lineTotal /
                  quantity
                ).toFixed(
                  2
                )
              );
          }

          return {
            ...item,

            quantity,

            unit_price:
              unitPrice,

            line_total:
              lineTotal,
          };
        }
      );

    // ==================================================
    // ITEM TOTAL CALCULATION
    // ==================================================

    const lineTotals =
      bill.items
        .map(
          (item: any) =>
            item.line_total
        )
        .filter(
          (value: any) =>
            typeof value ===
            "number"
        );

    const calculatedItemTotal =
      lineTotals.length ===
        bill.items.length &&
        bill.items.length >
        0
        ? Number(
          lineTotals
            .reduce(
              (
                sum: number,
                value: number
              ) =>
                sum +
                value,
              0
            )
            .toFixed(2)
        )
        : null;

    // ==================================================
    // TAX CALCULATIONS
    // ==================================================

    const cgstValues =
      bill.items
        .map(
          (item: any) =>
            item.cgst_amount
        )
        .filter(
          (value: any) =>
            typeof value ===
            "number"
        );

    const sgstValues =
      bill.items
        .map(
          (item: any) =>
            item.sgst_amount
        )
        .filter(
          (value: any) =>
            typeof value ===
            "number"
        );

    const igstValues =
      bill.items
        .map(
          (item: any) =>
            item.igst_amount
        )
        .filter(
          (value: any) =>
            typeof value ===
            "number"
        );

    const cessValues =
      bill.items
        .map(
          (item: any) =>
            item.cess_amount
        )
        .filter(
          (value: any) =>
            typeof value ===
            "number"
        );

    const calculatedCGST =
      Number(
        cgstValues
          .reduce(
            (
              sum: number,
              value: number
            ) =>
              sum +
              value,
            0
          )
          .toFixed(2)
      );

    const calculatedSGST =
      Number(
        sgstValues
          .reduce(
            (
              sum: number,
              value: number
            ) =>
              sum +
              value,
            0
          )
          .toFixed(2)
      );

    const calculatedIGST =
      Number(
        igstValues
          .reduce(
            (
              sum: number,
              value: number
            ) =>
              sum +
              value,
            0
          )
          .toFixed(2)
      );

    const calculatedCess =
      Number(
        cessValues
          .reduce(
            (
              sum: number,
              value: number
            ) =>
              sum +
              value,
            0
          )
          .toFixed(2)
      );

    const calculatedTax =
      Number(
        (
          calculatedCGST +
          calculatedSGST +
          calculatedIGST +
          calculatedCess
        ).toFixed(2)
      );

    // ==================================================
    // PRINTED TOTAL
    // ==================================================

    const reportedTotal =
      typeof bill.totals
        .total_invoice_value ===
        "number"
        ? bill.totals
          .total_invoice_value
        : null;

    // ==================================================
    // RECONCILIATION
    // ==================================================

    let difference =
      null;

    if (
      calculatedItemTotal !==
      null &&
      reportedTotal !==
      null
    ) {
      difference =
        Number(
          (
            reportedTotal -
            calculatedItemTotal
          ).toFixed(2)
        );
    }

    // ==================================================
    // VALIDATION
    // ==================================================

    bill.validation = {
      calculated_item_total:
        calculatedItemTotal,

      calculated_cgst:
        calculatedCGST,

      calculated_sgst:
        calculatedSGST,

      calculated_igst:
        calculatedIGST,

      calculated_cess:
        calculatedCess,

      calculated_tax_total:
        calculatedTax,

      reported_invoice_total:
        reportedTotal,

      difference_between_item_totals_and_invoice_total:
        difference,

      status:
        difference ===
          null
          ? "insufficient_data"
          : Math.abs(
            difference
          ) < 0.01
            ? "matched"
            : "difference_found",
    };

    // ==================================================
    // FINAL RESPONSE
    // ==================================================

    return NextResponse.json({
      success: true,
      data: bill,
    });
  } catch (error) {
    console.error(
      "GEMINI ANALYZE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Unable to analyze the bill right now. Please try again.",
      },
      { status: 500 }
    );
  }
}