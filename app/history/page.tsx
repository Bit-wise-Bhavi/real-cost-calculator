"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Loader2,
  Receipt,
  Search,
  Wallet,
} from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase-browser";

type Expense = {
  id: string;
  source: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  expense_date: string | null;
  description: string | null;
  invoice_number: string | null;
  vendor_name: string | null;
  purchase_type: string | null;
  created_at: string | null;
};

const categories = [
  "All Categories",
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
    value === undefined
  ) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }
    ).format(value);
  } catch {
    return `₹${value.toFixed(2)}`;
  }
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Unknown date";
  }

  const date =
    new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function getSourceLabel(
  source: string | null
) {
  if (source === "manual") {
    return "Kaccha Bill";
  }

  if (source === "bill") {
    return "Bill";
  }

  return "Expense";
}

function getExpenseTitle(
  expense: Expense
) {
  if (
    expense.description &&
    expense.description.trim() !== ""
  ) {
    return expense.description;
  }

  if (
    expense.vendor_name &&
    expense.vendor_name.trim() !== ""
  ) {
    return expense.vendor_name;
  }

  if (
    expense.invoice_number &&
    expense.invoice_number.trim() !== ""
  ) {
    return `Invoice ${expense.invoice_number}`;
  }

  return getSourceLabel(
    expense.source
  );
}

export default function ExpenseHistory() {

  const router = useRouter();

  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState("All Categories");

  const [selectedSource, setSelectedSource] =
    useState("All Sources");

  // ==================================================
  // FETCH EXPENSES
  // ==================================================

  useEffect(() => {
    async function loadExpenses() {
      setLoading(true);
      setError(null);

      try {
        // ============================================
        // GET CURRENT SESSION
        // ============================================

        const {
          data: { session },
        } =
          await supabaseBrowser.auth.getSession();

        if (!session) {
          throw new Error(
            "Please sign in to view your expenses."
          );
        }

        // ============================================
        // FETCH USER'S EXPENSES
        // RLS ensures only the user's rows are returned
        // ============================================

        const {
          data,
          error: fetchError,
        } =
          await supabaseBrowser
            .from("expenses")
            .select(
              `
                id,
                source,
                amount,
                currency,
                category,
                expense_date,
                description,
                invoice_number,
                vendor_name,
                purchase_type,
                created_at
              `
            )
            .order(
              "expense_date",
              {
                ascending: false,
              }
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            );

        if (fetchError) {
          throw new Error(
            fetchError.message
          );
        }

        setExpenses(
          (data || []) as Expense[]
        );

      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load expenses."
        );
      } finally {
        setLoading(false);
      }
    }

    loadExpenses();
  }, []);

  // ==================================================
  // FILTER EXPENSES
  // ==================================================

  const filteredExpenses =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return expenses.filter(
        (expense) => {
          const matchesSearch =
            !query ||
            getExpenseTitle(
              expense
            )
              .toLowerCase()
              .includes(query) ||
            (
              expense.category ||
              ""
            )
              .toLowerCase()
              .includes(query) ||
            (
              expense.vendor_name ||
              ""
            )
              .toLowerCase()
              .includes(query);

          const matchesCategory =
            selectedCategory ===
            "All Categories" ||
            expense.category ===
            selectedCategory;

          const matchesSource =
            selectedSource ===
            "All Sources" ||
            (
              selectedSource ===
                "Kaccha Bill"
                ? expense.source ===
                "manual"
                : expense.source ===
                "bill"
            );

          return (
            matchesSearch &&
            matchesCategory &&
            matchesSource
          );
        }
      );
    }, [
      expenses,
      search,
      selectedCategory,
      selectedSource,
    ]);

  // ==================================================
  // TOTALS
  // ==================================================

  const totalSpent =
    useMemo(() => {
      return filteredExpenses.reduce(
        (total, expense) =>
          total +
          (Number(expense.amount) || 0),
        0
      );
    }, [filteredExpenses]);

  const billCount =
    useMemo(() => {
      return filteredExpenses.filter(
        (expense) =>
          expense.source === "bill"
      ).length;
    }, [filteredExpenses]);

  const manualCount =
    useMemo(() => {
      return filteredExpenses.filter(
        (expense) =>
          expense.source === "manual"
      ).length;
    }, [filteredExpenses]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">

              <Receipt size={21} />

            </div>

            <div>

              <h1 className="text-xl font-bold tracking-tight">
                Real Cost
              </h1>

              <p className="text-sm text-slate-500">
                Expense History
              </p>

            </div>

          </div>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >

            <ArrowLeft size={16} />

            Back

          </Link>

        </div>

      </header>

      {/* ==================================================
          MAIN
      ================================================== */}

      <div className="mx-auto max-w-6xl px-6 py-10">

        {/* ==================================================
            PAGE TITLE
        ================================================== */}

        <section className="mb-8">

          <h2 className="text-3xl font-bold tracking-tight text-slate-950">
            Your Spending
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Every bill and Kaccha Bill you've recorded.
          </p>

        </section>

        {/* ==================================================
            SUMMARY CARDS
        ================================================== */}

        {!loading && !error && (
          <section className="mb-8 grid gap-4 sm:grid-cols-3">

            {/* TOTAL */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Total Spent
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-950">

                    {formatMoney(
                      totalSpent
                    )}

                  </p>

                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">

                  <Wallet
                    size={19}
                    className="text-slate-700"
                  />

                </div>

              </div>

            </div>

            {/* EXPENSE COUNT */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Expenses
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-950">
                {filteredExpenses.length}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Recorded transactions
              </p>

            </div>

            {/* SOURCES */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Sources
              </p>

              <div className="mt-2 flex items-center gap-4">

                <div>

                  <p className="text-xl font-bold text-slate-950">
                    {billCount}
                  </p>

                  <p className="text-xs text-slate-500">
                    Bills
                  </p>

                </div>

                <div className="h-8 w-px bg-slate-200" />

                <div>

                  <p className="text-xl font-bold text-slate-950">
                    {manualCount}
                  </p>

                  <p className="text-xs text-slate-500">
                    Kaccha Bills
                  </p>

                </div>

              </div>

            </div>

          </section>
        )}

        {/* ==================================================
            FILTERS
        ================================================== */}

        {!loading && !error && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px]">

              {/* SEARCH */}

              <div className="relative">

                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search expenses..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />

              </div>

              {/* CATEGORY */}

              <div className="relative">

                <select
                  value={
                    selectedCategory
                  }
                  onChange={(e) =>
                    setSelectedCategory(
                      e.target.value
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >

                  {categories.map(
                    (category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    )
                  )}

                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

              </div>

              {/* SOURCE */}

              <div className="relative">

                <select
                  value={
                    selectedSource
                  }
                  onChange={(e) =>
                    setSelectedSource(
                      e.target.value
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >

                  <option value="All Sources">
                    All Sources
                  </option>

                  <option value="Bill">
                    Bills
                  </option>

                  <option value="Kaccha Bill">
                    Kacche Bills
                  </option>

                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

              </div>

            </div>

          </section>
        )}

        {/* ==================================================
            LOADING
        ================================================== */}

        {loading && (
          <section className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="text-center">

              <Loader2
                size={28}
                className="mx-auto animate-spin text-slate-600"
              />

              <p className="mt-4 text-sm font-medium text-slate-700">
                Loading your expenses...
              </p>

            </div>

          </section>
        )}

        {/* ==================================================
            ERROR
        ================================================== */}

        {!loading && error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-6">

            <p className="font-semibold text-red-800">
              Could not load expenses
            </p>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>

          </section>
        )}

        {/* ==================================================
            EMPTY STATE
        ================================================== */}

        {!loading &&
          !error &&
          expenses.length === 0 && (
            <section className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">

                <Receipt
                  size={28}
                  className="text-slate-500"
                />

              </div>

              <h3 className="mt-5 text-lg font-semibold">
                No expenses yet
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">

                Scan a bill or add a Kaccha Bill
                from the main page and your spending
                will appear here.

              </p>

              <Link
                href="/"
                className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Add Your First Expense
              </Link>

            </section>
          )}

        {/* ==================================================
            FILTERED EMPTY
        ================================================== */}

        {!loading &&
          !error &&
          expenses.length > 0 &&
          filteredExpenses.length === 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">

              <Search
                size={28}
                className="mx-auto text-slate-400"
              />

              <h3 className="mt-4 text-lg font-semibold">
                No matching expenses
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Try changing your search or filters.
              </p>

            </section>
          )}

        {/* ==================================================
            EXPENSE LIST
        ================================================== */}

        {!loading &&
          !error &&
          filteredExpenses.length > 0 && (
            <section>

              <div className="mb-4 flex items-center justify-between">

                <div>

                  <h3 className="text-xl font-bold">
                    Expense History
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {filteredExpenses.length} transaction
                    {filteredExpenses.length === 1
                      ? ""
                      : "s"}
                  </p>

                </div>

              </div>

              <div className="space-y-3">

                {filteredExpenses.map(
                  (expense) => (

                    <div
                      key={expense.id}
                      onClick={() => router.push(`/history/${expense.id}`)}
                      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                    >

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                        {/* LEFT */}

                        <div className="flex min-w-0 items-start gap-4">

                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">

                            {expense.source ===
                              "manual" ? (
                              <PenLineIcon />
                            ) : (
                              <Receipt
                                size={19}
                                className="text-slate-600"
                              />
                            )}

                          </div>

                          <div className="min-w-0">

                            <p className="truncate text-base font-semibold text-slate-900">

                              {getExpenseTitle(
                                expense
                              )}

                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2">

                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">

                                {expense.category ||
                                  "Uncategorized"}

                              </span>

                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">

                                {getSourceLabel(
                                  expense.source
                                )}

                              </span>

                            </div>

                          </div>

                        </div>

                        {/* RIGHT */}

                        <div className="shrink-0 sm:text-right">

                          <p className="text-xl font-bold text-slate-950">

                            {formatMoney(
                              expense.amount,
                              expense.currency ||
                              "INR"
                            )}

                          </p>

                          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400 sm:justify-end">

                            <CalendarDays
                              size={13}
                            />

                            {formatDate(
                              expense.expense_date
                            )}

                          </div>

                        </div>

                      </div>

                    </div>

                  )
                )}

              </div>

            </section>
          )}

      </div>

    </main>
  );
}

/* ==================================================
   SMALL ICON COMPONENT
================================================== */

function PenLineIcon() {
  return (
    <div className="text-slate-600">
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </div>
  );
}