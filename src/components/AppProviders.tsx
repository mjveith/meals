"use client";

import { ReactNode, useEffect } from "react";
import { ThemeWatcher } from "@/components/ThemeWatcher";
import { AppStateProvider } from "@/lib/app-state";

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <AppStateProvider>
      <ThemeWatcher />
      {children}
    </AppStateProvider>
  );
}
