"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

type ThemeContextValue = {
  isHydrated: boolean;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const documentTheme = root.dataset.theme;
    const initialTheme =
      documentTheme === "light" || documentTheme === "dark" ? documentTheme : DEFAULT_THEME;

    setThemeState(initialTheme);
    root.dataset.theme = initialTheme;
    root.style.colorScheme = initialTheme;
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [isHydrated, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      isHydrated,
      theme,
      setTheme: setThemeState,
      toggleTheme: () => {
        setThemeState((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
      },
    }),
    [isHydrated, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
