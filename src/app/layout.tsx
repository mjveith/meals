import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { AppProviders } from "@/components/AppProviders";
import { ThemeScript } from "@/components/ThemeScript";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meals",
  description: "Meal planner and grocery list",
  applicationName: "Meals",
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-canvas text-text antialiased">
        <ThemeScript />
        <AppProviders>
          <div className="mx-auto min-h-screen max-w-md bg-canvas pb-28">
            {children}
          </div>
          <BottomNav />
        </AppProviders>
      </body>
    </html>
  );
}
