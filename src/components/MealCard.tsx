"use client";

import { useMemo, useState } from "react";
import { CustomMealForm } from "@/components/CustomMealForm";
import { RecipeDetail } from "@/components/RecipeDetail";
import { usePreferencesState } from "@/lib/app-state";
import { MEAL_LABELS, PROTEIN_OPTIONS } from "@/lib/constants";
import { formatParticipationCount } from "@/lib/household";
import { CustomRecipe, Recipe, MealType, ProteinType } from "@/types";

interface SwapTargetOption {
  dayIndex: number;
  mealType: MealType;
  dayLabel: string;
  dateLabel: string;
  recipe: Recipe | null;
}

interface MealCardProps {
  dayLabel: string;
  mealType: MealType;
  recipe: Recipe;
  favorite: boolean;
  favoriteRecipeIds: string[];
  consumed: boolean;
  recipeOptions: Recipe[];
  swapTargets: SwapTargetOption[];
  onAssignRecipe: (recipeId: string) => Promise<boolean>;
  onSwapRecipe: (target: { dayIndex: number; mealType: MealType }) => Promise<boolean>;
  onRegenerate: (proteinOverride?: ProteinType | "any") => void;
  onToggleConsumed: () => void;
  onToggleFavorite: () => void;
  onCreateCustomMeal: (recipe: Omit<CustomRecipe, "id" | "isCustom">) => void | Promise<void>;
}

function buildSearchText(recipeOption: Recipe) {
  return [
    recipeOption.name,
    recipeOption.description,
    recipeOption.cuisine,
    ...recipeOption.ingredients.map((ingredient) => ingredient.name)
  ]
    .join(" ")
    .toLowerCase();
}

export function MealCard({
  dayLabel,
  mealType,
  recipe,
  favorite,
  favoriteRecipeIds,
  recipeOptions,
  swapTargets,
  consumed,
  onAssignRecipe,
  onSwapRecipe,
  onRegenerate,
  onToggleConsumed,
  onToggleFavorite,
  onCreateCustomMeal
}: MealCardProps) {
  const { getServingMultiplierForMeal } = usePreferencesState();
  const [expanded, setExpanded] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [assigningRecipeId, setAssigningRecipeId] = useState<string | null>(null);
  const [swappingTargetKey, setSwappingTargetKey] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const plannedServings = Math.round(recipe.servings * getServingMultiplierForMeal(mealType) * 100) / 100;
  const hasSwapTargets = swapTargets.length > 0;
  const favoriteRecipeIdSet = useMemo(() => new Set(favoriteRecipeIds), [favoriteRecipeIds]);
  const filteredRecipeOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);

    return recipeOptions
      .map((recipeOption) => {
        const searchText = buildSearchText(recipeOption);
        const name = recipeOption.name.toLowerCase();
        const isCurrent = recipeOption.id === recipe.id;
        const isFavoriteOption = favoriteRecipeIdSet.has(recipeOption.id);
        let score = isFavoriteOption ? 20 : 0;

        if (!query) {
          score += isCurrent ? 5 : 0;
          return { recipeOption, isCurrent, isFavoriteOption, score };
        }

        if (name === query) score += 500;
        else if (name.startsWith(query)) score += 300;
        else if (name.includes(query)) score += 180;
        else if (searchText.includes(query)) score += 120;

        const matchedTokens = tokens.filter((token) => searchText.includes(token)).length;
        if (matchedTokens === 0) {
          return null;
        }

        score += matchedTokens * 25;
        score += isCurrent ? 5 : 0;

        return { recipeOption, isCurrent, isFavoriteOption, score };
      })
      .filter((option): option is { recipeOption: Recipe; isCurrent: boolean; isFavoriteOption: boolean; score: number } => Boolean(option))
      .sort(
        (left, right) =>
          right.score - left.score ||
          Number(right.isFavoriteOption) - Number(left.isFavoriteOption) ||
          left.recipeOption.name.localeCompare(right.recipeOption.name)
      );
  }, [favoriteRecipeIdSet, recipe.id, recipeOptions, searchQuery]);

  return (
    <article className={`rounded-[28px] border p-4 shadow-panel ${consumed ? "border-slate-300 bg-surfaceAlt opacity-80" : "border-border bg-surface"}`}>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex-1 text-left"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
            {MEAL_LABELS[mealType]}
          </div>
          <h3 className={`mt-2 text-lg font-semibold text-text ${consumed ? "line-through" : ""}`}>{recipe.name}</h3>
          <p className="mt-2 text-sm text-muted">{recipe.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
            {consumed ? (
              <span className="rounded-full bg-slate-700 px-3 py-1 font-semibold text-white">
                Consumed
              </span>
            ) : null}
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
              Planned serves {formatParticipationCount(plannedServings)}
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
            disabled={consumed}
            onClick={() => {
              setPickerError(null);
              setShowSwapPicker(false);
              setSearchQuery("");
              setShowAssignPicker(true);
            }}
            className={`rounded-full bg-surfaceAlt px-3 py-2 text-xs font-semibold ${consumed ? "cursor-not-allowed text-muted" : "text-text"}`}
          >
            Change meal
          </button>
          <button
            type="button"
            disabled={consumed || !hasSwapTargets}
            onClick={() => {
              setPickerError(null);
              setShowAssignPicker(false);
              setShowSwapPicker(true);
            }}
            className={`rounded-full px-3 py-2 text-xs font-semibold ${
              !consumed && hasSwapTargets
                ? "bg-surfaceAlt text-text"
                : "cursor-not-allowed bg-surfaceAlt/70 text-muted"
            }`}
          >
            Swap meal
          </button>
          <button
            type="button"
            onClick={onToggleConsumed}
            className={`rounded-full px-3 py-2 text-xs font-semibold ${
              consumed ? "bg-slate-700 text-white" : "bg-surfaceAlt text-text"
            }`}
          >
            {consumed ? "Consumed" : "Mark consumed"}
          </button>
        </div>
      </div>

      {showAssignPicker && (
        <div className="mt-3 rounded-2xl border border-border bg-canvas p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            Assign {dayLabel} {MEAL_LABELS[mealType]}
          </div>
          <div className="text-sm text-muted">
            Search the recipe archive and tap any meal to place it in this slot.
          </div>

          <label className="mt-3 block">
            <span className="sr-only">Search recipe archive</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={`Search ${MEAL_LABELS[mealType].toLowerCase()} recipes`}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>

          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>
              {filteredRecipeOptions.length} match{filteredRecipeOptions.length !== 1 ? "es" : ""}
            </span>
            <span>Favorites rise to the top</span>
          </div>

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {filteredRecipeOptions.length > 0 ? (
              filteredRecipeOptions.map(({ recipeOption, isCurrent, isFavoriteOption }) => (
                <button
                  key={recipeOption.id}
                  type="button"
                  disabled={Boolean(assigningRecipeId)}
                  onClick={async () => {
                    if (isCurrent) {
                      setShowAssignPicker(false);
                      return;
                    }

                    setPickerError(null);
                    setAssigningRecipeId(recipeOption.id);

                    try {
                      const didAssign = await onAssignRecipe(recipeOption.id);
                      if (didAssign) {
                        setShowAssignPicker(false);
                        setSearchQuery("");
                      } else {
                        setPickerError("Couldn’t save that meal change. Try again.");
                      }
                    } finally {
                      setAssigningRecipeId(null);
                    }
                  }}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    isCurrent
                      ? "border-accent bg-accentSoft"
                      : "border-border bg-surface hover:border-accent hover:bg-accentSoft"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text">{recipeOption.name}</div>
                      <div className="mt-1 text-sm text-muted">{recipeOption.description}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                        <span className="rounded-full bg-surfaceAlt px-2.5 py-1">{recipeOption.cuisine}</span>
                        <span className="rounded-full bg-surfaceAlt px-2.5 py-1">
                          {recipeOption.prepTime + recipeOption.cookTime} min
                        </span>
                        {isFavoriteOption ? (
                          <span className="rounded-full bg-accent px-2.5 py-1 font-semibold text-white">
                            Favorite
                          </span>
                        ) : null}
                        {"isCustom" in recipeOption && recipeOption.isCustom ? (
                          <span className="rounded-full bg-accentSoft px-2.5 py-1 font-semibold text-text">
                            Custom
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="rounded-full bg-surfaceAlt px-3 py-1 text-xs font-semibold text-text">
                      {isCurrent ? "Current" : assigningRecipeId === recipeOption.id ? "Assigning..." : "Assign"}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-3 py-4 text-sm text-muted">
                No recipes matched that search. Try another name or ingredient.
              </div>
            )}
          </div>

          {pickerError ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {pickerError}
            </div>
          ) : null}

          <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-muted">
            Other options
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAssignPicker(false);
                onRegenerate("any");
              }}
              className="rounded-full border border-border bg-surfaceAlt px-3 py-1.5 text-sm font-medium text-text transition hover:bg-accent hover:text-white"
            >
              Regenerate any
            </button>
            {PROTEIN_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={consumed}
                onClick={() => {
                  setShowAssignPicker(false);
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
                setShowAssignPicker(false);
                setShowCustomForm(true);
              }}
              className="rounded-full border border-border bg-accentSoft px-3 py-1.5 text-sm font-medium text-text transition hover:bg-accent hover:text-white"
            >
              Custom meal
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowAssignPicker(false)}
            className="mt-2 text-xs text-muted underline"
          >
            Cancel
          </button>
        </div>
      )}

      {showSwapPicker && (
        <div className="mt-3 rounded-2xl border border-border bg-canvas p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            Swap {dayLabel} {MEAL_LABELS[mealType]}
          </div>
          <div className="text-sm text-muted">
            Swap with any unconsumed enabled slot, or move this meal into an empty slot.
          </div>

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {swapTargets.length > 0 ? (
              swapTargets.map((target) => (
                <button
                  key={`${target.dayIndex}-${target.mealType}-${target.recipe?.id ?? "empty"}`}
                  type="button"
                  disabled={Boolean(swappingTargetKey)}
                  onClick={async () => {
                    const targetKey = `${target.dayIndex}-${target.mealType}`;
                    setPickerError(null);
                    setSwappingTargetKey(targetKey);

                    try {
                      const didSwap = await onSwapRecipe({ dayIndex: target.dayIndex, mealType: target.mealType });
                      if (didSwap) {
                        setShowSwapPicker(false);
                      } else {
                        setPickerError("Couldn’t save that swap. Try again.");
                      }
                    } finally {
                      setSwappingTargetKey(null);
                    }
                  }}
                  className="w-full rounded-2xl border border-border bg-surface px-3 py-3 text-left transition hover:border-accent hover:bg-accentSoft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        {target.dayLabel} {target.dateLabel} • {MEAL_LABELS[target.mealType]}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-text">{target.recipe?.name ?? "Empty slot"}</div>
                      <div className="mt-1 text-sm text-muted">{target.recipe?.description ?? "Move this meal here and leave the original slot empty."}</div>
                      {target.recipe ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                          <span className="rounded-full bg-surfaceAlt px-2.5 py-1">{target.recipe.cuisine}</span>
                          <span className="rounded-full bg-surfaceAlt px-2.5 py-1">
                            {target.recipe.prepTime + target.recipe.cookTime} min
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                          <span className="rounded-full bg-surfaceAlt px-2.5 py-1">Empty</span>
                        </div>
                      )}
                    </div>
                    <span className="rounded-full bg-surfaceAlt px-3 py-1 text-xs font-semibold text-text">
                      {swappingTargetKey === `${target.dayIndex}-${target.mealType}` ? "Swapping..." : "Swap"}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-3 py-4 text-sm text-muted">
                No other unconsumed enabled slots are available for this meal right now.
              </div>
            )}
          </div>

          {pickerError ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {pickerError}
            </div>
          ) : null}

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
            submitLabel="Save and assign"
            initialMealType={mealType}
            onCancel={() => setShowCustomForm(false)}
            onSave={async (customRecipe) => {
              await onCreateCustomMeal(customRecipe);
              setShowCustomForm(false);
            }}
          />
        </div>
      ) : null}

      {expanded ? <RecipeDetail recipe={recipe} mealType={mealType} /> : null}
    </article>
  );
}
