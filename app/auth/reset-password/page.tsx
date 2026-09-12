"use client";

import {
    FormEvent,
    useEffect,
    useState,
} from "react";
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
    const {
        darkMode,
        toggleTheme,
    } = useTheme();

    const [mounted, setMounted] =
        useState(false);

    const [ready, setReady] =
        useState(false);

    const [checking, setChecking] =
        useState(true);

    const [password, setPassword] =
        useState("");

    const [confirmPassword, setConfirmPassword] =
        useState("");

    const [showPassword, setShowPassword] =
        useState(false);

    const [showConfirmPassword, setShowConfirmPassword] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    const [success, setSuccess] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        let active = true;

        const {
            data: authListener,
        } =
            supabaseBrowser.auth.onAuthStateChange(
                (event, session) => {
                    if (!active) {
                        return;
                    }

                    if (
                        event === "PASSWORD_RECOVERY" &&
                        session
                    ) {
                        setReady(true);
                        setChecking(false);
                        setError(null);
                        return;
                    }

                    if (session) {
                        setReady(true);
                        setChecking(false);
                    }
                }
            );

        async function checkRecoverySession() {
            try {
                const {
                    data: { session },
                } =
                    await supabaseBrowser.auth.getSession();

                if (!active) {
                    return;
                }

                if (session) {
                    setReady(true);
                    setChecking(false);
                    return;
                }

                setChecking(false);
                setError(
                    "This password reset link is invalid or has expired. Please request a new reset email."
                );
            } catch {
                if (!active) {
                    return;
                }

                setChecking(false);
                setError(
                    "Could not verify the password reset session."
                );
            }
        }

        checkRecoverySession();

        return () => {
            active = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError(null);

        if (password.length < 6) {
            setError(
                "Password must be at least 6 characters."
            );
            return;
        }

        if (password !== confirmPassword) {
            setError(
                "Passwords do not match."
            );
            return;
        }

        setSaving(true);

        try {
            const {
                data: { session },
            } =
                await supabaseBrowser.auth.getSession();

            if (!session) {
                throw new Error(
                    "Your password reset session is no longer valid. Please request a new reset email."
                );
            }

            const {
                error: updateError,
            } =
                await supabaseBrowser.auth.updateUser({
                    password,
                });

            if (updateError) {
                throw new Error(
                    updateError.message
                );
            }

            setSuccess(true);

            window.setTimeout(() => {
                window.location.href = "/";
            }, 900);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not update your password."
            );
        } finally {
            setSaving(false);
        }
    }

    const pageClass =
        mounted && darkMode
            ? "auth-dark"
            : "auth-light";

    return (
        <main
            className={`min-h-screen ${pageClass} bg-slate-50 text-slate-900`}
        >
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
                    <Link
                        href="/"
                        className="flex min-w-0 items-center gap-3"
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                            <Receipt size={19} />
                        </div>

                        <div className="min-w-0">
                            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                                Real Cost
                            </h1>

                            <p className="text-xs text-slate-500 sm:text-sm">
                                Understand where your money goes.
                            </p>
                        </div>
                    </Link>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label="Toggle theme"
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                        >
                            {mounted && darkMode ? (
                                <Sun size={17} />
                            ) : (
                                <Moon size={17} />
                            )}
                        </button>

                        <Link
                            href="/"
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                            <ArrowLeft size={16} />
                            <span>Home</span>
                        </Link>
                    </div>
                </div>
            </header>

            <div className="flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-10 sm:px-6">
                <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                    {checking ? (
                        <div className="py-8 text-center">
                            <Loader2
                                size={28}
                                className="mx-auto animate-spin text-slate-600"
                            />

                            <p className="mt-4 text-sm font-medium text-slate-700">
                                Verifying your reset link...
                            </p>
                        </div>
                    ) : success ? (
                        <div className="py-8 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                ✓
                            </div>

                            <h2 className="mt-5 text-2xl font-bold">
                                Password updated
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                Your password has been changed successfully. Taking you into Real Cost...
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                    Real Cost Account
                                </p>

                                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                                    Reset your password
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                    Choose a new password for your Real Cost account.
                                </p>
                            </div>

                            {!ready && error ? (
                                <>
                                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                                        {error}
                                    </div>

                                    <Link
                                        href="/login"
                                        className="mt-5 flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                                    >
                                        Back to login
                                    </Link>
                                </>
                            ) : (
                                <form
                                    onSubmit={handleSubmit}
                                    className="space-y-5"
                                >
                                    <div>
                                        <label
                                            htmlFor="new-password"
                                            className="mb-2 block text-sm font-medium text-slate-800"
                                        >
                                            New password
                                        </label>

                                        <div className="relative">
                                            <input
                                                id="new-password"
                                                type={
                                                    showPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                autoComplete="new-password"
                                                value={password}
                                                onChange={(event) =>
                                                    setPassword(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="At least 6 characters"
                                                disabled={saving}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                                            />

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowPassword(
                                                        (current) =>
                                                            !current
                                                    )
                                                }
                                                disabled={saving}
                                                aria-label={
                                                    showPassword
                                                        ? "Hide password"
                                                        : "Show password"
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                            >
                                                {showPassword ? (
                                                    <EyeOff size={17} />
                                                ) : (
                                                    <Eye size={17} />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="confirm-password"
                                            className="mb-2 block text-sm font-medium text-slate-800"
                                        >
                                            Confirm new password
                                        </label>

                                        <div className="relative">
                                            <input
                                                id="confirm-password"
                                                type={
                                                    showConfirmPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                autoComplete="new-password"
                                                value={
                                                    confirmPassword
                                                }
                                                onChange={(event) =>
                                                    setConfirmPassword(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Enter the password again"
                                                disabled={saving}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                                            />

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowConfirmPassword(
                                                        (current) =>
                                                            !current
                                                    )
                                                }
                                                disabled={saving}
                                                aria-label={
                                                    showConfirmPassword
                                                        ? "Hide password"
                                                        : "Show password"
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff size={17} />
                                                ) : (
                                                    <Eye size={17} />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={
                                            saving || !ready
                                        }
                                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {saving && (
                                            <Loader2
                                                size={17}
                                                className="animate-spin"
                                            />
                                        )}

                                        Update password
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}