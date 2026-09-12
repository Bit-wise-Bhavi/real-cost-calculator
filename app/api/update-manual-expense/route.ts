import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PATCH(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");

        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                },
                { status: 401 }
            );
        }

        const token = authHeader.replace("Bearer ", "");

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            }
        );

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                },
                { status: 401 }
            );
        }

        const body = await request.json();

        const {
            expense_id,
            amount,
            category,
            expense_date,
            description,
        } = body;

        if (!expense_id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Expense ID is required.",
                },
                { status: 400 }
            );
        }

        const parsedAmount = Number(amount);

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Amount must be greater than 0.",
                },
                { status: 400 }
            );
        }

        if (!category || typeof category !== "string") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Category is required.",
                },
                { status: 400 }
            );
        }

        if (
            !expense_date ||
            !/^\d{4}-\d{2}-\d{2}$/.test(expense_date)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "A valid expense date is required.",
                },
                { status: 400 }
            );
        }

        // Make sure the expense belongs to this user
        // AND is actually a manual/Kaccha Bill expense.
        const { data: existingExpense, error: existingError } =
            await supabase
                .from("expenses")
                .select("id, source")
                .eq("id", expense_id)
                .eq("user_id", user.id)
                .single();

        if (existingError || !existingExpense) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Expense not found.",
                },
                { status: 404 }
            );
        }

        if (existingExpense.source !== "manual") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Only Kaccha Bills can be edited.",
                },
                { status: 403 }
            );
        }

        const { error: updateError } = await supabase
            .from("expenses")
            .update({
                amount: parsedAmount,
                category: category.trim(),
                expense_date,
                description:
                    typeof description === "string"
                        ? description.trim()
                        : null,
            })
            .eq("id", expense_id)
            .eq("user_id", user.id)
            .eq("source", "manual");

        if (updateError) {
            console.error("Manual expense update error:", updateError);

            return NextResponse.json(
                {
                    success: false,
                    error: "Failed to update expense.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Kaccha Bill updated successfully.",
        });
    } catch (error) {
        console.error("Update manual expense error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Something went wrong.",
            },
            { status: 500 }
        );
    }
}