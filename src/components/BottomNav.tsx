"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Plan" },
  { href: "/grocery", label: "Grocery" },
  { href: "/saved", label: "Plans" },
  { href: "/settings", label: "Settings" }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 pb-5 pt-3 backdrop-blur md:left-1/2 md:max-w-md md:-translate-x-1/2 md:rounded-t-3xl md:border">
      <div className="mx-auto flex max-w-md items-center justify-around gap-3">
        {navItems.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[88px] flex-col items-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surfaceAlt hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
