"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useTheme } from "@/components/theme-provider";

import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  Moon,
  PenLine,
  Receipt,
  Sun,
  Sparkles,
  Upload,
} from "lucide-react";

type BillItem = {
  name: string | null;
  category: string | null;
  hsn_sac: string | null;

  quantity: number | null;
  unit: string | null;

  unit_price: number | null;

  gross_amount: number | null;
  discount: number | null;

  taxable_value: number | null;

  gst_rate: number | null;

  cgst_rate: number | null;
  cgst_amount: number | null;

  sgst_rate: number | null;
  sgst_amount: number | null;

  igst_rate: number | null;
  igst_amount: number | null;

  cess_rate: number | null;
  cess_amount: number | null;

  other_charges: number | null;

  line_total: number | null;
};

type Invoice = {
  invoice_number: string | null;
  invoice_date: string | null;

  supplier_name: string | null;
  supplier_gstin: string | null;

  buyer_name: string | null;
  buyer_gstin: string | null;

  place_of_supply: string | null;
  currency: string | null;
};

type Totals = {
  total_gross_amount: number | null;
  total_discount: number | null;

  total_taxable_value: number | null;

  total_cgst: number | null;
  total_sgst: number | null;
  total_igst: number | null;
  total_cess: number | null;

  total_other_charges: number | null;

  round_off: number | null;

  total_invoice_value: number | null;

  amount_paid: number | null;
  change: number | null;
  amount_due: number | null;
};

type Validation = {
  calculated_item_total: number | null;

  calculated_cgst: number;
  calculated_sgst: number;
  calculated_igst: number;
  calculated_cess: number;

  calculated_tax_total: number;

  reported_invoice_total: number | null;

  difference_between_item_totals_and_invoice_total:
  | number
  | null;

  status:
  | "matched"
  | "difference_found"
  | "insufficient_data";
};

type Bill = {
  is_bill: boolean;
  confidence: number;
  reason: string | null;

  invoice: Invoice;

  purchase_type:
  | "ownership"
  | "consumable"
  | "service"
  | "unknown";

  items: BillItem[];

  totals: Totals;

  warranty: string | null;

  validation?: Validation;
};

type ApiResponse = {
  success: boolean;
  data?: Bill;

  error?: string;
  error_code?: string;

  is_bill?: boolean;
};

const PENDING_BILL_KEY = "real-cost-pending-bill";

const MANUAL_CATEGORIES = [
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

function displayValue(
  value:
    | string
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

export default function Home() {
  const [image, setImage] =
    useState<string | null>(null);

  const [fileName, setFileName] =
    useState("");

  const [bill, setBill] =
    useState<Bill | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [showBalancePrompt, setShowBalancePrompt] =
    useState(false);
  const [pendingExpenseId, setPendingExpenseId] =
    useState<string | null>(null);
  const [pendingExpenseAmount, setPendingExpenseAmount] =
    useState(0);
  const [balanceActionLoading, setBalanceActionLoading] =
    useState(false);
  const [balanceActionMessage, setBalanceActionMessage] =
    useState<string | null>(null);

  // ==================================================
  // CURRENT BALANCE
  // ==================================================

  const [currentBalance, setCurrentBalance] =
    useState<number | null>(null);
  const [balanceInput, setBalanceInput] =
    useState("");
  const [balanceMode, setBalanceMode] =
    useState<"add" | "setup">("add");
  const [balanceLoading, setBalanceLoading] =
    useState(false);
  const [balanceSaving, setBalanceSaving] =
    useState(false);
  const [balanceError, setBalanceError] =
    useState<string | null>(null);
  const [balanceSuccess, setBalanceSuccess] =
    useState<string | null>(null);

  // ==================================================
  // KACCHA BILL / MANUAL EXPENSE
  // ==================================================

  const [entryMode, setEntryMode] =
    useState<"bill" | "manual">("bill");

  const [manualAmount, setManualAmount] =
    useState("");

  const [manualCategory, setManualCategory] =
    useState("Food & Dining");

  const [manualDate, setManualDate] =
    useState(() =>
      new Date().toISOString().split("T")[0]
    );

  const [manualDescription, setManualDescription] =
    useState("");

  const [manualSaving, setManualSaving] =
    useState(false);

  const [manualSuccess, setManualSuccess] =
    useState(false);

  const { darkMode, toggleTheme } = useTheme();

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabaseBrowser.auth.getSession();

      if (!mounted) return;

      setSession(data.session);
      setAuthLoading(false);

      // Real Cost is a personal expense tracker.
      // Require authentication before allowing the app to be used.
      if (!data.session) {
        window.location.replace("/login?returnTo=/");
      }
    }

    loadSession();

    const { data: authListener } =
      supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
        if (!mounted) return;

        setSession(nextSession);
        setAuthLoading(false);

        if (!nextSession) {
          window.location.replace("/login?returnTo=/");
        }
      });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    async function loadBalance() {
      setBalanceLoading(true);
      setBalanceError(null);

      const { data, error } = await supabaseBrowser
        .from("user_balances")
        .select("balance")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setBalanceError(error.message);
      } else if (data) {
        const value = Number(data.balance);
        setCurrentBalance(Number.isFinite(value) ? value : null);
        setBalanceInput("");
      } else {
        setCurrentBalance(null);
        setBalanceInput("");
      }

      setBalanceLoading(false);
    }

    loadBalance();

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleSaveBalance() {
    const value = Number(balanceInput);

    if (!Number.isFinite(value) || value <= 0) {
      setBalanceError("Please enter an amount greater than ₹0.");
      setBalanceSuccess(null);
      return;
    }

    setBalanceSaving(true);
    setBalanceError(null);
    setBalanceSuccess(null);

    try {
      const rpcName =
        balanceMode === "add"
          ? "add_to_my_balance"
          : "set_my_balance";

      const { data, error } = await supabaseBrowser.rpc(
        rpcName,
        { p_balance: value }
      );

      if (error) {
        throw new Error(error.message);
      }

      const savedBalance = Number(data);

      if (!Number.isFinite(savedBalance)) {
        throw new Error("The balance returned by the database was invalid.");
      }

      setCurrentBalance(savedBalance);
      setBalanceInput("");
      setBalanceSuccess(
        balanceMode === "add"
          ? `Added ${formatMoney(value)}. Your balance is now ${formatMoney(savedBalance)}.`
          : `Balance replaced with ${formatMoney(savedBalance)}.`
      );

      window.setTimeout(() => {
        setBalanceSuccess(null);
      }, 2200);
    } catch (err) {
      setBalanceError(
        err instanceof Error
          ? err.message
          : "Could not update your balance."
      );
    } finally {
      setBalanceSaving(false);
    }
  }

  async function saveBillToHistory(
    billToSave: Bill,
    accessToken: string
  ) {
    const saveResponse = await fetch(
      "/api/save-expense",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          bill: billToSave,
        }),
      }
    );

    const saveResult = await saveResponse.json();

    if (!saveResponse.ok) {
      throw new Error(
        saveResult.error ||
        "Bill was analyzed but could not be saved."
      );
    }

    return saveResult;
  }

  useEffect(() => {
    if (!session) return;

    const pendingBill =
      window.localStorage.getItem(PENDING_BILL_KEY);

    if (!pendingBill) return;

    let parsedBill: Bill;

    try {
      parsedBill = JSON.parse(pendingBill) as Bill;
    } catch {
      window.localStorage.removeItem(PENDING_BILL_KEY);
      return;
    }

    let cancelled = false;

    async function savePendingBill() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { session: currentSession },
        } = await supabaseBrowser.auth.getSession();

        if (!currentSession) return;

        const saveResult = await saveBillToHistory(
          parsedBill,
          currentSession.access_token
        );

        if (cancelled) return;

        window.localStorage.removeItem(PENDING_BILL_KEY);
        setBill(parsedBill);

        console.log(
          "PENDING EXPENSE SAVED:",
          saveResult.expense_id
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Bill was analyzed but could not be saved."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    savePendingBill();

    return () => {
      cancelled = true;
    };
  }, [session]);


  async function handleBalanceDecision(shouldDeduct: boolean) {
    if (!pendingExpenseId) {
      setShowBalancePrompt(false);
      return;
    }

    if (!shouldDeduct) {
      setShowBalancePrompt(false);
      setPendingExpenseId(null);
      setPendingExpenseAmount(0);
      setBalanceActionMessage(null);
      return;
    }

    setBalanceActionLoading(true);
    setBalanceActionMessage(null);

    try {
      const { data, error } =
        await supabaseBrowser.rpc(
          "deduct_my_balance",
          {
            p_expense_id: pendingExpenseId,
            p_amount: pendingExpenseAmount,
          }
        );

      if (error) {
        throw new Error(error.message);
      }

      const updatedBalance = Number(data) || 0;
      setCurrentBalance(updatedBalance);
      setBalanceInput(String(updatedBalance));

      setBalanceActionMessage(
        `Balance updated to ${formatMoney(updatedBalance, currencyForBill())}.`
      );

      setTimeout(() => {
        setShowBalancePrompt(false);
        setPendingExpenseId(null);
        setPendingExpenseAmount(0);
        setBalanceActionMessage(null);
      }, 900);
    } catch (err) {
      setBalanceActionMessage(
        err instanceof Error
          ? err.message
          : "Could not update your balance."
      );
    } finally {
      setBalanceActionLoading(false);
    }
  }

  function currencyForBill() {
    return bill?.invoice?.currency || "INR";
  }

  async function handleSaveManualExpense() {
    const amount = Number(manualAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid amount for the Kaccha Bill.");
      return;
    }

    if (!manualDate) {
      setError("Please select the expense date.");
      return;
    }

    if (!manualCategory) {
      setError("Please select a category.");
      return;
    }

    setManualSaving(true);
    setManualSuccess(false);
    setError(null);

    try {
      const {
        data: { session: currentSession },
      } = await supabaseBrowser.auth.getSession();

      if (!currentSession) {
        window.location.replace("/login?returnTo=/");
        return;
      }

      const response = await fetch(
        "/api/save-manual-expense",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({
            amount,
            category: manualCategory,
            expense_date: manualDate,
            description: manualDescription.trim() || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Kaccha Bill could not be saved."
        );
      }

      setManualSuccess(true);
      setManualAmount("");
      setManualDescription("");
      setManualDate(
        new Date().toISOString().split("T")[0]
      );

      // The Kaccha Bill is already saved to history.
      // Balance deduction is a separate user decision,
      // exactly like it is for a scanned bill.
      setPendingExpenseId(result.expense_id);
      setPendingExpenseAmount(amount);
      setBalanceActionMessage(null);
      setShowBalancePrompt(true);

      console.log(
        "KACCHA BILL SAVED:",
        result.expense_id
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Kaccha Bill could not be saved."
      );
    } finally {
      setManualSaving(false);
    }
  }

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    reset();
  }

  // ==================================================
  // UPLOAD IMAGE
  // ==================================================

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setError(
        "Please upload an image of a bill or invoice."
      );

      return;
    }

    setError(null);
    setBill(null);

    setFileName(file.name);

    const reader =
      new FileReader();

    reader.onload = () => {
      if (
        typeof reader.result ===
        "string"
      ) {
        setImage(
          reader.result
        );
      }
    };

    reader.readAsDataURL(file);
  }

  // ==================================================
  // ANALYZE + SAVE BILL
  // ==================================================

  async function analyzeBill() {
    if (!image) {
      setError(
        "Please upload a bill first."
      );

      return;
    }

    setLoading(true);
    setError(null);
    setBill(null);

    try {
      // ============================================
      // STEP 1 — CHECK SESSION FIRST
      // ============================================
      // Do this BEFORE calling Gemini so an unauthenticated
      // user is sent to login immediately instead of waiting
      // for the AI analysis to finish.
      const {
        data: { session: currentSession },
      } = await supabaseBrowser.auth.getSession();

      if (!currentSession) {
        setLoading(false);
        window.location.replace("/login?returnTo=/");
        return;
      }

      // ============================================
      // STEP 2 — ANALYZE BILL WITH GEMINI
      // ============================================

      const response =
        await fetch(
          "/api/analyze",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              image,
            }),
          }
        );

      const result: ApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Failed to analyze the bill."
        );
      }

      if (
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.error ||
          "Could not analyze the bill."
        );
      }

      const analyzedBill =
        result.data;

      // ============================================
      // STEP 3 — SAVE EXPENSE
      // ============================================

      const saveResult = await saveBillToHistory(
        analyzedBill,
        currentSession.access_token
      );

      // ============================================
      // STEP 5 — SHOW RESULT
      // ============================================

      window.localStorage.removeItem(PENDING_BILL_KEY);
      setBill(analyzedBill);

      // The expense is always saved to history first.
      // Balance deduction is a separate user decision.
      setPendingExpenseId(saveResult.expense_id);
      setPendingExpenseAmount(
        Number(analyzedBill.totals.total_invoice_value) || 0
      );
      setBalanceActionMessage(null);
      setShowBalancePrompt(true);

      console.log(
        "EXPENSE SAVED:",
        saveResult.expense_id
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the bill."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==================================================
  // RESET
  // ==================================================

  function reset() {
    setImage(null);
    setFileName("");
    setBill(null);
    setError(null);
    setEntryMode("bill");
    setManualAmount("");
    setManualDescription("");
    setManualSuccess(false);
  }

  // ==================================================
  // TAX CHECK
  // ==================================================

  function hasTax(
    item: BillItem
  ) {
    return (
      item.cgst_amount !== null ||
      item.sgst_amount !== null ||
      item.igst_amount !== null ||
      item.cess_amount !== null
    );
  }

  const currency =
    bill?.invoice?.currency ||
    "INR";

  // Do not render the expense app before the authentication
  // check completes. This prevents an unauthenticated user
  // from seeing/interacting with the landing page while we
  // redirect them to login.
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <Loader2 size={18} className="animate-spin" />
          Checking your session...
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${darkMode ? "landing-dark" : "landing-light"} bg-slate-50 text-slate-900`}>

      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">

          <Link
            href="/"
            onClick={reset}
            className="flex shrink-0 items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Receipt size={21} />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Real Cost
              </h1>
              <p className="text-sm text-slate-500">
                Understand where your money goes.
              </p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/history"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              History
            </Link>

            <Link
              href="/insights"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <BarChart3 size={16} />
              <span>Insights</span>
            </Link>

            <Link
              href="/dashboard"
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:block"
            >
              Dashboard
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {!authLoading && (
              session ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <LogIn size={16} />
                  Sign in
                </Link>
              )
            )}

            {bill && (
              <button
                onClick={reset}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                New Bill
              </button>
            )}
          </nav>

        </div>
      </header>

      {/* ==================================================
          MAIN
      ================================================== */}

      <div className="mx-auto max-w-6xl px-6 py-10">

        {/* ==================================================
            CURRENT BALANCE
        ================================================== */}

        <section className="mx-auto mb-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Money Available
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {balanceLoading
                    ? "Loading balance..."
                    : currentBalance === null
                      ? "No balance set"
                      : formatMoney(currentBalance)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Manage the money you are currently tracking.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Current Balance
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {currentBalance === null
                    ? "Not set"
                    : formatMoney(currentBalance)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1">
                <button
                  type="button"
                  onClick={() => {
                    setBalanceMode("add");
                    setBalanceInput("");
                    setBalanceError(null);
                    setBalanceSuccess(null);
                  }}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${balanceMode === "add"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  Add Money
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBalanceMode("setup");
                    setBalanceInput("");
                    setBalanceError(null);
                    setBalanceSuccess(null);
                  }}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${balanceMode === "setup"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  Setup Money
                </button>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800">
                  {balanceMode === "add"
                    ? "Add money to your existing balance"
                    : "Replace your current balance"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {balanceMode === "add"
                    ? "The amount you enter will be added to the balance already tracked."
                    : "The amount you enter will replace the current tracked balance completely."}
                </p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <div className="flex flex-1 items-center rounded-xl border border-slate-200 bg-white px-3">
                    <span className="mr-2 text-sm font-semibold text-slate-400">₹</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={balanceInput}
                      onChange={(event) => {
                        setBalanceInput(event.target.value);
                        setBalanceError(null);
                        setBalanceSuccess(null);
                      }}
                      placeholder="Enter amount"
                      aria-label={
                        balanceMode === "add"
                          ? "Amount to add"
                          : "New balance amount"
                      }
                      className="w-full bg-transparent py-3 text-sm font-medium outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveBalance}
                    disabled={balanceSaving || balanceLoading}
                    className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {balanceSaving
                      ? "Saving..."
                      : balanceMode === "add"
                        ? "Add Money"
                        : "Setup Money"}
                  </button>
                </div>

                {balanceError && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {balanceError}
                  </p>
                )}

                {balanceSuccess && (
                  <p className="mt-2 text-xs font-medium text-emerald-600">
                    {balanceSuccess}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================
            UPLOAD SCREEN
        ================================================== */}

        {!bill && (
          <section className="mx-auto max-w-3xl">

            <div className="mb-8 text-center">

              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">

                <Sparkles
                  size={16}
                />

                AI-powered expense capture

              </div>

              <h2 className="text-4xl font-bold tracking-tight text-slate-950">
                Know where your
                <br />
                money actually goes.
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500">
                Upload a bill and we'll extract
                the purchase details, prices,
                taxes and totals automatically.
              </p>

            </div>

            {/* ==================================================
                ENTRY MODE
            ================================================== */}

            <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setEntryMode("bill");
                  setManualSuccess(false);
                  setError(null);
                }}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${entryMode === "bill"
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                <span className="block">Scan Bill</span>
                <span className={`mt-0.5 block text-xs font-normal ${entryMode === "bill"
                  ? "text-slate-300"
                  : "text-slate-400"
                  }`}>
                  AI extraction
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEntryMode("manual");
                  setBill(null);
                  setError(null);
                }}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${entryMode === "manual"
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <PenLine size={16} />
                  Kaccha Bill
                </span>
                <span className={`mt-0.5 block text-xs font-normal ${entryMode === "manual"
                  ? "text-slate-300"
                  : "text-slate-400"
                  }`}>
                  No bill available
                </span>
              </button>
            </div>

            {entryMode === "bill" ? (
              <>

                {/* UPLOAD CARD */}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  <label
                    htmlFor="bill-upload"
                    className="group block cursor-pointer"
                  >

                    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 transition group-hover:border-slate-400 group-hover:bg-slate-100">

                      {image ? (
                        <>
                          <img
                            src={image}
                            alt="Bill preview"
                            className="max-h-[260px] max-w-full rounded-lg object-contain shadow-sm"
                          />

                          <p className="mt-4 text-sm font-medium text-slate-700">
                            {fileName}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Click to choose another image
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                            <Upload
                              size={28}
                              className="text-slate-600"
                            />
                          </div>

                          <h3 className="text-lg font-semibold">
                            Upload your bill
                          </h3>

                          <p className="mt-2 max-w-sm text-center text-sm leading-6 text-slate-500">
                            Take a clear photo or upload
                            an image of your invoice,
                            receipt, or purchase bill.
                          </p>
                        </>
                      )}

                    </div>

                    <input
                      id="bill-upload"
                      type="file"
                      accept="image/*"
                      onChange={
                        handleFileChange
                      }
                      className="hidden"
                    />

                  </label>

                  {image && (
                    <button
                      onClick={
                        analyzeBill
                      }
                      disabled={loading}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2
                            size={18}
                            className="animate-spin"
                          />

                          Analyzing invoice...
                        </>
                      ) : (
                        <>
                          <Sparkles
                            size={18}
                          />

                          Analyze Bill
                        </>
                      )}
                    </button>
                  )}

                </div>

              </>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                    <PenLine size={22} className="text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950">
                      Add a Kaccha Bill
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      No receipt? Record the expense directly with the amount, category, date and an optional note.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Amount
                    </label>
                    <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-white px-4">
                      <span className="mr-2 text-sm font-semibold text-slate-500">₹</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={manualAmount}
                        onChange={(event) => {
                          setManualAmount(event.target.value);
                          setManualSuccess(false);
                          setError(null);
                        }}
                        placeholder="0.00"
                        className="w-full bg-transparent py-3 text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Category
                    </label>
                    <select
                      value={manualCategory}
                      onChange={(event) => {
                        setManualCategory(event.target.value);
                        setManualSuccess(false);
                        setError(null);
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    >
                      {MANUAL_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Date
                    </label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(event) => {
                        setManualDate(event.target.value);
                        setManualSuccess(false);
                        setError(null);
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Description / Note <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={manualDescription}
                      onChange={(event) => {
                        setManualDescription(event.target.value);
                        setManualSuccess(false);
                        setError(null);
                      }}
                      placeholder="e.g. Lunch with friends"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveManualExpense}
                  disabled={manualSaving}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {manualSaving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving Kaccha Bill...
                    </>
                  ) : (
                    <>
                      <PenLine size={18} />
                      Save Kaccha Bill
                    </>
                  )}
                </button>

                {manualSuccess && (
                  <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    <CheckCircle2 size={17} />
                    Kaccha Bill saved successfully to your expense history.
                  </div>
                )}
              </section>
            )}

            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {error}
                </span>

              </div>
            )}

          </section>
        )}

        {/* ==================================================
            RESULTS
        ================================================== */}

        {bill && (
          <div className="space-y-8">

            {/* ==================================================
                SUCCESS HEADER
            ================================================== */}

            <section>

              <div className="mb-6 flex items-start justify-between gap-6">

                <div>

                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-600">

                    <CheckCircle2
                      size={17}
                    />

                    Bill analyzed successfully

                  </div>

                  <h2 className="text-3xl font-bold tracking-tight">
                    {bill.invoice
                      .supplier_name ||
                      "Purchase"}
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Analysis confidence:{" "}
                    {Math.round(
                      (bill.confidence ||
                        0) *
                      100
                    )}
                    %
                  </p>

                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">

                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Purchase Type
                  </p>

                  <p className="mt-1 font-semibold capitalize">
                    {bill.purchase_type}
                  </p>

                </div>

              </div>

            </section>

            {/* ==================================================
                INVOICE INFORMATION
            ================================================== */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-5 flex items-center gap-3">

                <FileText
                  size={20}
                  className="text-slate-600"
                />

                <h3 className="text-lg font-semibold">
                  Invoice Information
                </h3>

              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                <Info
                  label="Invoice Number"
                  value={
                    bill.invoice
                      .invoice_number
                  }
                />

                <Info
                  label="Invoice Date"
                  value={
                    bill.invoice
                      .invoice_date
                  }
                />

                <Info
                  label="Supplier"
                  value={
                    bill.invoice
                      .supplier_name
                  }
                />

                <Info
                  label="Currency"
                  value={
                    bill.invoice
                      .currency
                  }
                />

                <Info
                  label="Supplier GSTIN"
                  value={
                    bill.invoice
                      .supplier_gstin
                  }
                />

                <Info
                  label="Buyer"
                  value={
                    bill.invoice
                      .buyer_name
                  }
                />

                <Info
                  label="Buyer GSTIN"
                  value={
                    bill.invoice
                      .buyer_gstin
                  }
                />

                <Info
                  label="Place of Supply"
                  value={
                    bill.invoice
                      .place_of_supply
                  }
                />

              </div>

            </section>

            {/* ==================================================
                ITEMS
            ================================================== */}

            <section>

              <div className="mb-4">

                <h3 className="text-xl font-bold">
                  Purchased Items
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Every item extracted from the invoice.
                </p>

              </div>

              <div className="space-y-4">

                {bill.items.map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                    >

                      <div className="flex flex-col justify-between gap-5 sm:flex-row">

                        <div>

                          <p className="text-lg font-semibold">
                            {item.name ||
                              "Unnamed item"}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs">

                            {item.category && (
                              <Badge>
                                {
                                  item.category
                                }
                              </Badge>
                            )}

                            {item.hsn_sac && (
                              <Badge>
                                HSN/SAC:{" "}
                                {
                                  item.hsn_sac
                                }
                              </Badge>
                            )}

                          </div>

                        </div>

                        <div className="text-left sm:text-right">

                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            Line Total
                          </p>

                          <p className="mt-1 text-2xl font-bold">
                            {formatMoney(
                              item.line_total,
                              currency
                            )}
                          </p>

                        </div>

                      </div>

                      {/* ITEM DETAILS */}

                      <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">

                        <Info
                          label="Quantity"
                          value={
                            item.quantity !==
                              null
                              ? `${item.quantity}${item.unit
                                ? ` ${item.unit}`
                                : ""
                              }`
                              : null
                          }
                        />

                        <MoneyInfo
                          label="Unit Price"
                          value={
                            item.unit_price
                          }
                          currency={
                            currency
                          }
                        />

                        <MoneyInfo
                          label="Gross Amount"
                          value={
                            item.gross_amount
                          }
                          currency={
                            currency
                          }
                        />

                        <MoneyInfo
                          label="Taxable Value"
                          value={
                            item.taxable_value
                          }
                          currency={
                            currency
                          }
                        />

                      </div>

                      {/* TAXES */}

                      {hasTax(item) && (
                        <div className="mt-6 rounded-xl bg-slate-50 p-5">

                          <h4 className="mb-4 text-sm font-semibold">
                            Tax Breakdown
                          </h4>

                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                            <Tax
                              name="CGST"
                              rate={
                                item.cgst_rate
                              }
                              amount={
                                item.cgst_amount
                              }
                              currency={
                                currency
                              }
                            />

                            <Tax
                              name="SGST"
                              rate={
                                item.sgst_rate
                              }
                              amount={
                                item.sgst_amount
                              }
                              currency={
                                currency
                              }
                            />

                            <Tax
                              name="IGST"
                              rate={
                                item.igst_rate
                              }
                              amount={
                                item.igst_amount
                              }
                              currency={
                                currency
                              }
                            />

                            <Tax
                              name="Cess"
                              rate={
                                item.cess_rate
                              }
                              amount={
                                item.cess_amount
                              }
                              currency={
                                currency
                              }
                            />

                          </div>

                        </div>
                      )}

                      {item.discount !==
                        null && (
                          <div className="mt-4 text-sm text-slate-500">
                            Discount:{" "}
                            <span className="font-medium text-slate-700">
                              {formatMoney(
                                item.discount,
                                currency
                              )}
                            </span>
                          </div>
                        )}

                    </div>

                  )
                )}

              </div>

            </section>

            {/* ==================================================
                TOTALS
            ================================================== */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <h3 className="mb-5 text-lg font-semibold">
                Invoice Totals
              </h3>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                <MoneyInfo
                  label="Gross Amount"
                  value={
                    bill.totals
                      .total_gross_amount
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="Discount"
                  value={
                    bill.totals
                      .total_discount
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="Taxable Value"
                  value={
                    bill.totals
                      .total_taxable_value
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="CGST"
                  value={
                    bill.totals
                      .total_cgst
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="SGST"
                  value={
                    bill.totals
                      .total_sgst
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="IGST"
                  value={
                    bill.totals
                      .total_igst
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="Cess"
                  value={
                    bill.totals
                      .total_cess
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="Other Charges"
                  value={
                    bill.totals
                      .total_other_charges
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="Round Off"
                  value={
                    bill.totals
                      .round_off
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="Amount Paid"
                  value={
                    bill.totals
                      .amount_paid
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="Change"
                  value={
                    bill.totals
                      .change
                  }
                  currency={currency}
                />

                <MoneyInfo
                  label="Amount Due"
                  value={
                    bill.totals
                      .amount_due
                  }
                  currency={currency}
                />

              </div>

              <div className="mt-6 rounded-xl bg-slate-950 p-5 text-white">

                <p className="text-sm text-slate-400">
                  Printed Invoice Total
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {formatMoney(
                    bill.totals
                      .total_invoice_value,
                    currency
                  )}
                </p>

              </div>

            </section>

            {/* ==================================================
                RECONCILIATION
            ================================================== */}

            {bill.validation && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="mb-5">

                  <h3 className="text-lg font-semibold">
                    Invoice Reconciliation
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    We compare values that can be
                    mathematically derived with the
                    printed invoice total.
                  </p>

                </div>

                <div className="grid gap-4 sm:grid-cols-3">

                  <MoneyInfo
                    label="Calculated Invoice Total"
                    value={
                      bill.validation
                        .calculated_item_total
                    }
                    currency={currency}
                  />

                  <MoneyInfo
                    label="Printed Invoice Total"
                    value={
                      bill.validation
                        .reported_invoice_total
                    }
                    currency={currency}
                  />

                  <MoneyInfo
                    label="Difference"
                    value={
                      bill.validation
                        .difference_between_item_totals_and_invoice_total
                    }
                    currency={currency}
                  />

                </div>

                <div className="mt-5">

                  {bill.validation.status ===
                    "matched" && (
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">

                        <CheckCircle2
                          size={17}
                        />

                        The available item totals
                        reconcile with the printed
                        invoice total.

                      </div>
                    )}

                  {bill.validation.status ===
                    "difference_found" && (
                      <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">

                        <AlertCircle
                          size={17}
                          className="mt-0.5 shrink-0"
                        />

                        <span>
                          There is a difference between
                          the calculated item total and
                          the printed invoice total.
                          The application will not
                          silently correct it.
                        </span>

                      </div>
                    )}

                  {bill.validation.status ===
                    "insufficient_data" && (
                      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        There is not enough visible
                        information to perform a complete
                        reconciliation.
                      </div>
                    )}

                </div>

              </section>
            )}

            {/* ==================================================
                NEXT PRODUCT FEATURE PLACEHOLDER
            ================================================== */}

            <section className="rounded-2xl bg-slate-950 p-6 text-white">

              <div className="flex items-start gap-4">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">

                  <Sparkles
                    size={20}
                  />

                </div>

                <div>

                  <h3 className="text-xl font-bold">
                    Expense captured successfully
                  </h3>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    This purchase is ready to be saved
                    to your spending history. Once your
                    expense history grows, Real Cost will
                    be able to show spending patterns,
                    comparisons and opportunities to save.
                  </p>

                </div>

              </div>

            </section>

          </div>
        )}

      </div>

      {showBalancePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <Receipt size={20} />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Balance
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">
                  Subtract this expense from your balance?
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {formatMoney(
                    pendingExpenseAmount,
                    currencyForBill()
                  )} will be deducted only if you choose Yes. The expense is already saved in your history.
                </p>
              </div>
            </div>

            {balanceActionMessage && (
              <div className="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                {balanceActionMessage}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={balanceActionLoading}
                onClick={() => handleBalanceDecision(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                No
              </button>

              <button
                type="button"
                disabled={balanceActionLoading}
                onClick={() => handleBalanceDecision(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {balanceActionLoading && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Yes, subtract
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .landing-dark {
          background: #020617 !important;
          color: #f8fafc !important;
        }

        .landing-dark .bg-white {
          background-color: #0f172a !important;
        }

        .landing-dark .bg-slate-50 {
          background-color: #020617 !important;
        }

        .landing-dark .bg-slate-100 {
          background-color: #1e293b !important;
        }

        .landing-dark .border-slate-100,
        .landing-dark .border-slate-200,
        .landing-dark .border-slate-300 {
          border-color: #334155 !important;
        }

        .landing-dark .text-slate-950,
        .landing-dark .text-slate-900 {
          color: #f8fafc !important;
        }

        .landing-dark .text-slate-800,
        .landing-dark .text-slate-700 {
          color: #e2e8f0 !important;
        }

        .landing-dark .text-slate-600,
        .landing-dark .text-slate-500 {
          color: #94a3b8 !important;
        }

        .landing-dark .text-slate-400 {
          color: #64748b !important;
        }

        .landing-dark .bg-slate-950 {
          background-color: #f8fafc !important;
          color: #020617 !important;
        }

        .landing-dark .bg-slate-800 {
          background-color: #cbd5e1 !important;
          color: #020617 !important;
        }

        .landing-dark .hover\:bg-slate-50:hover {
          background-color: #1e293b !important;
        }

        .landing-dark .hover\:bg-slate-100:hover {
          background-color: #334155 !important;
        }

        .landing-dark .hover\:bg-slate-800:hover {
          background-color: #e2e8f0 !important;
        }
      `}</style>
    </main>
  );
}

/* ==================================================
   UI COMPONENTS
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

      <p className="mt-1 break-words text-sm font-medium text-slate-800">
        {displayValue(value)}
      </p>

    </div>
  );
}

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
    <div>

      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-800">
        {formatMoney(
          value,
          currency
        )}
      </p>

    </div>
  );
}

function Badge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
      {children}
    </span>
  );
}

function Tax({
  name,
  rate,
  amount,
  currency,
}: {
  name: string;
  rate: number | null;
  amount: number | null;
  currency: string;
}) {
  return (
    <div>

      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {name}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-800">
        {rate !== null
          ? `${rate}%`
          : "—"}
      </p>

      <p className="mt-0.5 text-xs text-slate-500">
        {formatMoney(
          amount,
          currency
        )}
      </p>

    </div>
  );
}