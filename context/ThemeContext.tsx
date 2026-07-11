"use client";
import React, { createContext, useContext, useState } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem("nettmark.theme") as Theme | null;
    const storedSource = window.localStorage.getItem("nettmark.themeSource");
    if (storedSource === "manual" && (stored === "light" || stored === "dark")) {
      return stored;
    }
  } catch {
    // Some in-app browsers can deny storage access. Nettmark is dark-first,
    // so fail closed to the contrast-safe dark theme.
  }
  return "dark";
}

function persistManualTheme(theme: Theme) {
  try {
    window.localStorage.setItem("nettmark.theme", theme);
    window.localStorage.setItem("nettmark.themeSource", "manual");
  } catch {
    // Ignore storage failures; ThemeWrapper still applies the active theme.
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document !== "undefined") {
      if (document.documentElement.classList.contains("light")) return "light";
      if (document.documentElement.classList.contains("dark")) return "dark";
    }

    return getInitialTheme();
  });

  const setTheme = (next: Theme) => {
    setThemeState(next);
    persistManualTheme(next);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      persistManualTheme(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
