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

export default function LoginPage() {
    const [mode, setMode] =
        useState<"login" | "signup">("login");

    const [email, setEmail] =
        useState("");

    const [password, setPassword] =
        useState("");

    const [showPassword, setShowPassword] =
        useState(false);

    const [loading, setLoading] =
        useState(false);

    const [message, setMessage] =
        useState<string | null>(null);

    const [error, setError] =
        useState<string | null>(null);

    const [mounted, setMounted] =
        useState(false);

    const {
        darkMode,
        toggleTheme,
    } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const normalizedEmail =
                email.trim().toLowerCase();

            if (!normalizedEmail || !password) {
                throw new Error(
                    "Please enter your email and password."
                );
            }

            if (password.length < 6) {
                throw new Error(
                    "Password must be at least 6 characters."
                );
            }

            if (mode === "login") {
                const {
                    error: signInError,
                } =
                    await supabaseBrowser.auth.signInWithPassword(
                        {
                            email: normalizedEmail,
                            password,
                        }
                    );

                if (signInError) {
                    throw new Error(
                        signInError.message
                    );
                }

                window.location.href = "/";
                return;
            }

            const {
                data,
                error: signUpError,
            } =
                await supabaseBrowser.auth.signUp({
                    email: normalizedEmail,
                    password,
                    options: {
                        emailRedirectTo:
                            `${window.location.origin}/auth/callback?next=/`,
                    },
                });

            if (signUpError) {
                throw new Error(
                    signUpError.message
                );
            }

            if (data.session) {
                window.location.href = "/";
                return;
            }

            setMessage(
                "Account created. Check your email and confirm your account. After confirmation, you'll be taken into Real Cost automatically."
            );

            setMode("login");
            setPassword("");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong."
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleForgotPassword() {
        setError(null);
        setMessage(null);

        const normalizedEmail =
            email.trim().toLowerCase();

        if (!normalizedEmail) {
            setError(
                "Enter your registered email first."
            );
            return;
        }

        setLoading(true);

        try {
            const {
                error: resetError,
            } =
                await supabaseBrowser.auth.resetPasswordForEmail(
                    normalizedEmail,
                    {
                        redirectTo:
                            `${window.location.origin}/auth/reset-password`,
                    }
                );

            if (resetError) {
                throw new Error(
                    resetError.message
                );
            }

            setMessage(
                "Password reset email sent. Open the email and use the reset link."
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not send the password reset email."
            );
        } finally {
            setLoading(false);
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
                    <div className="mb-6">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Real Cost Account
                        </p>

                        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                            {mode === "login"
                                ? "Welcome back"
                                : "Create your account"}
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            {mode === "login"
                                ? "Sign in to access your expenses, history and insights."
                                : "Create an account to keep your spending data tied to your own profile."}
                        </p>
                    </div>

                    <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setMode("login");
                                setError(null);
                                setMessage(null);
                            }}
                            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === "login"
                                ? "bg-slate-950 text-white shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                                }`}
                        >
                            Log in
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setMode("signup");
                                setError(null);
                                setMessage(null);
                            }}
                            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === "signup"
                                ? "bg-slate-950 text-white shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                                }`}
                        >
                            Sign up
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="space-y-5"
                    >
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-medium text-slate-800"
                            >
                                Email
                            </label>

                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                placeholder="you@example.com"
                                disabled={loading}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-slate-800"
                                >
                                    Password
                                </label>

                                {mode === "login" && (
                                    <button
                                        type="button"
                                        onClick={handleForgotPassword}
                                        disabled={loading}
                                        className="text-xs font-semibold text-slate-500 underline-offset-4 transition hover:text-slate-900 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Forgot password?
                                    </button>
                                )}
                            </div>

                            <div className="relative">
                                <input
                                    id="password"
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    autoComplete={
                                        mode === "login"
                                            ? "current-password"
                                            : "new-password"
                                    }
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(
                                            event.target.value
                                        )
                                    }
                                    placeholder="At least 6 characters"
                                    disabled={loading}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(
                                            (current) => !current
                                        )
                                    }
                                    disabled={loading}
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 disabled:opacity-50"
                                >
                                    {showPassword ? (
                                        <EyeOff size={17} />
                                    ) : (
                                        <Eye size={17} />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading && (
                                <Loader2
                                    size={17}
                                    className="animate-spin"
                                />
                            )}

                            {mode === "login"
                                ? "Log in"
                                : "Create account"}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs leading-5 text-slate-400">
                        Your account is used to keep your spending data tied to your own profile.
                    </p>
                </section>
            </div>
        </main>
    );
}