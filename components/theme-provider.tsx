"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

const THEME_KEY = "real-cost-theme";

type ThemeContextType = {
    darkMode: boolean;
    toggleTheme: () => void;
};

const ThemeContext =
    createContext<ThemeContextType | null>(null);

export function ThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [darkMode, setDarkMode] =
        useState(false);

    useEffect(() => {
        const savedTheme =
            window.localStorage.getItem(
                THEME_KEY
            );

        const isDark =
            savedTheme === "dark";

        setDarkMode(isDark);

        document.documentElement.classList.toggle(
            "dark",
            isDark
        );
    }, []);

    function toggleTheme() {
        setDarkMode((current) => {
            const next = !current;

            window.localStorage.setItem(
                THEME_KEY,
                next ? "dark" : "light"
            );

            document.documentElement.classList.toggle(
                "dark",
                next
            );

            return next;
        });
    }

    return (
        <ThemeContext.Provider
            value={{
                darkMode,
                toggleTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context =
        useContext(ThemeContext);

    if (!context) {
        throw new Error(
            "useTheme must be used inside ThemeProvider"
        );
    }

    return context;
}