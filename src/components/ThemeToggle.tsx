"use client";

import { ThemePreference } from "@/types";

const options: ThemePreference[] = ["system", "light", "dark"];

export function ThemeToggle({
  value,
  onChange
}: {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-3xl bg-surfaceAlt p-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold capitalize ${
            value === option ? "bg-accent text-white" : "text-muted"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
