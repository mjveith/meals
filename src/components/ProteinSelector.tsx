"use client";

import { PROTEIN_OPTIONS } from "@/lib/constants";
import { ProteinType } from "@/types";

interface ProteinSelectorProps {
  selected: ProteinType[];
  pinned: ProteinType[];
  onToggle: (protein: ProteinType) => void;
  onPin: (protein: ProteinType) => void;
}

export function ProteinSelector({
  selected,
  pinned,
  onToggle,
  onPin
}: ProteinSelectorProps) {
  return (
    <div className="grid gap-3">
      {PROTEIN_OPTIONS.map((protein) => {
        const isSelected = selected.includes(protein.id);
        const isPinned = pinned.includes(protein.id);

        return (
          <div
            key={protein.id}
            className={`flex items-center justify-between rounded-3xl border px-4 py-4 ${
              isSelected
                ? "border-accent bg-accentSoft text-text"
                : "border-border bg-surface text-text"
            }`}
          >
            <button
              type="button"
              onClick={() => onToggle(protein.id)}
              className="flex-1 text-left"
            >
              <div className="text-base font-semibold">{protein.label}</div>
              <div className="mt-1 text-sm text-muted">
                {isSelected ? "Included in generation" : "Tap to include"}
              </div>
            </button>
            <button
              type="button"
              aria-label={`Pin ${protein.label}`}
              onClick={() => onPin(protein.id)}
              className={`ml-3 rounded-full px-3 py-2 text-lg ${
                isPinned ? "bg-accent text-white" : "bg-surfaceAlt text-muted"
              }`}
            >
              ★
            </button>
          </div>
        );
      })}
    </div>
  );
}
