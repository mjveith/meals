"use client";

import { useEffect } from "react";
import { useAppState } from "@/lib/app-state";

export function ThemeWatcher() {
  const { preferences } = useAppState();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const isDark =
        preferences.theme === "dark" ||
        (preferences.theme === "system" && media.matches);

      document.documentElement.classList.toggle("dark", isDark);
    };

    applyTheme();
    media.addEventListener("change", applyTheme);

    return () => media.removeEventListener("change", applyTheme);
  }, [preferences.theme]);

  return null;
}
