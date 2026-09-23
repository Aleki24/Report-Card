"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const DEFAULT_THEME: Theme = 'light';

// Holds only a theme the user explicitly picked with the toggle. The old
// 'theme' key was rewritten on every load, so it can't tell a real choice
// from the old dark default — it is dropped rather than migrated.
const STORAGE_KEY = 'skulbase-theme';
const LEGACY_STORAGE_KEY = 'theme';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: DEFAULT_THEME,
    toggleTheme: () => { },
});

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
            setTheme(stored);
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme, mounted]);

    const toggleTheme = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEY, next);
        setTheme(next);
    };

    // Prevent flash of wrong theme
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
