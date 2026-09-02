/**
 * Centralized Theme Store for application-wide Light / Dark theme management.
 * Persists user preference in localStorage and synchronizes both `.dark` class
 * and `data-theme="light|dark"` attributes on `<html>`.
 *
 * Light Theme: Green + White wellness visual identity.
 * Dark Theme: Deep Slate/Navy background + BLUE primary accent.
 */

import { create } from "zustand";

const getInitialTheme = () => {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem("app_theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch (e) {
    return "light";
  }
};

const applyThemeToDOM = (theme) => {
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
  }
};

// Apply immediately on module load
const initialTheme = getInitialTheme();
applyThemeToDOM(initialTheme);

const useThemeStore = create((set) => ({
  theme: initialTheme,

  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === "light" ? "dark" : "light";
      try {
        localStorage.setItem("app_theme", nextTheme);
      } catch (e) {}
      applyThemeToDOM(nextTheme);
      return { theme: nextTheme };
    });
  },

  setTheme: (theme) => {
    const validTheme = theme === "dark" ? "dark" : "light";
    try {
      localStorage.setItem("app_theme", validTheme);
    } catch (e) {}
    applyThemeToDOM(validTheme);
    set({ theme: validTheme });
  },
}));

export default useThemeStore;
