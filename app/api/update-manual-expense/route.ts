import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PATCH(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");

        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
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
                { success: false, error: "Unauthorized" },
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

        if (typeof expense_id !== "string" || expense_id.trim() === "") {
            return NextResponse.json(
                { success: false, error: "Expense ID is required." },
                { status: 400 }
            );
        }

        const parsedAmount = Number(amount);

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return NextResponse.json(
                { success: false, error: "Amount must be greater than 0." },
                { status: 400 }
            );
        }

        if (typeof category !== "string" || category.trim() === "") {
            return NextResponse.json(
                { success: false, error: "Category is required." },
                { status: 400 }
            );
        }

        if (
            typeof expense_date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(expense_date)
        ) {
            return NextResponse.json(
                { success: false, error: "A valid expense date is required." },
                { status: 400 }
            );
        }

        const { data: updatedBalance, error: updateError } =
            await supabase.rpc("update_manual_expense", {
                p_expense_id: expense_id.trim(),
                p_amount: parsedAmount,
                p_category: category.trim(),
                p_expense_date: expense_date,
                p_description:
                    typeof description === "string" && description.trim() !== ""
                        ? description.trim()
                        : null,
            });

        if (updateError) {
            console.error("Manual expense update error:", updateError);

            const message = updateError.message || "Failed to update expense.";

            if (message.includes("Expense not found")) {
                return NextResponse.json(
                    { success: false, error: "Expense not found." },
                    { status: 404 }
                );
            }

            if (message.includes("Only Kaccha Bills")) {
                return NextResponse.json(
                    { success: false, error: "Only Kaccha Bills can be edited." },
                    { status: 403 }
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    error: message.includes("current balance") ||
                        message.includes("current balance")
                        ? message
                        : "Failed to update expense.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Kaccha Bill updated successfully.",
            balance:
                updatedBalance === null || updatedBalance === undefined
                    ? null
                    : Number(updatedBalance),
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
