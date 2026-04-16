"use client";

import { ReactNode } from "react";
import { ThemeWatcher } from "@/components/ThemeWatcher";
import { AppStateProvider } from "@/lib/app-state";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <ThemeWatcher />
      {children}
    </AppStateProvider>
  );
}
