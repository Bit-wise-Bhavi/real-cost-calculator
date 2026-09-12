import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const supabase =
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        }
      );

    // ============================================
    // GET AUTHENTICATED USER
    // ============================================

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired session.",
        },
        { status: 401 }
      );
    }

    // ============================================
    // READ REQUEST
    // ============================================

    const body =
      await request.json();

    const amount = body?.amount;
    const category = body?.category;
    const expenseDate =
      body?.expense_date;
    const description =
      body?.description;

    // ============================================
    // VALIDATE AMOUNT
    // ============================================

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please enter a valid amount.",
        },
        { status: 400 }
      );
    }

    // ============================================
    // VALIDATE CATEGORY
    // ============================================

    if (
      typeof category !== "string" ||
      category.trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please select a category.",
        },
        { status: 400 }
      );
    }

    // ============================================
    // VALIDATE DATE
    // ============================================

    const finalDate =
      typeof expenseDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(
        expenseDate
      )
        ? expenseDate
        : new Date()
            .toISOString()
            .slice(0, 10);

    // ============================================
    // SAVE MANUAL EXPENSE
    // ============================================

    const {
      data: expense,
      error: expenseError,
    } =
      await supabase
        .from("expenses")
        .insert({
          user_id: user.id,

          source: "manual",

          amount,

          currency: "INR",

          category:
            category.trim(),

          expense_date:
            finalDate,

          description:
            typeof description ===
              "string" &&
            description.trim() !== ""
              ? description.trim()
              : null,

          invoice_number: null,

          vendor_name: null,

          purchase_type:
            "unknown",

          bill_data: null,

          validation_data: null,
        })
        .select()
        .single();

    // ============================================
    // HANDLE DATABASE ERROR
    // ============================================

    if (
      expenseError ||
      !expense
    ) {
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
    // SUCCESS
    // ============================================

    return NextResponse.json({
      success: true,

      message:
        "Manual expense saved successfully.",

      expense_id:
        expense.id,
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