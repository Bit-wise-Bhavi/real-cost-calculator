"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  PenLine,
  Receipt,
  Trash2,
} from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase-browser";

type Expense = {
  id: string;
  user_id: string;
  source: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  expense_date: string | null;
  description: string | null;

  invoice_number: string | null;
  vendor_name: string | null;
  purchase_type: string | null;

  bill_data: any;
  validation_data: any;

  created_at: string | null;
};

type ExpenseItem = {
  id: string;
  expense_id: string;
  item_name: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  line_total: number | null;
  tax_data: any;
};

const categories = [
  "Food & Dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Electronics",
  "Clothing",
  "Health",
  "Entertainment",
  "Bills & Utilities",
  "Education",
  "Travel",
  "Home",
  "Personal Care",
  "Services",
  "Other",
  "Uncategorized",
];

function formatMoney(
  value: number | null | undefined,
  currency = "INR"
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `₹${Number(value).toFixed(2)}`;
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}


function calculateStoredBillValidation(
  billData: any
) {
  if (!billData || !Array.isArray(billData.items)) {
    return null;
  }

  const items = billData.items;

  if (items.length === 0) {
    return null;
  }

  const hasAllTaxableValues = items.every(
    (item: any) =>
      typeof item?.taxable_value === "number" &&
      Number.isFinite(item.taxable_value)
  );

  const hasAllLineTotals = items.every(
    (item: any) =>
      typeof item?.line_total === "number" &&
      Number.isFinite(item.line_total)
  );

  const calculatedItemBase = hasAllTaxableValues
    ? Number(
        items
          .reduce(
            (sum: number, item: any) =>
              sum + item.taxable_value,
            0
          )
          .toFixed(2)
      )
    : hasAllLineTotals
      ? Number(
          items
            .reduce(
              (sum: number, item: any) =>
                sum + item.line_total,
              0
            )
            .toFixed(2)
        )
      : null;

  function calculateTaxComponent(
    item: any,
    rateKey: string,
    amountKey: string
  ) {
    const taxableValue =
      typeof item?.taxable_value === "number" &&
      Number.isFinite(item.taxable_value)
        ? item.taxable_value
        : null;

    const rate =
      typeof item?.[rateKey] === "number" &&
      Number.isFinite(item[rateKey])
        ? item[rateKey]
        : null;

    const printedAmount =
      typeof item?.[amountKey] === "number" &&
      Number.isFinite(item[amountKey])
        ? item[amountKey]
        : null;

    if (taxableValue !== null && rate !== null) {
      return taxableValue * (rate / 100);
    }

    return printedAmount;
  }

  function sumTax(
    rateKey: string,
    amountKey: string
  ) {
    return Number(
      items
        .map((item: any) =>
          calculateTaxComponent(
            item,
            rateKey,
            amountKey
          )
        )
        .filter(
          (value: any) =>
            typeof value === "number" &&
            Number.isFinite(value)
        )
        .reduce(
          (sum: number, value: number) =>
            sum + value,
          0
        )
        .toFixed(2)
    );
  }

  const calculatedCGST = sumTax(
    "cgst_rate",
    "cgst_amount"
  );

  const calculatedSGST = sumTax(
    "sgst_rate",
    "sgst_amount"
  );

  const calculatedIGST = sumTax(
    "igst_rate",
    "igst_amount"
  );

  const calculatedCess = sumTax(
    "cess_rate",
    "cess_amount"
  );

  const calculatedTax = Number(
    (
      calculatedCGST +
      calculatedSGST +
      calculatedIGST +
      calculatedCess
    ).toFixed(2)
  );

  const reportedTotal =
    typeof billData?.totals?.total_invoice_value ===
    "number"
      ? billData.totals.total_invoice_value
      : null;

  const otherCharges =
    typeof billData?.totals?.total_other_charges ===
    "number"
      ? billData.totals.total_other_charges
      : 0;

  const roundOff =
    typeof billData?.totals?.round_off === "number"
      ? billData.totals.round_off
      : 0;

  const calculatedInvoiceTotal =
    calculatedItemBase !== null
      ? Number(
          (
            calculatedItemBase +
            calculatedTax +
            otherCharges +
            roundOff
          ).toFixed(2)
        )
      : null;

  const difference =
    calculatedInvoiceTotal !== null &&
    reportedTotal !== null
      ? Number(
          (
            reportedTotal -
            calculatedInvoiceTotal
          ).toFixed(2)
        )
      : null;

  return {
    calculated_item_total:
      calculatedInvoiceTotal,
    calculated_cgst: calculatedCGST,
    calculated_sgst: calculatedSGST,
    calculated_igst: calculatedIGST,
    calculated_cess: calculatedCess,
    calculated_tax_total: calculatedTax,
    reported_invoice_total: reportedTotal,
    difference_between_item_totals_and_invoice_total:
      difference,
    status:
      difference === null
        ? "insufficient_data"
        : difference === 0
          ? "matched"
          : "difference_found",
  };
}

export default function ExpenseDetails() {
  const params = useParams();
  const router = useRouter();

  const expenseId =
    typeof params?.id === "string"
      ? params.id
      : null;

  const [expense, setExpense] =
    useState<Expense | null>(null);

  const [items, setItems] =
    useState<ExpenseItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [deleting, setDeleting] =
    useState(false);

  // ==================================================
  // EDIT STATE
  // ==================================================

  const [isEditing, setIsEditing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [editAmount, setEditAmount] =
    useState("");

  const [editCategory, setEditCategory] =
    useState("");

  const [editDate, setEditDate] =
    useState("");

  const [editDescription, setEditDescription] =
    useState("");

  // ==================================================
  // LOAD EXPENSE
  // ==================================================

  useEffect(() => {
    async function loadExpense() {
      if (!expenseId) {
        setError("Invalid expense ID.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabaseBrowser.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "Please sign in to view this expense."
          );
        }

        // ============================================
        // EXPENSE
        // ============================================

        const {
          data: expenseData,
          error: expenseError,
        } =
          await supabaseBrowser
            .from("expenses")
            .select(
              `
                id,
                user_id,
                source,
                amount,
                currency,
                category,
                expense_date,
                description,
                invoice_number,
                vendor_name,
                purchase_type,
                bill_data,
                validation_data,
                created_at
              `
            )
            .eq("id", expenseId)
            .eq("user_id", user.id)
            .single();

        if (expenseError) {
          throw new Error(
            expenseError.message
          );
        }

        if (!expenseData) {
          throw new Error(
            "Expense not found."
          );
        }

        const loadedExpense =
          expenseData as Expense;

        setExpense(loadedExpense);

        // Populate edit fields
        setEditAmount(
          loadedExpense.amount !== null
            ? String(loadedExpense.amount)
            : ""
        );

        setEditCategory(
          loadedExpense.category || ""
        );

        setEditDate(
          loadedExpense.expense_date || ""
        );

        setEditDescription(
          loadedExpense.description || ""
        );

        // ============================================
        // ITEMS
        // ============================================

        const {
          data: itemData,
          error: itemError,
        } =
          await supabaseBrowser
            .from("expense_items")
            .select(
              `
                id,
                expense_id,
                item_name,
                quantity,
                unit,
                unit_price,
                line_total,
                tax_data
              `
            )
            .eq(
              "expense_id",
              expenseId
            )
            .order("id", {
              ascending: true,
            });

        if (itemError) {
          throw new Error(
            itemError.message
          );
        }

        setItems(
          (itemData || []) as ExpenseItem[]
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load expense."
        );
      } finally {
        setLoading(false);
      }
    }

    loadExpense();
  }, [expenseId]);

  // ==================================================
  // START EDITING
  // ==================================================

  function handleStartEdit() {
    if (!expense) {
      return;
    }

    // Extra client-side protection.
    // Only manual/Kaccha Bills can be edited.
    if (expense.source !== "manual") {
      return;
    }

    setEditAmount(
      expense.amount !== null
        ? String(expense.amount)
        : ""
    );

    setEditCategory(
      expense.category || ""
    );

    setEditDate(
      expense.expense_date || ""
    );

    setEditDescription(
      expense.description || ""
    );

    setError(null);
    setIsEditing(true);
  }

  // ==================================================
  // CANCEL EDIT
  // ==================================================

  function handleCancelEdit() {
    if (!expense) {
      return;
    }

    setEditAmount(
      expense.amount !== null
        ? String(expense.amount)
        : ""
    );

    setEditCategory(
      expense.category || ""
    );

    setEditDate(
      expense.expense_date || ""
    );

    setEditDescription(
      expense.description || ""
    );

    setError(null);
    setIsEditing(false);
  }

  // ==================================================
  // SAVE EDIT
  // ==================================================

  async function handleSaveChanges() {
    if (!expense) {
      return;
    }

    // Extra client-side protection.
    if (expense.source !== "manual") {
      setError(
        "Only Kaccha Bills can be edited."
      );
      return;
    }

    const amount = Number(
      editAmount
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Amount must be greater than 0."
      );
      return;
    }

    if (!editCategory.trim()) {
      setError(
        "Please select a category."
      );
      return;
    }

    if (
      !editDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        editDate
      )
    ) {
      setError(
        "Please select a valid date."
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        data: { session },
      } =
        await supabaseBrowser.auth.getSession();

      if (!session) {
        throw new Error(
          "Please sign in again."
        );
      }

      const response =
        await fetch(
          "/api/update-manual-expense",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              expense_id:
                expense.id,
              amount,
              category:
                editCategory.trim(),
              expense_date:
                editDate,
              description:
                editDescription.trim(),
            }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
          "Failed to update expense."
        );
      }

      // Update displayed expense
      // without creating a new record.
      setExpense({
        ...expense,
        amount,
        category:
          editCategory.trim(),
        expense_date:
          editDate,
        description:
          editDescription.trim() || null,
      });

      setIsEditing(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update expense."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // DELETE
  // ==================================================

  async function handleDelete() {
    if (!expenseId) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this expense permanently?"
      );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabaseBrowser.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Please sign in again."
        );
      }

      // Delete items first
      const {
        error: itemDeleteError,
      } =
        await supabaseBrowser
          .from("expense_items")
          .delete()
          .eq(
            "expense_id",
            expenseId
          );

      if (itemDeleteError) {
        throw new Error(
          itemDeleteError.message
        );
      }

      // Delete expense
      const {
        error: expenseDeleteError,
      } =
        await supabaseBrowser
          .from("expenses")
          .delete()
          .eq(
            "id",
            expenseId
          )
          .eq(
            "user_id",
            user.id
          );

      if (expenseDeleteError) {
        throw new Error(
          expenseDeleteError.message
        );
      }

      router.push(
        "/history"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete expense."
      );

      setDeleting(false);
    }
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <Loader2
              size={30}
              className="mx-auto animate-spin text-slate-600"
            />

            <p className="mt-4 text-sm font-medium text-slate-600">
              Loading expense...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ==================================================
  // ERROR
  // ==================================================

  if (error || !expense) {
    return (
      <main className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center px-6 py-5">
            <Link
              href="/history"
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              <ArrowLeft
                size={17}
              />
              Expense History
            </Link>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle
                size={20}
                className="mt-0.5 shrink-0 text-red-600"
              />

              <div>
                <h2 className="font-semibold text-red-800">
                  Could not load expense
                </h2>

                <p className="mt-1 text-sm text-red-700">
                  {error ||
                    "Expense not found."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const currency =
    expense.currency ||
    "INR";

  const isManual =
    expense.source ===
    "manual";

  const billData =
    expense.bill_data;

  // Recalculate scanned-bill reconciliation from the original
  // saved bill data so old history records are not stuck with a
  // stale validation result from an earlier calculation rule.
  // This is display/verification only; the stored expense amount
  // is never changed.
  const validationData =
    !isManual
      ? calculateStoredBillValidation(
          billData
        ) || expense.validation_data
      : expense.validation_data;

  // For scanned bills, display the date printed on the bill.
  // Fall back to the stored expense date only when the bill
  // does not contain a valid invoice date.
  const displayDate =
    !isManual &&
    typeof billData?.invoice?.invoice_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      billData.invoice.invoice_date
    )
      ? billData.invoice.invoice_date
      : expense.expense_date;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">

          <Link
            href="/history"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft
              size={17}
            />

            Expense History
          </Link>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">

            {/* EDIT — KACCHA BILL ONLY */}

            {isManual && (
              <button
                type="button"
                onClick={
                  handleStartEdit
                }
                disabled={
                  deleting ||
                  saving
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-4"
              >
                <PenLine
                  size={16}
                />

                Edit Expense
              </button>
            )}

            {/* DELETE */}

            <button
              type="button"
              onClick={
                handleDelete
              }
              disabled={
                deleting ||
                saving
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-4"
            >
              {deleting ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Trash2
                  size={16}
                />
              )}

              Delete
            </button>

          </div>

        </div>
      </header>

      {/* ==================================================
          MAIN
      ================================================== */}

      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">

        {/* ==================================================
            HERO
        ================================================== */}

        <section className="mb-8">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

            <div>

              <div className="mb-3 flex flex-wrap items-center gap-2">

                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">

                  {isManual ? (
                    <PenLine
                      size={13}
                    />
                  ) : (
                    <Receipt
                      size={13}
                    />
                  )}

                  {isManual
                    ? "Kaccha Bill"
                    : "Scanned Bill"}

                </span>

                {expense.category && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {expense.category}
                  </span>
                )}

              </div>

              <h1 className="max-w-full break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {expense.vendor_name ||
                  expense.description ||
                  (isManual
                    ? "Manual Expense"
                    : "Bill Expense")}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                {formatDate(
                  displayDate
                )}
              </p>

            </div>

            <div className="w-full min-w-0 text-left sm:w-auto sm:text-right">

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Total
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-950">
                {formatMoney(
                  expense.amount,
                  currency
                )}
              </p>

            </div>

          </div>

        </section>

        {/* ==================================================
            ERROR
        ================================================== */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span>
              {error}
            </span>

          </div>
        )}

        {/* ==================================================
            EDIT KACCHA BILL
        ================================================== */}

        {isEditing && isManual && (
          <section className="mb-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

            <div className="mb-6 flex items-start gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <PenLine
                  size={20}
                  className="text-slate-600"
                />
              </div>

              <div>
                <h2 className="text-lg font-semibold">
                  Edit Kaccha Bill
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Update the details of this manually recorded expense.
                </p>
              </div>

            </div>

            <div className="grid gap-5 sm:grid-cols-2">

              {/* AMOUNT */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Amount
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      editAmount
                    }
                    onChange={(e) =>
                      setEditAmount(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* CATEGORY */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Category
                </label>

                <select
                  value={
                    editCategory
                  }
                  onChange={(e) =>
                    setEditCategory(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="">
                    Select category
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={
                          category
                        }
                        value={
                          category
                        }
                      >
                        {category}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* DATE */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Date
                </label>

                <div className="relative">
                  <CalendarDays
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="date"
                    value={
                      editDate
                    }
                    onChange={(e) =>
                      setEditDate(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>

              {/* DESCRIPTION */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  value={
                    editDescription
                  }
                  onChange={(e) =>
                    setEditDescription(
                      e.target.value
                    )
                  }
                  rows={1}
                  placeholder="Optional description"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

            </div>

            {/* EDIT ACTIONS */}

            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">

              <button
                type="button"
                onClick={
                  handleCancelEdit
                }
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  handleSaveChanges
                }
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                )}

                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>

          </section>
        )}

        {/* ==================================================
            BASIC INFORMATION
        ================================================== */}

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          <div className="mb-5 flex items-center gap-3">

            <FileText
              size={20}
              className="text-slate-600"
            />

            <h2 className="text-lg font-semibold">
              Expense Information
            </h2>

          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

            <Info
              label="Amount"
              value={formatMoney(
                expense.amount,
                currency
              )}
            />

            <Info
              label="Category"
              value={
                expense.category
              }
            />

            <Info
              label="Date"
              value={formatDate(
                displayDate
              )}
            />

            <Info
              label="Source"
              value={
                isManual
                  ? "Kaccha Bill"
                  : "Scanned Bill"
              }
            />

            <Info
              label="Vendor"
              value={
                expense.vendor_name
              }
            />

            <Info
              label="Invoice Number"
              value={
                expense.invoice_number
              }
            />

            <Info
              label="Purchase Type"
              value={
                expense.purchase_type
              }
            />

            <Info
              label="Currency"
              value={
                expense.currency
              }
            />

          </div>

          {expense.description && (
            <div className="mt-6 border-t border-slate-100 pt-5">

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Description
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                {expense.description}
              </p>

            </div>
          )}

        </section>

        {/* ==================================================
            MANUAL EXPENSE
        ================================================== */}

        {isManual && (
          <section className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

            <div className="flex items-start gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">

                <PenLine
                  size={20}
                  className="text-slate-600"
                />

              </div>

              <div>

                <h2 className="text-lg font-semibold">
                  Kaccha Bill Expense
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This expense was manually
                  recorded because there was no
                  bill or receipt to scan.
                </p>

              </div>

            </div>

          </section>
        )}

        {/* ==================================================
            BILL ITEMS
        ================================================== */}

        {!isManual &&
          items.length > 0 && (
            <section className="mt-6">

              <div className="mb-4">

                <h2 className="text-xl font-bold">
                  Purchased Items
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Items captured from the original bill.
                </p>

              </div>

              <div className="space-y-4">

                {items.map(
                  (item) => (

                    <div
                      key={
                        item.id
                      }
                      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
                    >

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                        <div>

                          <h3 className="break-words text-lg font-semibold">
                            {item.item_name ||
                              "Unnamed Item"}
                          </h3>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs">

                            {item.quantity !==
                              null && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">

                                  Qty:{" "}
                                  {
                                    item.quantity
                                  }

                                  {item.unit
                                    ? ` ${item.unit}`
                                    : ""}

                                </span>
                              )}

                          </div>

                        </div>

                        <div className="w-full min-w-0 text-left sm:w-auto sm:text-right">

                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            Line Total
                          </p>

                          <p className="mt-1 text-xl font-bold">
                            {formatMoney(
                              item.line_total,
                              currency
                            )}
                          </p>

                        </div>

                      </div>

                      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">

                        <Info
                          label="Unit Price"
                          value={formatMoney(
                            item.unit_price,
                            currency
                          )}
                        />

                        <Info
                          label="Line Total"
                          value={formatMoney(
                            item.line_total,
                            currency
                          )}
                        />

                      </div>

                    </div>

                  )
                )}

              </div>

            </section>
          )}

        {/* ==================================================
            BILL TOTALS
        ================================================== */}

        {!isManual &&
          billData?.totals && (
            <section className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

              <h2 className="mb-5 text-lg font-semibold">
                Bill Totals
              </h2>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                <MoneyInfo
                  label="Gross Amount"
                  value={
                    billData.totals
                      .total_gross_amount
                  }
                  currency={
                    currency
                  }
                />

                <MoneyInfo
                  label="Discount"
                  value={
                    billData.totals
                      .total_discount
                  }
                  currency={
                    currency
                  }
                />

                <MoneyInfo
                  label="Taxable Value"
                  value={
                    billData.totals
                      .total_taxable_value
                  }
                  currency={
                    currency
                  }
                />

                <MoneyInfo
                  label="CGST"
                  value={
                    billData.totals
                      .total_cgst
                  }
                  currency={
                    currency
                  }
                />

                <MoneyInfo
                  label="SGST"
                  value={
                    billData.totals
                      .total_sgst
                  }
                  currency={
                    currency
                  }
                />

                <MoneyInfo
                  label="IGST"
                  value={
                    billData.totals
                      .total_igst
                  }
                  currency={
                    currency
                  }
                />

                <MoneyInfo
                  label="Cess"
                  value={
                    billData.totals
                      .total_cess
                  }
                  currency={
                    currency
                  }
                />

                <MoneyInfo
                  label="Other Charges"
                  value={
                    billData.totals
                      .total_other_charges
                  }
                  currency={
                    currency
                  }
                />

              </div>

              <div className="mt-6 rounded-xl bg-slate-950 p-5 text-white">

                <p className="text-sm text-slate-400">
                  Printed Invoice Total
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {formatMoney(
                    billData.totals
                      .total_invoice_value,
                    currency
                  )}
                </p>

              </div>

            </section>
          )}

        {/* ==================================================
            VALIDATION
        ================================================== */}

        {!isManual &&
          validationData && (
            <section className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

              <div className="mb-5">

                <h2 className="text-lg font-semibold">
                  Invoice Validation
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Recalculated from the original bill data. The stored expense amount is not changed.
                </p>

              </div>

              <div className="grid gap-4 sm:grid-cols-3">

                <MoneyInfo
                  label="Calculated Invoice Total"
                  value={
                    validationData.calculated_item_total
                  }
                  currency={
                    currency
                  }
                />

                <MoneyInfo
                  label="Printed Invoice Total"
                  value={
                    validationData.reported_invoice_total
                  }
                  currency={
                    currency
                  }
                />

                <MoneyInfo
                  label="Difference"
                  value={
                    validationData.difference_between_item_totals_and_invoice_total
                  }
                  currency={
                    currency
                  }
                />

              </div>

              <div className="mt-5">

                {validationData.status ===
                  "matched" && (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">

                      <CheckCircle2
                        size={17}
                      />

                      Invoice values reconciled successfully.

                    </div>
                  )}

                {validationData.status ===
                  "difference_found" && (
                    <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">

                      There was a difference between
                      the calculated and printed totals.

                    </div>
                  )}

                {validationData.status ===
                  "insufficient_data" && (
                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">

                      There was not enough information
                      for complete reconciliation.

                    </div>
                  )}

              </div>

            </section>
          )}

        {/* ==================================================
            BACK
        ================================================== */}

        <div className="mt-8 w-full">

          <Link
            href="/history"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
          >

            <ArrowLeft
              size={16}
            />

            Back to Expense History

          </Link>

        </div>

      </div>

    </main>
  );
}

/* ==================================================
   INFO
================================================== */

function Info({
  label,
  value,
}: {
  label: string;
  value:
  | string
  | number
  | null
  | undefined;
}) {
  return (
    <div>

      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value === null ||
          value === undefined ||
          value === ""
          ? "—"
          : String(value)}
      </p>

    </div>
  );
}

/* ==================================================
   MONEY INFO
================================================== */

function MoneyInfo({
  label,
  value,
  currency,
}: {
  label: string;
  value:
  | number
  | null
  | undefined;
  currency: string;
}) {
  return (
    <Info
      label={label}
      value={formatMoney(
        value,
        currency
      )}
    />
  );
}