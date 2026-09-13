"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Moon, Receipt, Sun } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useTheme } from "@/components/theme-provider";

export default function LoginPage() {
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { darkMode, toggleTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    async function handleForgotPassword() {
        setError(null);
        setMessage(null);

        const trimmedEmail = email.trim();

        if (!trimmedEmail) {
            setError("Please enter your email address first.");
            return;
        }

        setLoading(true);

        try {
            const { error: resetError } =
                await supabaseBrowser.auth.resetPasswordForEmail(
                    trimmedEmail,
                    {
                        redirectTo:
                            `${window.location.origin}/auth/reset-password`,
                    }
                );

            if (resetError) {
                throw new Error(resetError.message);
            }

            setMessage(
                "If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder."
            );
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

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const trimmedEmail = email.trim();

            if (!trimmedEmail || !password) {
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
                const { error: signInError } =
                    await supabaseBrowser.auth.signInWithPassword({
                        email: trimmedEmail,
                        password,
                    });

                if (signInError) {
                    throw new Error(
                        "Email or password is incorrect. Please check your credentials and try again."
                    );
                }

                window.location.href = "/";
                return;
            }

            const { data, error: signUpError } =
                await supabaseBrowser.auth.signUp({
                    email: trimmedEmail,
                    password,
                    options: {
                        emailRedirectTo:
                            `${window.location.origin}/auth/callback?next=/`,
                    },
                });

            if (signUpError) {
                throw new Error(signUpError.message);
            }

            if (data.session) {
                window.location.href = "/";
                return;
            }

            const identities = data.user?.identities;

            const emailAlreadyRegistered =
                Array.isArray(identities) &&
                identities.length === 0;

            if (emailAlreadyRegistered) {
                setError(
                    "This email is already registered. Please choose a different email or sign in instead."
                );
                setMode("login");
                return;
            }

            setMessage(
                "Account created. A confirmation email has been sent to your email address. Please confirm your email, then sign in."
            );
            setMode("login");
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

    return (
        <main
            className={`min-h-screen ${mounted && darkMode
                ? "auth-dark"
                : "auth-light"
                } bg-slate-50 text-slate-900`}
        >
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3 rounded-xl">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                            <Receipt size={21} />
                        </div>

                        <div>
                            <p className="text-xl font-bold tracking-tight">
                                Real Cost
                            </p>

                            <p className="text-sm text-slate-500">
                                Understand where your money goes.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                    </div>
                </div>
            </header>

            <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl items-center justify-center px-6 py-10">
                <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                    <div className="mb-7">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Real Cost Account
                        </p>

                        <h1 className="mt-2 text-3xl font-bold tracking-tight">
                            {mode === "login"
                                ? "Welcome back"
                                : "Create your account"}
                        </h1>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            {mode === "login"
                                ? "Sign in to access your expenses, history and insights."
                                : "Create an account to securely save your spending history."}
                        </p>
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setMode("login");
                                setError(null);
                                setMessage(null);
                            }}
                            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === "login"
                                ? "bg-white text-slate-950 shadow-sm"
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
                                ? "bg-white text-slate-950 shadow-sm"
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
                                className="text-sm font-medium text-slate-700"
                            >
                                Email
                            </label>

                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                placeholder="you@example.com"
                                autoComplete="email"
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label
                                    htmlFor="password"
                                    className="text-sm font-medium text-slate-700"
                                >
                                    Password
                                </label>

                                {mode === "login" && (
                                    <button
                                        type="button"
                                        onClick={handleForgotPassword}
                                        disabled={loading}
                                        className="text-xs font-semibold text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Forgot password?
                                    </button>
                                )}
                            </div>

                            <div className="relative mt-2">
                                <input
                                    id="password"
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(
                                            event.target.value
                                        )
                                    }
                                    placeholder="At least 6 characters"
                                    autoComplete={
                                        mode === "login"
                                            ? "current-password"
                                            : "new-password"
                                    }
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

                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading && (
                                <Loader2
                                    size={18}
                                    className="animate-spin"
                                />
                            )}

                            {loading
                                ? "Please wait..."
                                : mode === "login"
                                    ? "Log in"
                                    : "Create account"}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs leading-5 text-slate-400">
                        Your account is used to keep your spending data tied to your own profile.
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

                .auth-dark .bg-slate-100 {
                    background-color: #1e293b !important;
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
