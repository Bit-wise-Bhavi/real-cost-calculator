"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Eye,
    EyeOff,
    Loader2,
    Moon,
    Receipt,
    Sun,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useTheme } from "@/components/theme-provider";

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] =
        useState("");

    const [showPassword, setShowPassword] =
        useState(false);
    const [showConfirmPassword, setShowConfirmPassword] =
        useState(false);

    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] =
        useState(true);

    const [message, setMessage] = useState<string | null>(
        null
    );
    const [error, setError] = useState<string | null>(
        null
    );

    const { darkMode, toggleTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);

        async function checkSession() {
            const { data } =
                await supabaseBrowser.auth.getSession();

            if (!data.session) {
                setError(
                    "This password reset link is invalid or has expired. Please request a new one."
                );
            }

            setCheckingSession(false);
        }

        checkSession();
    }, []);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError(null);
        setMessage(null);

        if (password.length < 6) {
            setError(
                "Password must be at least 6 characters."
            );
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } =
                await supabaseBrowser.auth.updateUser({
                    password,
                });

            if (updateError) {
                throw new Error(updateError.message);
            }

            setMessage(
                "Password updated successfully. Taking you to Real Cost..."
            );

            setPassword("");
            setConfirmPassword("");

            setTimeout(() => {
                window.location.href = "/";
            }, 900);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not update your password."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main
            className={`min-h-screen ${mounted && darkMode ? "auth-dark" : "auth-light"
                } bg-slate-50 text-slate-900`}
        >
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                    <Link
                        href="/"
                        className="flex min-w-0 items-center gap-3 rounded-xl"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                            <Receipt size={21} />
                        </div>

                        <div className="min-w-0">
                            <p className="text-xl font-bold tracking-tight">
                                Real Cost
                            </p>

                            <p className="hidden text-sm text-slate-500 sm:block">
                                Understand where your money goes.
                            </p>
                        </div>
                    </Link>

                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            aria-label="Toggle dark mode"
                        >
                            {mounted && darkMode ? (
                                <Sun size={17} />
                            ) : (
                                <Moon size={17} />
                            )}
                        </button>

                        <Link
                            href="/login"
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            <ArrowLeft size={16} />
                            <span className="hidden sm:inline">
                                Login
                            </span>
                        </Link>
                    </div>
                </div>
            </header>

            <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
                <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-7">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Account Security
                        </p>

                        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                            Reset your password
                        </h1>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Choose a new password for your Real Cost
                            account.
                        </p>
                    </div>

                    {checkingSession ? (
                        <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                            <Loader2
                                size={18}
                                className="animate-spin"
                            />
                            Checking reset link...
                        </div>
                    ) : (
                        <form
                            onSubmit={handleSubmit}
                            className="space-y-5"
                        >
                            <div>
                                <label
                                    htmlFor="new-password"
                                    className="text-sm font-medium text-slate-700"
                                >
                                    New password
                                </label>

                                <div className="relative mt-2">
                                    <input
                                        id="new-password"
                                        type={
                                            showPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        placeholder="At least 6 characters"
                                        autoComplete="new-password"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(
                                                (value) => !value
                                            )
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                        aria-label={
                                            showPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                    >
                                        {showPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="confirm-password"
                                    className="text-sm font-medium text-slate-700"
                                >
                                    Confirm new password
                                </label>

                                <div className="relative mt-2">
                                    <input
                                        id="confirm-password"
                                        type={
                                            showConfirmPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={confirmPassword}
                                        onChange={(event) =>
                                            setConfirmPassword(
                                                event.target.value
                                            )
                                        }
                                        placeholder="Enter your new password again"
                                        autoComplete="new-password"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowConfirmPassword(
                                                (value) => !value
                                            )
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                        aria-label={
                                            showConfirmPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                                    {error}
                                </div>
                            )}

                            {message && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-700">
                                    {message}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={
                                    loading ||
                                    !!error &&
                                    error.includes("reset link")
                                }
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading && (
                                    <Loader2
                                        size={18}
                                        className="animate-spin"
                                    />
                                )}

                                {loading
                                    ? "Updating password..."
                                    : "Update password"}
                            </button>
                        </form>
                    )}

                    <p className="mt-6 text-center text-xs leading-5 text-slate-400">
                        After updating your password, you'll be
                        signed in and returned to Real Cost.
                    </p>
                </section>
            </div>

            <style jsx global>{`
        .auth-dark {
          background: #020617 !important;
          color: #f8fafc !important;
        }

        .auth-dark .bg-white {
          background-color: #0f172a !important;
        }

        .auth-dark .bg-slate-50 {
          background-color: #020617 !important;
        }

        .auth-dark .border-slate-200 {
          border-color: #334155 !important;
        }

        .auth-dark .text-slate-950,
        .auth-dark .text-slate-900 {
          color: #f8fafc !important;
        }

        .auth-dark .text-slate-800,
        .auth-dark .text-slate-700 {
          color: #e2e8f0 !important;
        }

        .auth-dark .text-slate-600,
        .auth-dark .text-slate-500 {
          color: #94a3b8 !important;
        }

        .auth-dark .text-slate-400 {
          color: #64748b !important;
        }

        .auth-dark .bg-slate-950 {
          background-color: #f8fafc !important;
          color: #020617 !important;
        }

        .auth-dark input {
          background-color: #0f172a !important;
          color: #f8fafc !important;
          border-color: #334155 !important;
        }

        .auth-dark .hover\\:bg-slate-50:hover {
          background-color: #1e293b !important;
        }

        .auth-dark .hover\\:bg-slate-800:hover {
          background-color: #e2e8f0 !important;
        }
      `}</style>
        </main>
    );
}