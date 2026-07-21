"use client";

import { useMemo, useState } from "react";
import { CustomMealForm } from "@/components/CustomMealForm";
import { RecipeDetail } from "@/components/RecipeDetail";
import { usePreferencesState } from "@/lib/app-state";
import { MEAL_LABELS, PROTEIN_OPTIONS } from "@/lib/constants";
import { formatParticipationCount } from "@/lib/household";
import type { CustomRecipe, MealType, ProteinType, Recipe } from "@/types";

interface MealCardProps {
  mealType: MealType;
  recipe: Recipe;
  favorite: boolean;
  favoriteRecipeIds: string[];
  consumed: boolean;
  recipeOptions: Recipe[];
  onAssignRecipe: (recipeId: string) => Promise<boolean>;
  onRegenerate: (proteinOverride?: ProteinType | "any") => void;
  onToggleConsumed: () => void;
  onToggleFavorite: () => void;
  onCreateCustomMeal: (recipe: Omit<CustomRecipe, "id" | "isCustom">) => void | Promise<void>;
}

export function MealCard({ mealType, recipe, favorite, favoriteRecipeIds, consumed, recipeOptions, onAssignRecipe, onRegenerate, onToggleConsumed, onToggleFavorite, onCreateCustomMeal }: MealCardProps) {
  const { getServingMultiplierForMeal } = usePreferencesState();
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);
  const plannedServings = Math.round(recipe.servings * getServingMultiplierForMeal(mealType) * 100) / 100;
  const choices = useMemo(() => {
    const search = query.trim().toLowerCase();
    const favorites = new Set(favoriteRecipeIds);
    return recipeOptions.filter((candidate) => !search || [candidate.name, candidate.description, candidate.cuisine, ...candidate.ingredients.map((item) => item.name)].join(" ").toLowerCase().includes(search)).sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || a.name.localeCompare(b.name));
  }, [favoriteRecipeIds, query, recipeOptions]);

  return <article className={`rounded-[28px] border p-4 shadow-panel ${consumed ? "border-slate-300 bg-surfaceAlt opacity-80" : "border-border bg-surface"}`}>
    <div className="flex items-start justify-between gap-3">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex-1 text-left">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{MEAL_LABELS[mealType]}</div>
        <h3 className={`mt-2 text-lg font-semibold text-text ${consumed ? "line-through" : ""}`}>{recipe.name}</h3>
        <p className="mt-2 text-sm text-muted">{recipe.description}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          {consumed ? <span className="rounded-full bg-slate-700 px-3 py-1 font-semibold text-white">Consumed</span> : null}
          {"isCustom" in recipe && recipe.isCustom ? <span className="rounded-full bg-accentSoft px-3 py-1 font-semibold text-text">Custom</span> : null}
          <span className="rounded-full bg-surfaceAlt px-3 py-1">{recipe.prepTime + recipe.cookTime} min</span><span className="rounded-full bg-surfaceAlt px-3 py-1">{recipe.cuisine}</span><span className="rounded-full bg-surfaceAlt px-3 py-1">Planned serves {formatParticipationCount(plannedServings)}</span>
        </div>
      </button>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onToggleFavorite} className={`rounded-full px-3 py-2 text-lg ${favorite ? "bg-accent text-white" : "bg-surfaceAlt text-muted"}`} aria-label="Toggle favorite meal">★</button>
        <button type="button" disabled={consumed} onClick={() => setPickerOpen(true)} className="rounded-full bg-surfaceAlt px-3 py-2 text-xs font-semibold text-text disabled:cursor-not-allowed disabled:text-muted">Change meal</button>
        <button type="button" onClick={onToggleConsumed} className={`rounded-full px-3 py-2 text-xs font-semibold ${consumed ? "bg-slate-700 text-white" : "bg-surfaceAlt text-text"}`}>{consumed ? "Undo" : "Mark consumed"}</button>
      </div>
    </div>
    {pickerOpen && !consumed ? <div className="mt-3 rounded-2xl border border-border bg-canvas p-3">
      <div className="text-sm font-semibold text-text">Choose a {MEAL_LABELS[mealType].toLowerCase()} meal</div><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes" className="mt-3 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm" />
      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{choices.map((candidate) => <button key={candidate.id} type="button" disabled={Boolean(assigning)} onClick={async () => { if (candidate.id === recipe.id) return setPickerOpen(false); setAssigning(candidate.id); if (await onAssignRecipe(candidate.id)) setPickerOpen(false); setAssigning(null); }} className="w-full rounded-2xl border border-border bg-surface px-3 py-2 text-left text-sm"><b>{candidate.name}</b>{candidate.id === recipe.id ? " · Current" : assigning === candidate.id ? " · Assigning…" : ""}</button>)}</div>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setPickerOpen(false); onRegenerate("any"); }} className="rounded-full bg-surfaceAlt px-3 py-2 text-sm">Regenerate any</button>{PROTEIN_OPTIONS.map((option) => <button key={option.id} type="button" onClick={() => { setPickerOpen(false); onRegenerate(option.id); }} className="rounded-full bg-surfaceAlt px-3 py-2 text-sm">{option.label}</button>)}<button type="button" onClick={() => { setPickerOpen(false); setCustomOpen(true); }} className="rounded-full bg-accentSoft px-3 py-2 text-sm">Custom meal</button></div>
    </div> : null}
    {customOpen && !consumed ? <div className="mt-3"><CustomMealForm title={`Custom ${MEAL_LABELS[mealType]}`} submitLabel="Save and assign" initialMealType={mealType} onCancel={() => setCustomOpen(false)} onSave={async (customRecipe) => { await onCreateCustomMeal(customRecipe); setCustomOpen(false); }} /></div> : null}
    {expanded ? <RecipeDetail recipe={recipe} mealType={mealType} /> : null}
  </article>;
}
