import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

// ==================================================
// CATEGORY INFERENCE
// ==================================================

function inferCategory(
  bill: any
): string {
  // ----------------------------------------------
  // 1. TRUST CATEGORY PROVIDED BY GEMINI
  // ----------------------------------------------

  if (Array.isArray(bill?.items)) {
    const aiCategory = bill.items.find(
      (item: any) =>
        typeof item?.category === "string" &&
        item.category.trim() !== ""
    )?.category;

    if (aiCategory) {
      return aiCategory.trim();
    }
  }

  // ----------------------------------------------
  // 2. BUILD TEXT FROM SUPPLIER + ITEM NAMES
  // ----------------------------------------------

  const supplier =
    typeof bill?.invoice?.supplier_name === "string"
      ? bill.invoice.supplier_name
      : "";

  const itemNames = Array.isArray(bill?.items)
    ? bill.items
        .map((item: any) =>
          typeof item?.name === "string"
            ? item.name
            : ""
        )
        .join(" ")
    : "";

  const text =
    `${supplier} ${itemNames}`.toLowerCase();

  // ----------------------------------------------
  // 3. FOOD & DINING
  // ----------------------------------------------

  if (
    /bakery|cake|bread|biscuit|cookie|restaurant|cafe|coffee|tea|pizza|burger|food|snack|sweet|mithai|juice|drink|beverage|grocery|groceries|supermarket|milk|dairy/.test(
      text
    )
  ) {
    return "Food & Dining";
  }

  // ----------------------------------------------
  // 4. ELECTRONICS
  // ----------------------------------------------

  if (
    /laptop|computer|pc|desktop|monitor|keyboard|mouse|gpu|graphic card|graphics card|motherboard|processor|cpu|ram|ssd|hdd|cabinet|printer|router|charger|headphone|earphone|speaker|electronic|electronics/.test(
      text
    )
  ) {
    return "Electronics";
  }

  // ----------------------------------------------
  // 5. CLOTHING
  // ----------------------------------------------

  if (
    /shirt|tshirt|t-shirt|jeans|pant|trouser|dress|jacket|shoe|shoes|sandal|slipper|clothing|clothes|apparel|fashion/.test(
      text
    )
  ) {
    return "Clothing";
  }

  // ----------------------------------------------
  // 6. TRANSPORT
  // ----------------------------------------------

  if (
    /petrol|diesel|fuel|gasoline|parking|uber|ola|rapido|taxi|cab|metro|bus|transport|vehicle|car|bike|automobile/.test(
      text
    )
  ) {
    return "Transport";
  }

  // ----------------------------------------------
  // 7. HEALTH
  // ----------------------------------------------

  if (
    /pharmacy|medicine|medicines|medical|hospital|doctor|clinic|health|tablet|capsule|syrup|diagnostic|pathology/.test(
      text
    )
  ) {
    return "Health";
  }

  // ----------------------------------------------
  // 8. HOME
  // ----------------------------------------------

  if (
    /furniture|sofa|table|chair|bed|mattress|kitchen|utensil|cleaning|detergent|home appliance|appliance|household/.test(
      text
    )
  ) {
    return "Home";
  }

  // ----------------------------------------------
  // 9. ENTERTAINMENT
  // ----------------------------------------------

  if (
    /movie|cinema|netflix|spotify|game|gaming|concert|theatre|theater|entertainment/.test(
      text
    )
  ) {
    return "Entertainment";
  }

  // ----------------------------------------------
  // 10. EDUCATION
  // ----------------------------------------------

  if (
    /book|books|course|tuition|college|school|education|stationery|notebook|pen|exam/.test(
      text
    )
  ) {
    return "Education";
  }

  // ----------------------------------------------
  // 11. SERVICES
  // ----------------------------------------------

  if (
    /repair|service|maintenance|consulting|subscription|internet|broadband|hosting|software/.test(
      text
    )
  ) {
    return "Services";
  }

  // ----------------------------------------------
  // 12. FALLBACK
  // ----------------------------------------------

  return "Uncategorized";
}

// ==================================================
// POST
// ==================================================

export async function POST(request: Request) {
  try {
    // ============================================
    // AUTHORIZATION
    // ============================================

    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      authorization.replace("Bearer ", "");

    const authenticatedSupabase =
      createClient(
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

    // ============================================
    // GET USER
    // ============================================

    const {
      data: { user },
      error: userError,
    } =
      await authenticatedSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired session.",
        },
        { status: 401 }
      );
    }

    // ============================================
    // READ BODY
    // ============================================

    const body = await request.json();

    const bill = body?.bill;

    if (!bill) {
      return NextResponse.json(
        {
          success: false,
          error: "Bill data is required.",
        },
        { status: 400 }
      );
    }

    // ============================================
    // VALIDATE TOTAL
    // ============================================

    const total =
      bill?.totals?.total_invoice_value;

    if (
      typeof total !== "number" ||
      !Number.isFinite(total) ||
      total < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid invoice total is required before saving.",
        },
        { status: 400 }
      );
    }

    // ============================================
    // INVOICE DATE
    // ============================================

    const invoiceDate =
      typeof bill?.invoice?.invoice_date ===
        "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(
        bill.invoice.invoice_date
      )
        ? bill.invoice.invoice_date
        : new Date()
            .toISOString()
            .slice(0, 10);

    // ============================================
    // CATEGORY
    // ============================================

    const category =
      inferCategory(bill);

    console.log(
      "EXPENSE CATEGORY:",
      category
    );

    // ============================================
    // SAVE EXPENSE
    // ============================================

    const {
      data: expense,
      error: expenseError,
    } =
      await authenticatedSupabase
        .from("expenses")
        .insert({
          user_id: user.id,

          source: "bill",

          amount: total,

          currency:
            bill?.invoice?.currency ||
            "INR",

          category,

          expense_date: invoiceDate,

          description:
            bill?.invoice?.supplier_name ||
            "Bill purchase",

          invoice_number:
            bill?.invoice?.invoice_number ||
            null,

          vendor_name:
            bill?.invoice?.supplier_name ||
            null,

          purchase_type:
            bill?.purchase_type ||
            "unknown",

          bill_data: bill,

          validation_data:
            bill?.validation ||
            null,
        })
        .select()
        .single();

    if (expenseError || !expense) {
      return NextResponse.json(
        {
          success: false,
          error:
            expenseError?.message ||
            "Failed to save expense.",
        },
        { status: 500 }
      );
    }

    // ============================================
    // SAVE ITEMS
    // ============================================

    const items = Array.isArray(
      bill?.items
    )
      ? bill.items
      : [];

    if (items.length > 0) {
      const itemRows =
        items.map(
          (item: {
            name?: string | null;

            quantity?:
              | number
              | null;

            unit?:
              | string
              | null;

            unit_price?:
              | number
              | null;

            line_total?:
              | number
              | null;

            cgst_rate?:
              | number
              | null;

            cgst_amount?:
              | number
              | null;

            sgst_rate?:
              | number
              | null;

            sgst_amount?:
              | number
              | null;

            igst_rate?:
              | number
              | null;

            igst_amount?:
              | number
              | null;

            cess_rate?:
              | number
              | null;

            cess_amount?:
              | number
              | null;
          }) => ({
            expense_id:
              expense.id,

            item_name:
              item.name ||
              "Unnamed item",

            quantity:
              item.quantity ??
              null,

            unit:
              item.unit ??
              null,

            unit_price:
              item.unit_price ??
              null,

            line_total:
              item.line_total ??
              null,

            tax_data: {
              cgst_rate:
                item.cgst_rate ??
                null,

              cgst_amount:
                item.cgst_amount ??
                null,

              sgst_rate:
                item.sgst_rate ??
                null,

              sgst_amount:
                item.sgst_amount ??
                null,

              igst_rate:
                item.igst_rate ??
                null,

              igst_amount:
                item.igst_amount ??
                null,

              cess_rate:
                item.cess_rate ??
                null,

              cess_amount:
                item.cess_amount ??
                null,
            },
          })
        );

      // ==========================================
      // INSERT ITEMS
      // ==========================================

      const {
        error: itemsError,
      } =
        await authenticatedSupabase
          .from("expense_items")
          .insert(itemRows);

      if (itemsError) {
        // ----------------------------------------
        // REMOVE PARENT IF ITEMS FAIL
        // ----------------------------------------

        await authenticatedSupabase
          .from("expenses")
          .delete()
          .eq(
            "id",
            expense.id
          );

        return NextResponse.json(
          {
            success: false,
            error:
              itemsError.message,
          },
          { status: 500 }
        );
      }
    }

    // ============================================
    // SUCCESS
    // ============================================

    return NextResponse.json({
      success: true,

      message:
        "Expense saved successfully.",

      expense_id:
        expense.id,

      category,
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while saving the expense.",
      },
      { status: 500 }
    );
  }
}