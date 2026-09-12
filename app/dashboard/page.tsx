"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Loader2,
  PenLine,
  Receipt,
  TrendingUp,
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
  created_at: string | null;
};

function formatMoney(
  value: number,
  currency = "INR"
) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₹${Number(value).toFixed(2)}`;
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

  return expense.source === "manual"
    ? "Manual Expense"
    : "Bill Expense";
}

function getDateKey(
  date: Date
) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export default function Dashboard() {
  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  // ==================================================
  // LOAD EXPENSES
  // ==================================================

  useEffect(() => {
    async function loadExpenses() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
        } =
          await supabaseBrowser.auth.getSession();

        if (!session) {
          throw new Error(
            "Please sign in to view your dashboard."
          );
        }

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
            : "Failed to load dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    loadExpenses();
  }, []);

  // ==================================================
  // DATE RANGE
  // ==================================================

  const today = useMemo(
    () => new Date(),
    []
  );

  const todayKey = useMemo(
    () => getDateKey(today),
    [today]
  );

  const sevenDaysAgo = useMemo(() => {
    const date = new Date(today);

    date.setDate(
      date.getDate() - 6
    );

    return date;
  }, [today]);

  const sevenDaysAgoKey = useMemo(
    () => getDateKey(sevenDaysAgo),
    [sevenDaysAgo]
  );

  const currentMonth =
    today.getMonth();

  const currentYear =
    today.getFullYear();

  // ==================================================
  // LAST 7 DAYS EXPENSES
  // ==================================================

  const last7DaysExpenses =
    useMemo(() => {
      return expenses.filter(
        (expense) => {
          if (!expense.expense_date) {
            return false;
          }

          const date =
            new Date(
              `${expense.expense_date}T00:00:00`
            );

          if (
            Number.isNaN(
              date.getTime()
            )
          ) {
            return false;
          }

          const key =
            getDateKey(date);

          return (
            key >= sevenDaysAgoKey &&
            key <= todayKey
          );
        }
      );
    }, [
      expenses,
      sevenDaysAgoKey,
      todayKey,
    ]);

  // ==================================================
  // THIS MONTH
  // ==================================================

  const thisMonthExpenses =
    useMemo(() => {
      return expenses.filter(
        (expense) => {
          if (!expense.expense_date) {
            return false;
          }

          const date =
            new Date(
              `${expense.expense_date}T00:00:00`
            );

          return (
            date.getMonth() ===
            currentMonth &&
            date.getFullYear() ===
            currentYear
          );
        }
      );
    }, [
      expenses,
      currentMonth,
      currentYear,
    ]);

  // ==================================================
  // TOTALS
  // ==================================================

  const last7DaysSpent =
    useMemo(() => {
      return last7DaysExpenses.reduce(
        (sum, expense) =>
          sum +
          (Number(expense.amount) || 0),
        0
      );
    }, [last7DaysExpenses]);

  const monthSpent =
    useMemo(() => {
      return thisMonthExpenses.reduce(
        (sum, expense) =>
          sum +
          (Number(expense.amount) || 0),
        0
      );
    }, [thisMonthExpenses]);

  const totalSpent =
    useMemo(() => {
      return expenses.reduce(
        (sum, expense) =>
          sum +
          (Number(expense.amount) || 0),
        0
      );
    }, [expenses]);

  // ==================================================
  // LAST 7 DAYS DAILY SPENDING
  // ==================================================

  const dailySpending =
    useMemo(() => {
      const days = [];

      for (
        let i = 0;
        i < 7;
        i++
      ) {
        const date =
          new Date(
            sevenDaysAgo
          );

        date.setDate(
          sevenDaysAgo.getDate() +
          i
        );

        const key =
          getDateKey(date);

        const amount =
          last7DaysExpenses
            .filter(
              (expense) =>
                expense.expense_date ===
                key
            )
            .reduce(
              (sum, expense) =>
                sum +
                (Number(
                  expense.amount
                ) || 0),
              0
            );

        days.push({
          key,
          date,
          amount,
          label:
            new Intl.DateTimeFormat(
              "en-IN",
              {
                weekday: "short",
              }
            ).format(date),
          dayNumber:
            date.getDate(),
        });
      }

      return days;
    }, [
      last7DaysExpenses,
      sevenDaysAgo,
    ]);

  const maxDailyAmount =
    Math.max(
      ...dailySpending.map(
        (day) => day.amount
      ),
      1
    );

  // ==================================================
  // LAST 7 DAYS CATEGORY BREAKDOWN
  // ==================================================

  const categoryBreakdown =
    useMemo(() => {
      const map =
        new Map<
          string,
          number
        >();

      for (const expense of last7DaysExpenses) {
        const category =
          expense.category ||
          "Uncategorized";

        const amount =
          Number(expense.amount) ||
          0;

        map.set(
          category,
          (map.get(category) || 0) +
          amount
        );
      }

      return Array.from(
        map.entries()
      )
        .map(
          ([
            category,
            amount,
          ]) => ({
            category,
            amount,
          })
        )
        .sort(
          (a, b) =>
            b.amount -
            a.amount
        );
    }, [last7DaysExpenses]);

  const largestCategory =
    categoryBreakdown[0];

  // ==================================================
  // SOURCE BREAKDOWN
  // ==================================================

  const billCount =
    expenses.filter(
      (expense) =>
        expense.source === "bill"
    ).length;

  const manualCount =
    expenses.filter(
      (expense) =>
        expense.source === "manual"
    ).length;

  // ==================================================
  // MONTHLY TREND
  // ==================================================

  const monthlyTrend =
    useMemo(() => {
      const map =
        new Map<
          string,
          number
        >();

      for (const expense of expenses) {
        if (!expense.expense_date) {
          continue;
        }

        const date =
          new Date(
            `${expense.expense_date}T00:00:00`
          );

        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          continue;
        }

        const key =
          `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;

        map.set(
          key,
          (map.get(key) || 0) +
          (Number(expense.amount) ||
            0)
        );
      }

      return Array.from(
        map.entries()
      )
        .sort(
          ([a], [b]) =>
            a.localeCompare(b)
        )
        .slice(-6)
        .map(
          ([key, amount]) => {
            const [
              year,
              month,
            ] =
              key.split("-");

            const date =
              new Date(
                Number(year),
                Number(month) - 1,
                1
              );

            return {
              key,
              label:
                new Intl.DateTimeFormat(
                  "en-IN",
                  {
                    month: "short",
                  }
                ).format(date),
              amount,
            };
          }
        );
    }, [expenses]);

  const maxMonthlyAmount =
    Math.max(
      ...monthlyTrend.map(
        (month) =>
          month.amount
      ),
      1
    );

  // ==================================================
  // RECENT EXPENSES
  // ==================================================

  const recentExpenses =
    expenses.slice(0, 5);

  const currency =
    expenses[0]?.currency ||
    "INR";

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
                Spending Dashboard
              </p>
            </div>

          </div>

          <div className="flex items-center gap-2">

            <Link
              href="/history"
              className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:block"
            >
              History
            </Link>

            <Link
              href="/insights"
              className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:block"
            >
              Insights
            </Link>

            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Back
            </Link>

          </div>

        </div>

      </header>

      {/* ==================================================
          MAIN
      ================================================== */}

      <div className="mx-auto max-w-6xl px-6 py-10">

        {/* TITLE */}

        <section className="mb-8">

          <p className="text-sm font-medium text-slate-500">
            Your spending overview
          </p>

          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Where your money is going.
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            A snapshot of your actual recorded
            spending. No estimates, assumptions,
            or made-up numbers.
          </p>

        </section>

        {/* ==================================================
            LOADING
        ================================================== */}

        {loading && (
          <section className="flex min-h-[350px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="text-center">

              <Loader2
                size={30}
                className="mx-auto animate-spin text-slate-600"
              />

              <p className="mt-4 text-sm font-medium text-slate-700">
                Building your dashboard...
              </p>

            </div>

          </section>
        )}

        {/* ==================================================
            ERROR
        ================================================== */}

        {!loading && error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-6">

            <h3 className="font-semibold text-red-800">
              Could not load dashboard
            </h3>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>

          </section>
        )}

        {/* ==================================================
            DASHBOARD
        ================================================== */}

        {!loading &&
          !error && (
            <>
              {/* ==================================================
                  TOP STATS
              ================================================== */}

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                {/* LAST 7 DAYS */}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                  <div className="flex items-start justify-between">

                    <div>

                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Last 7 Days
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        {formatMoney(
                          last7DaysSpent,
                          currency
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

                  <p className="mt-3 text-xs text-slate-500">
                    {last7DaysExpenses.length} expense
                    {last7DaysExpenses.length === 1
                      ? ""
                      : "s"} recorded
                  </p>

                </div>

                {/* THIS MONTH */}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                  <div className="flex items-start justify-between">

                    <div>

                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        This Month
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        {formatMoney(
                          monthSpent,
                          currency
                        )}
                      </p>

                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">

                      <CalendarDays
                        size={19}
                        className="text-slate-700"
                      />

                    </div>

                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    {thisMonthExpenses.length} expense
                    {thisMonthExpenses.length === 1
                      ? ""
                      : "s"} this month
                  </p>

                </div>

                {/* TRANSACTIONS */}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                  <div className="flex items-start justify-between">

                    <div>

                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Transactions
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-950">
                        {expenses.length}
                      </p>

                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">

                      <Receipt
                        size={19}
                        className="text-slate-700"
                      />

                    </div>

                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Bills + Kacche Bills
                  </p>

                </div>

                {/* TOP CATEGORY */}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                  <div className="flex items-start justify-between">

                    <div className="min-w-0">

                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Top Category
                      </p>

                      <p className="mt-2 truncate text-lg font-bold text-slate-950">
                        {largestCategory
                          ?.category ||
                          "—"}
                      </p>

                    </div>

                    <div className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">

                      <TrendingUp
                        size={19}
                        className="text-slate-700"
                      />

                    </div>

                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    {largestCategory
                      ? `${formatMoney(
                        largestCategory.amount,
                        currency
                      )} in last 7 days`
                      : "No data yet"}
                  </p>

                </div>

              </section>

              {/* ==================================================
                  LAST 7 DAYS + CATEGORY
              ================================================== */}

              <section className="mt-6 grid gap-6 lg:grid-cols-2">

                {/* DAILY SPENDING */}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="mb-6">

                    <h3 className="text-lg font-semibold">
                      Spending — Last 7 Days
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Your actual daily spending.
                    </p>

                  </div>

                  <div className="flex h-[250px] items-end gap-2 sm:gap-3">

                    {dailySpending.map(
                      (day) => {

                        const height =
                          day.amount > 0
                            ? (
                              day.amount /
                              maxDailyAmount
                            ) *
                            100
                            : 0;

                        return (
                          <div
                            key={
                              day.key
                            }
                            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                          >

                            <div className="mb-2 h-5 text-center">

                              {day.amount >
                                0 && (
                                  <p className="whitespace-nowrap text-[10px] font-semibold text-slate-600 sm:text-[11px]">
                                    {formatMoney(
                                      day.amount,
                                      currency
                                    )}
                                  </p>
                                )}

                            </div>

                            <div className="flex h-[170px] w-full items-end justify-center">

                              <div
                                className="w-full max-w-[42px] rounded-t-lg bg-slate-800 transition-all"
                                style={{
                                  height:
                                    day.amount >
                                      0
                                      ? `${Math.max(
                                        height,
                                        4
                                      )}%`
                                      : "2%",
                                }}
                                title={`${day.label} ${day.dayNumber}: ${formatMoney(
                                  day.amount,
                                  currency
                                )}`}
                              />

                            </div>

                            <div className="mt-3 text-center">

                              <p className="text-xs font-medium text-slate-500">
                                {day.label}
                              </p>

                              <p className="text-[11px] text-slate-400">
                                {day.dayNumber}
                              </p>

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>

                {/* CATEGORY */}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="mb-6">

                    <h3 className="text-lg font-semibold">
                      Spending by Category
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Where your money went in the last 7 days.
                    </p>

                  </div>

                  {categoryBreakdown.length ===
                    0 ? (

                    <div className="flex min-h-[250px] items-center justify-center text-sm text-slate-400">
                      No spending data yet.
                    </div>

                  ) : (

                    <div className="space-y-5">

                      {categoryBreakdown
                        .slice(0, 8)
                        .map(
                          (
                            category
                          ) => {

                            const percentage =
                              last7DaysSpent >
                                0
                                ? (
                                  category.amount /
                                  last7DaysSpent
                                ) *
                                100
                                : 0;

                            return (
                              <div
                                key={
                                  category.category
                                }
                              >

                                <div className="mb-2 flex items-center justify-between gap-4">

                                  <p className="truncate text-sm font-medium text-slate-700">
                                    {
                                      category.category
                                    }
                                  </p>

                                  <div className="shrink-0 text-right">

                                    <span className="text-sm font-semibold text-slate-900">
                                      {formatMoney(
                                        category.amount,
                                        currency
                                      )}
                                    </span>

                                    <span className="ml-2 text-xs text-slate-400">
                                      {percentage.toFixed(
                                        1
                                      )}
                                      %
                                    </span>

                                  </div>

                                </div>

                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">

                                  <div
                                    className="h-full rounded-full bg-slate-800 transition-all"
                                    style={{
                                      width: `${Math.min(
                                        percentage,
                                        100
                                      )}%`,
                                    }}
                                  />

                                </div>

                              </div>
                            );
                          }
                        )}

                    </div>

                  )}

                </div>

              </section>

              {/* ==================================================
                  MONTHLY TREND
              ================================================== */}

              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="mb-6">

                  <h3 className="text-lg font-semibold">
                    Monthly Spending
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Spending recorded over the last few months.
                  </p>

                </div>

                {monthlyTrend.length ===
                  0 ? (

                  <div className="flex min-h-[250px] items-center justify-center text-sm text-slate-400">
                    No monthly data yet.
                  </div>

                ) : (

                  <div className="flex h-[250px] items-end gap-3">

                    {monthlyTrend.map(
                      (month) => {

                        const height =
                          (
                            month.amount /
                            maxMonthlyAmount
                          ) *
                          100;

                        return (
                          <div
                            key={
                              month.key
                            }
                            className="flex h-full flex-1 flex-col items-center justify-end"
                          >

                            <div className="mb-2 text-center">

                              <p className="text-[11px] font-semibold text-slate-600">
                                {formatMoney(
                                  month.amount,
                                  currency
                                )}
                              </p>

                            </div>

                            <div className="flex h-[170px] w-full items-end justify-center">

                              <div
                                className="w-full max-w-[55px] rounded-t-lg bg-slate-800 transition-all"
                                style={{
                                  height: `${Math.max(
                                    height,
                                    4
                                  )}%`,
                                }}
                                title={`${month.label}: ${formatMoney(
                                  month.amount,
                                  currency
                                )}`}
                              />

                            </div>

                            <p className="mt-3 text-xs font-medium text-slate-500">
                              {month.label}
                            </p>

                          </div>
                        );
                      }
                    )}

                  </div>

                )}

              </section>

              {/* ==================================================
                  EXPENSE SOURCES
              ================================================== */}

              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="mb-6">

                  <h3 className="text-lg font-semibold">
                    Expense Sources
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    How your expenses are being recorded.
                  </p>

                </div>

                <div className="grid gap-4 sm:grid-cols-2">

                  <div className="rounded-xl bg-slate-50 p-5">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">

                        <Receipt
                          size={18}
                          className="text-slate-600"
                        />

                      </div>

                      <div>

                        <p className="text-sm font-semibold">
                          Bills
                        </p>

                        <p className="text-xs text-slate-500">
                          AI-extracted expenses
                        </p>

                      </div>

                    </div>

                    <p className="mt-4 text-2xl font-bold">
                      {billCount}
                    </p>

                  </div>

                  <div className="rounded-xl bg-slate-50 p-5">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">

                        <PenLine
                          size={18}
                          className="text-slate-600"
                        />

                      </div>

                      <div>

                        <p className="text-sm font-semibold">
                          Kaccha Bills
                        </p>

                        <p className="text-xs text-slate-500">
                          Manually recorded expenses
                        </p>

                      </div>

                    </div>

                    <p className="mt-4 text-2xl font-bold">
                      {manualCount}
                    </p>

                  </div>

                </div>

              </section>

              {/* ==================================================
                  RECENT EXPENSES
              ================================================== */}

              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="mb-5 flex items-center justify-between">

                  <div>

                    <h3 className="text-lg font-semibold">
                      Recent Expenses
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Your latest recorded spending.
                    </p>

                  </div>

                  <Link
                    href="/history"
                    className="flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-950"
                  >
                    View all
                    <ChevronRight
                      size={16}
                    />
                  </Link>

                </div>

                {recentExpenses.length ===
                  0 ? (

                  <div className="rounded-xl bg-slate-50 p-8 text-center">

                    <p className="text-sm text-slate-500">
                      No expenses recorded yet.
                    </p>

                  </div>

                ) : (

                  <div className="divide-y divide-slate-100">

                    {recentExpenses.map(
                      (expense) => (

                        <Link
                          key={
                            expense.id
                          }
                          href={`/history/${expense.id}`}
                          className="flex items-center justify-between gap-4 py-4 transition hover:bg-slate-50"
                        >

                          <div className="flex min-w-0 items-center gap-3">

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">

                              {expense.source ===
                                "manual" ? (
                                <PenLine
                                  size={16}
                                  className="text-slate-600"
                                />
                              ) : (
                                <Receipt
                                  size={16}
                                  className="text-slate-600"
                                />
                              )}

                            </div>

                            <div className="min-w-0">

                              <p className="truncate text-sm font-semibold text-slate-800">
                                {getExpenseTitle(
                                  expense
                                )}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">

                                {expense.category ||
                                  "Uncategorized"}

                                {" · "}

                                {formatDate(
                                  expense.expense_date
                                )}

                              </p>

                            </div>

                          </div>

                          <p className="shrink-0 text-sm font-bold text-slate-900">

                            {formatMoney(
                              Number(
                                expense.amount
                              ) || 0,
                              expense.currency ||
                              "INR"
                            )}

                          </p>

                        </Link>

                      )
                    )}

                  </div>

                )}

              </section>

              {/* ==================================================
                  ALL-TIME SUMMARY
              ================================================== */}

              {expenses.length >
                0 && (
                  <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        All-Time Recorded Spending
                      </p>

                      <p className="mt-1 text-2xl font-bold text-slate-950">
                        {formatMoney(
                          totalSpent,
                          currency
                        )}
                      </p>

                    </div>

                    <Link
                      href="/insights"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Explore Insights
                      <ChevronRight
                        size={16}
                      />
                    </Link>

                  </section>
                )}

              {/* ==================================================
                  EMPTY STATE
              ================================================== */}

              {expenses.length ===
                0 && (
                  <section className="mt-6 rounded-2xl bg-slate-950 p-6 text-white">

                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                      <div>

                        <h3 className="text-lg font-bold">
                          Start recording your spending
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          Scan a bill or add a Kaccha Bill
                          to start building your spending history.
                        </p>

                      </div>

                      <Link
                        href="/"
                        className="shrink-0 rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                      >
                        Add Expense
                      </Link>

                    </div>

                  </section>
                )}

            </>
          )}

      </div>

    </main>
  );
}