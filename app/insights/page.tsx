"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lightbulb,
  PenLine,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useTheme } from "@/components/theme-provider";

type Expense = {
  id: string;
  source: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  expense_date: string | null;
  description: string | null;
  vendor_name: string | null;
  invoice_number: string | null;
  created_at: string | null;
};

type ViewMode =
  | "general"
  | "month"
  | "calendar";

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

function getTitle(
  expense: Expense
) {
  if (
    expense.description &&
    expense.description.trim()
  ) {
    return expense.description;
  }

  if (
    expense.vendor_name &&
    expense.vendor_name.trim()
  ) {
    return expense.vendor_name;
  }

  if (
    expense.invoice_number &&
    expense.invoice_number.trim()
  ) {
    return `Invoice ${expense.invoice_number}`;
  }

  return expense.source === "manual"
    ? "Kaccha Bill"
    : "Bill Expense";
}

function getExpenseDate(
  expense: Expense
) {
  if (!expense.expense_date) {
    return null;
  }

  const date =
    new Date(
      `${expense.expense_date}T00:00:00`
    );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getAmount(
  expense: Expense
) {
  return Number(expense.amount) || 0;
}

export default function Insights() {
  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [view, setView] =
    useState<ViewMode>("general");

  // Calendar month
  const [calendarDate, setCalendarDate] =
    useState(
      new Date()
    );

  // Selected calendar day
  const [selectedDate, setSelectedDate] =
    useState<string | null>(null);

  // ==================================================
  // BALANCE
  // ==================================================

  const [balance, setBalance] =
    useState<number | null>(null);

  const [balanceInput, setBalanceInput] =
    useState("");

  const [savingBalance, setSavingBalance] =
    useState(false);

  const [balanceMessage, setBalanceMessage] =
    useState<string | null>(null);

  const [balanceError, setBalanceError] =
    useState<string | null>(null);

  const { darkMode } = useTheme();

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
            "Please sign in to view your insights."
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
                vendor_name,
                invoice_number,
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

        // Balance is additive to the existing insights logic.
        // If no balance has been created yet, the existing insights
        // continue to work normally.
        const {
          data: balanceData,
          error: balanceFetchError,
        } = await supabaseBrowser
          .from("user_balances")
          .select("balance")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!balanceFetchError && balanceData) {
          const currentBalance =
            Number(balanceData.balance) || 0;
          setBalance(currentBalance);
          setBalanceInput(String(currentBalance));
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load insights."
        );
      } finally {
        setLoading(false);
      }
    }

    loadExpenses();
  }, []);

  // ==================================================
  // TODAY
  // ==================================================

  const today = useMemo(() => {
    const now = new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
  }, []);

  // ==================================================
  // GENERAL = LAST 7 DAYS
  // ==================================================

  const generalStart = useMemo(() => {
    const date =
      new Date(today);

    date.setDate(
      date.getDate() - 6
    );

    return date;
  }, [today]);

  const generalExpenses =
    useMemo(() => {
      return expenses.filter(
        (expense) => {
          const date =
            getExpenseDate(expense);

          if (!date) {
            return false;
          }

          return (
            date >= generalStart &&
            date <= today
          );
        }
      );
    }, [
      expenses,
      generalStart,
      today,
    ]);

  const generalSpent =
    useMemo(() => {
      return generalExpenses.reduce(
        (sum, expense) =>
          sum + getAmount(expense),
        0
      );
    }, [generalExpenses]);

  // ==================================================
  // GENERAL DAILY SPENDING
  // ==================================================

  const generalDailySpending =
    useMemo(() => {
      const result: {
        date: Date;
        key: string;
        label: string;
        amount: number;
      }[] = [];

      for (
        let i = 0;
        i < 7;
        i++
      ) {
        const date =
          new Date(generalStart);

        date.setDate(
          generalStart.getDate() +
          i
        );

        const key =
          `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}-${String(
            date.getDate()
          ).padStart(2, "0")}`;

        const amount =
          generalExpenses
            .filter(
              (expense) =>
                expense.expense_date ===
                key
            )
            .reduce(
              (sum, expense) =>
                sum +
                getAmount(expense),
              0
            );

        result.push({
          date,
          key,
          label:
            new Intl.DateTimeFormat(
              "en-IN",
              {
                weekday: "short",
              }
            ).format(date),
          amount,
        });
      }

      return result;
    }, [
      generalStart,
      generalExpenses,
    ]);

  const maxGeneralDaily =
    Math.max(
      ...generalDailySpending.map(
        (day) => day.amount
      ),
      1
    );

  // ==================================================
  // GENERAL CATEGORY BREAKDOWN
  // ==================================================

  const generalCategories =
    useMemo(() => {
      const map =
        new Map<
          string,
          number
        >();

      for (const expense of generalExpenses) {
        const category =
          expense.category ||
          "Uncategorized";

        map.set(
          category,
          (map.get(category) || 0) +
          getAmount(expense)
        );
      }

      return Array.from(
        map.entries()
      )
        .map(
          ([category, amount]) => ({
            category,
            amount,
          })
        )
        .sort(
          (a, b) =>
            b.amount - a.amount
        );
    }, [generalExpenses]);

  // ==================================================
  // MONTH
  // ==================================================

  const currentMonthStart =
    useMemo(() => {
      return new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );
    }, [today]);

  const currentMonthEnd =
    useMemo(() => {
      return new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      );
    }, [today]);

  const monthExpenses =
    useMemo(() => {
      return expenses.filter(
        (expense) => {
          const date =
            getExpenseDate(expense);

          if (!date) {
            return false;
          }

          return (
            date >=
            currentMonthStart &&
            date <=
            currentMonthEnd
          );
        }
      );
    }, [
      expenses,
      currentMonthStart,
      currentMonthEnd,
    ]);

  const monthSpent =
    useMemo(() => {
      return monthExpenses.reduce(
        (sum, expense) =>
          sum + getAmount(expense),
        0
      );
    }, [monthExpenses]);

  // ==================================================
  // PREVIOUS MONTH
  // ==================================================

  const previousMonthStart =
    useMemo(() => {
      return new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
      );
    }, [today]);

  const previousMonthEnd =
    useMemo(() => {
      return new Date(
        today.getFullYear(),
        today.getMonth(),
        0
      );
    }, [today]);

  const previousMonthSpent =
    useMemo(() => {
      return expenses
        .filter(
          (expense) => {
            const date =
              getExpenseDate(
                expense
              );

            if (!date) {
              return false;
            }

            return (
              date >=
              previousMonthStart &&
              date <=
              previousMonthEnd
            );
          }
        )
        .reduce(
          (sum, expense) =>
            sum + getAmount(expense),
          0
        );
    }, [
      expenses,
      previousMonthStart,
      previousMonthEnd,
    ]);

  const monthDifference =
    monthSpent -
    previousMonthSpent;

  const monthPercentageChange =
    previousMonthSpent > 0
      ? (
        Math.abs(
          monthDifference
        ) /
        previousMonthSpent
      ) * 100
      : null;

  // ==================================================
  // MONTH CATEGORY BREAKDOWN
  // ==================================================

  const monthCategories =
    useMemo(() => {
      const map =
        new Map<
          string,
          number
        >();

      for (const expense of monthExpenses) {
        const category =
          expense.category ||
          "Uncategorized";

        map.set(
          category,
          (map.get(category) || 0) +
          getAmount(expense)
        );
      }

      return Array.from(
        map.entries()
      )
        .map(
          ([category, amount]) => ({
            category,
            amount,
          })
        )
        .sort(
          (a, b) =>
            b.amount - a.amount
        );
    }, [monthExpenses]);

  // ==================================================
  // GENERAL TOP CATEGORY
  // ==================================================

  const generalTopCategory =
    generalCategories[0] ||
    null;

  // ==================================================
  // GENERAL OBSERVATIONS
  // ==================================================

  const generalHighestSpendingDay =
    useMemo(() => {
      if (generalDailySpending.length === 0) {
        return null;
      }

      return generalDailySpending.reduce(
        (highest, day) =>
          day.amount > highest.amount
            ? day
            : highest
      );
    }, [generalDailySpending]);

  const generalBillSpent =
    useMemo(() => {
      return generalExpenses
        .filter(
          (expense) =>
            expense.source === "bill"
        )
        .reduce(
          (sum, expense) =>
            sum + getAmount(expense),
          0
        );
    }, [generalExpenses]);

  const generalManualSpent =
    useMemo(() => {
      return generalExpenses
        .filter(
          (expense) =>
            expense.source === "manual"
        )
        .reduce(
          (sum, expense) =>
            sum + getAmount(expense),
          0
        );
    }, [generalExpenses]);

  const generalDominantSource =
    generalBillSpent >= generalManualSpent
      ? "Bills"
      : "Kaccha Bills";

  // ==================================================
  // MONTH TOP CATEGORY
  // ==================================================

  const monthTopCategory =
    monthCategories[0] ||
    null;

  // ==================================================
  // LARGEST EXPENSE
  // ==================================================

  const largestExpense =
    useMemo(() => {
      if (
        expenses.length === 0
      ) {
        return null;
      }

      return expenses.reduce(
        (largest, expense) => {
          return getAmount(
            expense
          ) >
            getAmount(
              largest
            )
            ? expense
            : largest;
        }
      );
    }, [expenses]);

  // ==================================================
  // AVERAGE
  // ==================================================

  const averageExpense =
    expenses.length > 0
      ? expenses.reduce(
        (sum, expense) =>
          sum +
          getAmount(expense),
        0
      ) / expenses.length
      : 0;

  // ==================================================
  // SOURCE BREAKDOWN
  // ==================================================

  const billExpenses =
    expenses.filter(
      (expense) =>
        expense.source === "bill"
    );

  const manualExpenses =
    expenses.filter(
      (expense) =>
        expense.source === "manual"
    );

  const billSpent =
    billExpenses.reduce(
      (sum, expense) =>
        sum + getAmount(expense),
      0
    );

  const manualSpent =
    manualExpenses.reduce(
      (sum, expense) =>
        sum + getAmount(expense),
      0
    );

  const currency =
    expenses[0]?.currency ||
    "INR";

  // ==================================================
  // BALANCE ACTIONS
  // ==================================================

  async function handleSaveBalance() {
    const parsedBalance = Number(balanceInput);

    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      setBalanceError("Enter a valid balance of ₹0 or more.");
      setBalanceMessage(null);
      return;
    }

    setSavingBalance(true);
    setBalanceError(null);
    setBalanceMessage(null);

    try {
      const { data, error } =
        await supabaseBrowser.rpc(
          "set_my_balance",
          {
            p_balance: parsedBalance,
          }
        );

      if (error) {
        throw new Error(error.message);
      }

      const savedBalance =
        Number(data) || 0;

      setBalance(savedBalance);
      setBalanceInput(String(savedBalance));
      setBalanceMessage("Balance saved successfully.");
    } catch (err) {
      setBalanceError(
        err instanceof Error
          ? err.message
          : "Could not save your balance."
      );
    } finally {
      setSavingBalance(false);
    }
  }

  const balanceAwareAdvice =
    useMemo(() => {
      if (balance === null) {
        return {
          title: "Set your current balance",
          text: "Add the amount of money you are currently tracking. Real Cost can then use your balance together with actual expenses to make saving-focused observations.",
        };
      }

      if (balance === 0) {
        return {
          title: "Your tracked balance is ₹0",
          text: "No money is currently available in the balance you are tracking. Add or update your balance when you want balance-aware saving guidance.",
        };
      }

      if (monthSpent > balance) {
        return {
          title: "Your spending is putting pressure on your balance",
          text: `You have ${formatMoney(monthSpent, currency)} of recorded spending this month against a current tracked balance of ${formatMoney(balance, currency)}. Focus first on reducing your highest-spending categories.`,
        };
      }

      if (monthTopCategory && monthSpent > 0) {
        const percentage =
          (monthTopCategory.amount / monthSpent) * 100;

        if (percentage >= 35) {
          return {
            title: `Watch ${monthTopCategory.category}`,
            text: `${monthTopCategory.category} accounts for ${percentage.toFixed(0)}% of this month's recorded spending. This is the clearest place to look for savings opportunities.`,
          };
        }
      }

      if (monthDifference > 0 && monthPercentageChange !== null) {
        return {
          title: "Spending increased this month",
          text: `Your recorded spending is ${monthPercentageChange.toFixed(0)}% higher than last month. Before adding new discretionary purchases, look at the categories driving the increase.`,
        };
      }

      if (monthDifference < 0 && monthPercentageChange !== null) {
        return {
          title: "You're spending less than last month",
          text: `Recorded spending is down ${monthPercentageChange.toFixed(0)}% from last month. Keeping the categories that improved under control can help preserve your current balance.`,
        };
      }

      return {
        title: "Protect your current balance",
        text: `Your current tracked balance is ${formatMoney(balance, currency)}. Keep watching your largest spending categories and use the recorded data to decide where you can cut back.`,
      };
    }, [
      balance,
      monthSpent,
      monthTopCategory,
      monthDifference,
      monthPercentageChange,
      currency,
    ]);

  // ==================================================
  // CALENDAR HELPERS
  // ==================================================

  const calendarYear =
    calendarDate.getFullYear();

  const calendarMonth =
    calendarDate.getMonth();

  const daysInCalendarMonth =
    new Date(
      calendarYear,
      calendarMonth + 1,
      0
    ).getDate();

  const firstDay =
    new Date(
      calendarYear,
      calendarMonth,
      1
    ).getDay();

  // Convert Sunday=0 to Monday=0
  const calendarOffset =
    firstDay === 0
      ? 6
      : firstDay - 1;

  const calendarCells =
    useMemo(() => {
      const cells: (
        | null
        | {
          day: number;
          key: string;
          amount: number;
          expenses: Expense[];
        }
      )[] = [];

      for (
        let i = 0;
        i < calendarOffset;
        i++
      ) {
        cells.push(null);
      }

      for (
        let day = 1;
        day <=
        daysInCalendarMonth;
        day++
      ) {
        const key =
          `${calendarYear}-${String(
            calendarMonth + 1
          ).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;

        const dayExpenses =
          expenses.filter(
            (expense) =>
              expense.expense_date ===
              key
          );

        const amount =
          dayExpenses.reduce(
            (sum, expense) =>
              sum +
              getAmount(expense),
            0
          );

        cells.push({
          day,
          key,
          amount,
          expenses:
            dayExpenses,
        });
      }

      return cells;
    }, [
      calendarYear,
      calendarMonth,
      expenses,
      calendarOffset,
      daysInCalendarMonth,
    ]);

  const calendarMonthSpent =
    useMemo(() => {
      return expenses
        .filter(
          (expense) => {
            const date =
              getExpenseDate(
                expense
              );

            if (!date) {
              return false;
            }

            return (
              date.getFullYear() ===
              calendarYear &&
              date.getMonth() ===
              calendarMonth
            );
          }
        )
        .reduce(
          (sum, expense) =>
            sum + getAmount(expense),
          0
        );
    }, [
      expenses,
      calendarYear,
      calendarMonth,
    ]);

  const selectedDayExpenses =
    useMemo(() => {
      if (!selectedDate) {
        return [];
      }

      return expenses.filter(
        (expense) =>
          expense.expense_date ===
          selectedDate
      );
    }, [
      expenses,
      selectedDate,
    ]);

  const selectedDayTotal =
    selectedDayExpenses.reduce(
      (sum, expense) =>
        sum + getAmount(expense),
      0
    );

  function previousCalendarMonth() {
    setCalendarDate(
      new Date(
        calendarYear,
        calendarMonth - 1,
        1
      )
    );

    setSelectedDate(null);
  }

  function nextCalendarMonth() {
    setCalendarDate(
      new Date(
        calendarYear,
        calendarMonth + 1,
        1
      )
    );

    setSelectedDate(null);
  }

  function goToToday() {
    setCalendarDate(
      new Date()
    );

    setSelectedDate(null);
  }

  return (
    <main className={`min-h-screen ${darkMode ? "bg-slate-950" : "bg-slate-50"} text-slate-900`}>

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
                Spending Insights
              </p>

            </div>

          </div>

          <div className="flex items-center gap-2">

            <Link
              href="/dashboard"
              className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:block"
            >
              Dashboard
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
            Based on your actual recorded expenses
          </p>

          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Your Spending Insights
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Explore your spending by recent
            activity, month or individual days.
          </p>

        </section>

        {/* ==================================================
            BALANCE + SAVING GUIDANCE
        ================================================== */}

        <section className="mb-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Money Available
                </p>
                <h3 className="mt-1 text-xl font-bold">
                  Your Current Balance
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  This is the balance Real Cost will use for balance-aware saving guidance.
                </p>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <Wallet size={20} className="text-slate-700" />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={balanceInput}
                  onChange={(event) => {
                    setBalanceInput(event.target.value);
                    setBalanceError(null);
                    setBalanceMessage(null);
                  }}
                  placeholder="Enter current balance"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveBalance}
                disabled={savingBalance}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingBalance && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Save Balance
              </button>
            </div>

            {balanceError && (
              <p className="mt-3 text-sm font-medium text-red-600">
                {balanceError}
              </p>
            )}

            {balanceMessage && (
              <p className="mt-3 text-sm font-medium text-emerald-600">
                {balanceMessage}
              </p>
            )}

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Tracked Balance
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {balance === null ? "Not set" : formatMoney(balance, currency)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <Lightbulb size={20} className="text-slate-700" />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Saving Guidance
                </p>
                <h3 className="mt-1 text-xl font-bold">
                  {balanceAwareAdvice.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {balanceAwareAdvice.text}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Advice is based on your actual recorded expenses and tracked balance. Real Cost does not invent spending data.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================
            VIEW TABS
        ================================================== */}

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">

          <div className="grid grid-cols-3 gap-2">

            <button
              onClick={() =>
                setView("general")
              }
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${view === "general"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-50"
                }`}
            >
              <span className="block">
                General
              </span>

              <span
                className={`mt-0.5 block text-xs font-normal ${view === "general"
                  ? "text-slate-400"
                  : "text-slate-400"
                  }`}
              >
                Last 7 Days
              </span>
            </button>

            <button
              onClick={() =>
                setView("month")
              }
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${view === "month"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-50"
                }`}
            >
              <span className="block">
                Month
              </span>

              <span
                className={`mt-0.5 block text-xs font-normal ${view === "month"
                  ? "text-slate-400"
                  : "text-slate-400"
                  }`}
              >
                Monthly View
              </span>
            </button>

            <button
              onClick={() =>
                setView("calendar")
              }
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${view === "calendar"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-50"
                }`}
            >
              <span className="block">
                Calendar
              </span>

              <span
                className={`mt-0.5 block text-xs font-normal ${view === "calendar"
                  ? "text-slate-400"
                  : "text-slate-400"
                  }`}
              >
                Day by Day
              </span>
            </button>

          </div>

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
                Loading your spending...
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
              Could not load insights
            </h3>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>

          </section>
        )}

        {/* ==================================================
            GENERAL VIEW
        ================================================== */}

        {!loading &&
          !error &&
          view === "general" && (
            <section>

              {/* HEADER */}

              <div className="mb-6">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  General
                </p>

                <h3 className="mt-1 text-2xl font-bold">
                  Last 7 Days
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Your most recent recorded spending.
                </p>

              </div>

              {/* STATS */}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                <StatCard
                  label="Spent"
                  value={formatMoney(
                    generalSpent,
                    currency
                  )}
                  subtext={`${generalExpenses.length} recorded expense${generalExpenses.length ===
                    1
                    ? ""
                    : "s"
                    }`}
                  icon={
                    <Wallet size={19} />
                  }
                />

                <StatCard
                  label="Average Expense"
                  value={formatMoney(
                    generalExpenses.length >
                      0
                      ? generalSpent /
                      generalExpenses.length
                      : 0,
                    currency
                  )}
                  subtext="Per recorded transaction"
                  icon={
                    <Receipt size={19} />
                  }
                />

                <StatCard
                  label="Top Category"
                  value={
                    generalTopCategory
                      ?.category ||
                    "—"
                  }
                  subtext={
                    generalTopCategory
                      ? formatMoney(
                        generalTopCategory.amount,
                        currency
                      )
                      : "No data yet"
                  }
                  icon={
                    <TrendingUp
                      size={19}
                    />
                  }
                />

                <StatCard
                  label="Largest Expense"
                  value={
                    generalExpenses.length >
                      0
                      ? formatMoney(
                        Math.max(
                          ...generalExpenses.map(
                            getAmount
                          )
                        ),
                        currency
                      )
                      : "₹0"
                  }
                  subtext="In the last 7 days"
                  icon={
                    <TrendingUp
                      size={19}
                    />
                  }
                />

              </div>

              {/* DAILY CHART */}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="mb-6">

                  <h3 className="text-lg font-semibold">
                    Daily Spending
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    How much you recorded each day.
                  </p>

                </div>

                <div className="flex h-[280px] items-end gap-3 sm:gap-5">

                  {generalDailySpending.map(
                    (day) => {

                      const height =
                        day.amount > 0
                          ? (
                            day.amount /
                            maxGeneralDaily
                          ) *
                          100
                          : 0;

                      return (
                        <div
                          key={day.key}
                          className="flex h-full flex-1 flex-col items-center justify-end"
                        >

                          <div className="mb-2 h-5 text-center">

                            {day.amount >
                              0 && (
                                <p className="text-[11px] font-semibold text-slate-600">
                                  {formatMoney(
                                    day.amount,
                                    currency
                                  )}
                                </p>
                              )}

                          </div>

                          <div className="flex h-[190px] w-full items-end justify-center">

                            <div
                              className="w-full max-w-[55px] rounded-t-lg bg-slate-800 transition-all"
                              style={{
                                height:
                                  day.amount >
                                    0
                                    ? `${Math.max(
                                      height,
                                      5
                                    )}%`
                                    : "3px",
                              }}
                            />

                          </div>

                          <p className="mt-3 text-xs font-medium text-slate-500">
                            {day.label}
                          </p>

                        </div>
                      );
                    }
                  )}

                </div>

              </div>

              {/* CATEGORY + RECENT */}

              <div className="mt-6 grid gap-6 lg:grid-cols-2">

                {/* CATEGORY */}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="mb-6">

                    <h3 className="text-lg font-semibold">
                      Spending by Category
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Last 7 days.
                    </p>

                  </div>

                  {generalCategories.length ===
                    0 ? (

                    <EmptyMessage
                      text="No spending recorded in the last 7 days."
                    />

                  ) : (

                    <div className="space-y-5">

                      {generalCategories.map(
                        (
                          category
                        ) => {

                          const percentage =
                            generalSpent >
                              0
                              ? (
                                category.amount /
                                generalSpent
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

                                <span className="text-sm font-medium text-slate-700">
                                  {
                                    category.category
                                  }
                                </span>

                                <span className="text-sm font-semibold">
                                  {formatMoney(
                                    category.amount,
                                    currency
                                  )}

                                  <span className="ml-2 text-xs text-slate-400">
                                    {percentage.toFixed(
                                      0
                                    )}
                                    %
                                  </span>

                                </span>

                              </div>

                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">

                                <div
                                  className="h-full rounded-full bg-slate-800"
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

                {/* RECENT */}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="mb-6 flex items-center justify-between">

                    <div>

                      <h3 className="text-lg font-semibold">
                        Recent Expenses
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        From the last 7 days.
                      </p>

                    </div>

                    <Link
                      href="/history"
                      className="text-sm font-medium text-slate-500 hover:text-slate-900"
                    >
                      View all
                    </Link>

                  </div>

                  {generalExpenses.length ===
                    0 ? (

                    <EmptyMessage
                      text="No recent expenses."
                    />

                  ) : (

                    <div className="divide-y divide-slate-100">

                      {generalExpenses
                        .slice(0, 6)
                        .map(
                          (
                            expense
                          ) => (

                            <ExpenseRow
                              key={
                                expense.id
                              }
                              expense={
                                expense
                              }
                              currency={
                                currency
                              }
                            />

                          )
                        )}

                    </div>

                  )}

                </div>

              </div>

              {/* ==================================================
                  WHAT STANDS OUT
              ================================================== */}

              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="mb-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Observations
                  </p>
                  <h3 className="mt-1 text-xl font-bold">
                    What stands out
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Based only on your recorded spending in the last 7 days.
                  </p>
                </div>

                {generalExpenses.length === 0 ? (
                  <EmptyMessage
                    text="Record some expenses to see spending observations."
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">

                    <div className="rounded-xl bg-slate-50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Highest category
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-950">
                        {generalTopCategory?.category || "—"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {generalTopCategory
                          ? `${formatMoney(generalTopCategory.amount, currency)} recorded`
                          : "No data"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Highest spending day
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-950">
                        {generalHighestSpendingDay
                          ? generalHighestSpendingDay.label
                          : "—"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {generalHighestSpendingDay
                          ? formatMoney(generalHighestSpendingDay.amount, currency)
                          : "No spending"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Main recording source
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-950">
                        {generalDominantSource}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {generalDominantSource === "Bills"
                          ? `${formatMoney(generalBillSpent, currency)} recorded`
                          : `${formatMoney(generalManualSpent, currency)} recorded`}
                      </p>
                    </div>

                  </div>
                )}

              </section>

            </section>
          )}

        {/* ==================================================
            MONTH VIEW
        ================================================== */}

        {!loading &&
          !error &&
          view === "month" && (
            <section>

              <div className="mb-6">

                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Month
                </p>

                <h3 className="mt-1 text-2xl font-bold">
                  {new Intl.DateTimeFormat(
                    "en-IN",
                    {
                      month: "long",
                      year: "numeric",
                    }
                  ).format(today)}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Your complete spending for this month.
                </p>

              </div>

              {/* MONTH STATS */}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                <StatCard
                  label="This Month"
                  value={formatMoney(
                    monthSpent,
                    currency
                  )}
                  subtext={`${monthExpenses.length} expense${monthExpenses.length ===
                    1
                    ? ""
                    : "s"
                    }`}
                  icon={
                    <Wallet size={19} />
                  }
                />

                <StatCard
                  label="Last Month"
                  value={formatMoney(
                    previousMonthSpent,
                    currency
                  )}
                  subtext="Previous month"
                  icon={
                    <CalendarDays
                      size={19}
                    />
                  }
                />

                <StatCard
                  label="Top Category"
                  value={
                    monthTopCategory
                      ?.category ||
                    "—"
                  }
                  subtext={
                    monthTopCategory
                      ? formatMoney(
                        monthTopCategory.amount,
                        currency
                      )
                      : "No data yet"
                  }
                  icon={
                    <TrendingUp
                      size={19}
                    />
                  }
                />

                <StatCard
                  label="Transactions"
                  value={String(
                    monthExpenses.length
                  )}
                  subtext="Recorded this month"
                  icon={
                    <Receipt size={19} />
                  }
                />

              </div>

              {/* COMPARISON */}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <h3 className="text-lg font-semibold">
                      Month-over-Month
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Comparing actual recorded spending.
                    </p>

                  </div>

                  {previousMonthSpent ===
                    0 ? (

                    <div className="rounded-xl bg-slate-50 px-5 py-4 text-sm text-slate-500">
                      No previous-month spending recorded.
                    </div>

                  ) : (

                    <div className="flex items-center gap-4">

                      <div>

                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Last Month
                        </p>

                        <p className="mt-1 font-semibold">
                          {formatMoney(
                            previousMonthSpent,
                            currency
                          )}
                        </p>

                      </div>

                      <div className="h-10 w-px bg-slate-200" />

                      <div>

                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          This Month
                        </p>

                        <p className="mt-1 font-semibold">
                          {formatMoney(
                            monthSpent,
                            currency
                          )}
                        </p>

                      </div>

                      {monthDifference !==
                        0 && (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">

                            {monthDifference >
                              0 ? (
                              <TrendingUp
                                size={
                                  18
                                }
                                className="text-slate-700"
                              />
                            ) : (
                              <TrendingDown
                                size={
                                  18
                                }
                                className="text-emerald-600"
                              />
                            )}

                          </div>
                        )}

                    </div>

                  )}

                </div>

                {previousMonthSpent >
                  0 &&
                  monthPercentageChange !==
                  null && (
                    <div className="mt-6 rounded-xl bg-slate-50 p-5">

                      <p className="text-sm text-slate-600">

                        Recorded spending is{" "}

                        <span className="font-bold text-slate-900">
                          {monthPercentageChange.toFixed(
                            0
                          )}
                          %
                        </span>{" "}

                        {monthDifference >
                          0
                          ? "higher"
                          : monthDifference <
                            0
                            ? "lower"
                            : "the same as"}{" "}

                        last month.

                      </p>

                    </div>
                  )}

              </div>

              {/* CATEGORY */}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="mb-6">

                  <h3 className="text-lg font-semibold">
                    Monthly Category Breakdown
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Categories ranked by actual spending this month.
                  </p>

                </div>

                {monthCategories.length ===
                  0 ? (

                  <EmptyMessage
                    text="No expenses recorded this month."
                  />

                ) : (

                  <div className="space-y-5">

                    {monthCategories.map(
                      (
                        category
                      ) => {

                        const percentage =
                          monthSpent >
                            0
                            ? (
                              category.amount /
                              monthSpent
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

                              <span className="text-sm font-medium text-slate-700">
                                {
                                  category.category
                                }
                              </span>

                              <span className="text-sm font-semibold">
                                {formatMoney(
                                  category.amount,
                                  currency
                                )}

                                <span className="ml-2 text-xs text-slate-400">
                                  {percentage.toFixed(
                                    0
                                  )}
                                  %
                                </span>

                              </span>

                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">

                              <div
                                className="h-full rounded-full bg-slate-800"
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

              {/* MONTH EXPENSES */}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="mb-5">

                  <h3 className="text-lg font-semibold">
                    This Month's Expenses
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Every transaction recorded this month.
                  </p>

                </div>

                {monthExpenses.length ===
                  0 ? (

                  <EmptyMessage
                    text="No expenses recorded this month."
                  />

                ) : (

                  <div className="divide-y divide-slate-100">

                    {monthExpenses.map(
                      (
                        expense
                      ) => (

                        <ExpenseRow
                          key={
                            expense.id
                          }
                          expense={
                            expense
                          }
                          currency={
                            currency
                          }
                        />

                      )
                    )}

                  </div>

                )}

              </div>

            </section>
          )}

        {/* ==================================================
            CALENDAR VIEW
        ================================================== */}

        {!loading &&
          !error &&
          view === "calendar" && (
            <section>

              {/* CALENDAR HEADER */}

              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                <div>

                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Calendar
                  </p>

                  <h3 className="mt-1 text-2xl font-bold">
                    Spending Calendar
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Click a date to inspect that day's spending.
                  </p>

                </div>

                <div className="flex items-center gap-2">

                  <button
                    onClick={
                      goToToday
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Today
                  </button>

                </div>

              </div>

              {/* CALENDAR CARD */}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

                {/* MONTH NAV */}

                <div className="mb-6 flex items-center justify-between">

                  <button
                    onClick={
                      previousCalendarMonth
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
                  >

                    <ChevronLeft
                      size={17}
                    />

                  </button>

                  <h3 className="text-lg font-bold">

                    {new Intl.DateTimeFormat(
                      "en-IN",
                      {
                        month: "long",
                        year: "numeric",
                      }
                    ).format(
                      calendarDate
                    )}

                  </h3>

                  <button
                    onClick={
                      nextCalendarMonth
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
                  >

                    <ChevronRight
                      size={17}
                    />

                  </button>

                </div>

                {/* MONTH TOTAL */}

                <div className="mb-6 rounded-xl bg-slate-50 p-4">

                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Month Total
                  </p>

                  <p className="mt-1 text-xl font-bold">
                    {formatMoney(
                      calendarMonthSpent,
                      currency
                    )}
                  </p>

                </div>

                {/* WEEKDAYS */}

                <div className="mb-2 grid grid-cols-7">

                  {[
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thu",
                    "Fri",
                    "Sat",
                    "Sun",
                  ].map(
                    (day) => (
                      <div
                        key={day}
                        className="py-2 text-center text-xs font-semibold text-slate-400"
                      >
                        {day}
                      </div>
                    )
                  )}

                </div>

                {/* CALENDAR */}

                <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-2">

                  {calendarCells.map(
                    (
                      cell,
                      index
                    ) => {

                      if (!cell) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="min-h-[70px] sm:min-h-[100px]"
                          />
                        );
                      }

                      const isToday =
                        cell.key ===
                        `${today.getFullYear()}-${String(
                          today.getMonth() + 1
                        ).padStart(
                          2,
                          "0"
                        )}-${String(
                          today.getDate()
                        ).padStart(
                          2,
                          "0"
                        )}`;

                      const isSelected =
                        selectedDate ===
                        cell.key;

                      return (
                        <button
                          key={
                            cell.key
                          }
                          onClick={() =>
                            setSelectedDate(
                              cell.key
                            )
                          }
                          className={`min-w-0 min-h-[70px] overflow-hidden rounded-xl border p-1.5 text-left transition sm:min-h-[100px] sm:p-2 ${isSelected
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                        >

                          <div className="flex min-w-0 items-start justify-between gap-1">

                            <span
                              className={`min-w-0 text-xs font-semibold ${isSelected
                                ? "text-white"
                                : isToday
                                  ? "text-slate-950"
                                  : "text-slate-500"
                                }`}
                            >
                              {cell.day}
                            </span>

                            {isToday && (
                              <span
                                className={`shrink-0 rounded-full px-1 py-0.5 text-[8px] font-bold ${isSelected
                                  ? "bg-white/10 text-white"
                                  : "bg-slate-100 text-slate-600"
                                  }`}
                              >
                                TODAY
                              </span>
                            )}

                          </div>

                          {cell.amount >
                            0 && (
                              <div className="mt-3 min-w-0 sm:mt-4">

                                <p
                                  title={formatMoney(cell.amount, currency)}
                                  className={`min-w-0 truncate text-[10px] font-bold tracking-tight sm:text-sm ${isSelected
                                    ? "text-white"
                                    : "text-slate-900"
                                    }`}
                                >
                                  {formatMoney(
                                    cell.amount,
                                    currency
                                  )}
                                </p>

                                <p
                                  className={`mt-1 truncate text-[9px] ${isSelected
                                    ? "text-slate-400"
                                    : "text-slate-400"
                                    }`}
                                >
                                  {
                                    cell.expenses
                                      .length
                                  }{" "}
                                  expense
                                  {cell.expenses
                                    .length ===
                                    1
                                    ? ""
                                    : "s"}
                                </p>

                              </div>
                            )}

                        </button>
                      );
                    }
                  )}

                </div>

              </div>

              {/* ==================================================
                  SELECTED DATE
              ================================================== */}

              {selectedDate && (
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

                    <div>

                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Selected Date
                      </p>

                      <h3 className="mt-1 text-xl font-bold">
                        {formatDate(
                          selectedDate
                        )}
                      </h3>

                    </div>

                    <div className="text-left sm:text-right">

                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Day Total
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {formatMoney(
                          selectedDayTotal,
                          currency
                        )}
                      </p>

                    </div>

                  </div>

                  {selectedDayExpenses.length ===
                    0 ? (

                    <div className="rounded-xl bg-slate-50 p-6 text-center">

                      <p className="text-sm text-slate-500">
                        No expenses recorded on this day.
                      </p>

                    </div>

                  ) : (

                    <div className="divide-y divide-slate-100">

                      {selectedDayExpenses.map(
                        (
                          expense
                        ) => (

                          <ExpenseRow
                            key={
                              expense.id
                            }
                            expense={
                              expense
                            }
                            currency={
                              currency
                            }
                          />

                        )
                      )}

                    </div>

                  )}

                </section>
              )}

            </section>
          )}

        {/* ==================================================
            DATA NOTE
        ================================================== */}

        {!loading &&
          !error &&
          expenses.length > 0 && (
            <div className="mt-8 rounded-xl bg-slate-100 px-4 py-3 text-center">

              <p className="text-xs text-slate-500">
                All figures shown here are calculated
                from your recorded expenses. Real Cost
                does not invent spending data.
              </p>

            </div>
          )}

      </div>

    </main>
  );
}

/* ==================================================
   STAT CARD
================================================== */

function StatCard({
  label,
  value,
  subtext,
  icon,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">

          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p className="mt-2 truncate text-2xl font-bold text-slate-950">
            {value}
          </p>

        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">

          {icon}

        </div>

      </div>

      <p className="mt-3 truncate text-xs text-slate-500">
        {subtext}
      </p>

    </div>
  );
}

/* ==================================================
   EXPENSE ROW
================================================== */

function ExpenseRow({
  expense,
  currency,
}: {
  expense: Expense;
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">

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
            {getTitle(expense)}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2">

            <span className="text-xs text-slate-400">
              {expense.category ||
                "Uncategorized"}
            </span>

            <span className="text-slate-300">
              ·
            </span>

            <span className="text-xs text-slate-400">
              {expense.source ===
                "manual"
                ? "Kaccha Bill"
                : "Bill"}
            </span>

            {expense.expense_date && (
              <>
                <span className="text-slate-300">
                  ·
                </span>

                <span className="text-xs text-slate-400">
                  {formatDate(
                    expense.expense_date
                  )}
                </span>
              </>
            )}

          </div>

        </div>

      </div>

      <p className="shrink-0 text-sm font-bold text-slate-900">
        {formatMoney(
          getAmount(expense),
          expense.currency ||
          currency
        )}
      </p>

    </div>
  );
}

/* ==================================================
   EMPTY MESSAGE
================================================== */

function EmptyMessage({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-8 text-center">

      <p className="text-sm text-slate-500">
        {text}
      </p>

    </div>
  );
}