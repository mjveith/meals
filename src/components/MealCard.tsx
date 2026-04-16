"use client";

import { useState } from "react";
import { CustomMealForm } from "@/components/CustomMealForm";
import { RecipeDetail } from "@/components/RecipeDetail";
import { MEAL_LABELS, PROTEIN_OPTIONS } from "@/lib/constants";
import { CustomRecipe, Recipe, MealType, ProteinType } from "@/types";

interface SwapTarget {
  dayIndex: number;
  mealType: MealType;
  dayLabel: string;
  recipeName: string;
}

interface MealCardProps {
  dayLabel: string;
  mealType: MealType;
  recipe: Recipe;
  favorite: boolean;
  swapTargets: SwapTarget[];
  onSwap: (target: { dayIndex: number; mealType: MealType }) => void;
  onRegenerate: (proteinOverride?: ProteinType | "any") => void;
  onToggleFavorite: () => void;
  onCreateCustomMeal: (recipe: Omit<CustomRecipe, "id" | "isCustom">) => void | Promise<void>;
}

export function MealCard({
  dayLabel,
  mealType,
  recipe,
  favorite,
  swapTargets,
  onSwap,
  onRegenerate,
  onToggleFavorite,
  onCreateCustomMeal
}: MealCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);

  return (
    <article className="rounded-[28px] border border-border bg-surface p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex-1 text-left"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
            {MEAL_LABELS[mealType]}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-text">{recipe.name}</h3>
          <p className="mt-2 text-sm text-muted">{recipe.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
            {"isCustom" in recipe && recipe.isCustom ? (
              <span className="rounded-full bg-accentSoft px-3 py-1 font-semibold text-text">
                Custom
              </span>
            ) : null}
            <span className="rounded-full bg-surfaceAlt px-3 py-1">
              {recipe.prepTime + recipe.cookTime} min
            </span>
            <span className="rounded-full bg-surfaceAlt px-3 py-1">{recipe.cuisine}</span>
            <span className="rounded-full bg-surfaceAlt px-3 py-1">
              Serves {recipe.servings}
            </span>
          </div>
        </button>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`rounded-full px-3 py-2 text-lg ${
              favorite ? "bg-accent text-white" : "bg-surfaceAlt text-muted"
            }`}
            aria-label="Toggle favorite meal"
          >
            ★
          </button>
          <button
            type="button"
            onClick={() => setShowSwapPicker(true)}
            className="rounded-full bg-surfaceAlt px-3 py-2 text-xs font-semibold text-text"
          >
            Swap
          </button>
        </div>
      </div>

      {/* Protein picker overlay */}
      {showSwapPicker && (
        <div className="mt-3 rounded-2xl border border-border bg-canvas p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            Swap {dayLabel} {MEAL_LABELS[mealType]}
          </div>
          <div className="text-sm text-muted">
            Swap directly with another scheduled meal, or regenerate this slot instead.
          </div>

          <div className="mt-3 space-y-2">
            {swapTargets.length > 0 ? (
              swapTargets.map((target) => (
                <button
                  key={`${target.dayIndex}-${target.mealType}`}
                  type="button"
                  onClick={() => {
                    setShowSwapPicker(false);
                    onSwap({ dayIndex: target.dayIndex, mealType: target.mealType });
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-3 py-2 text-left transition hover:border-accent hover:bg-accentSoft"
                >
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      {target.dayLabel} {MEAL_LABELS[target.mealType]}
                    </span>
                    <span className="block text-sm font-medium text-text">{target.recipeName}</span>
                  </span>
                  <span className="text-xs font-semibold text-muted">Swap</span>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-3 py-3 text-sm text-muted">
                No other scheduled meals available to swap with.
              </div>
            )}
          </div>

          <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-muted">
            Quick regenerate
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowSwapPicker(false);
                onRegenerate("any");
              }}
              className="rounded-full border border-border bg-surfaceAlt px-3 py-1.5 text-sm font-medium text-text transition hover:bg-accent hover:text-white"
            >
              Any
            </button>
            {PROTEIN_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setShowSwapPicker(false);
                  onRegenerate(opt.id);
                }}
                className="rounded-full border border-border bg-surfaceAlt px-3 py-1.5 text-sm font-medium text-text transition hover:bg-accent hover:text-white"
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setShowSwapPicker(false);
                setShowCustomForm(true);
              }}
              className="rounded-full border border-border bg-accentSoft px-3 py-1.5 text-sm font-medium text-text transition hover:bg-accent hover:text-white"
            >
              Custom meal
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowSwapPicker(false)}
            className="mt-2 text-xs text-muted underline"
          >
            Cancel
          </button>
        </div>
      )}

      {showCustomForm ? (
        <div className="mt-3">
          <CustomMealForm
            title={`Custom ${MEAL_LABELS[mealType]}`}
            submitLabel="Save and swap"
            initialMealType={mealType}
            onCancel={() => setShowCustomForm(false)}
            onSave={async (customRecipe) => {
              await onCreateCustomMeal(customRecipe);
              setShowCustomForm(false);
            }}
          />
        </div>
      ) : null}

      {expanded ? <RecipeDetail recipe={recipe} /> : null}
    </article>
  );
}
