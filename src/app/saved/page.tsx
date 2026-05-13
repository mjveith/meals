"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { RecipeDetail } from "@/components/RecipeDetail";
import { CATEGORY_LABELS, MEAL_LABELS, PROTEIN_OPTIONS } from "@/lib/constants";
import { useAppState } from "@/lib/app-state";
import { formatDay, formatSavedAt } from "@/lib/date";
import { getAllRecipes, getRecipeMap } from "@/lib/meal-generator";
import {
  SAVED_WEEKS_PAGE_SIZE,
  getVisibleSavedWeeks,
  searchRecipeArchive
} from "@/lib/saved-archive";
import {
  getArchivedMealCount,
  getArchivedMealSlot,
  getEnabledArchivedMealTypes
} from "@/lib/saved-week";
import { GroceryItem, MealType, Recipe } from "@/types";

const proteinLabels = new Map(PROTEIN_OPTIONS.map((option) => [option.id, option.label]));

function ArchivedMealCard({
  mealType,
  recipeName,
  description,
  metadata,
  children
}: {
  mealType: MealType;
  recipeName: string;
  description: string;
  metadata?: string;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="rounded-[28px] border border-border bg-surface p-4 shadow-panel">
      <button type="button" onClick={() => setExpanded((current) => !current)} className="w-full text-left">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          {MEAL_LABELS[mealType]}
        </div>
        <h3 className="mt-2 text-lg font-semibold text-text">{recipeName}</h3>
        <p className="mt-2 text-sm text-muted">{description}</p>
        {metadata ? (
          <div className="mt-3 inline-flex rounded-full bg-surfaceAlt px-3 py-1 text-xs text-muted">
            {metadata}
          </div>
        ) : null}
      </button>
      {expanded ? children : null}
    </article>
  );
}

function RecipeArchiveCard({
  recipe,
  favorite,
  onToggleFavorite
}: {
  recipe: Recipe;
  favorite: boolean;
  onToggleFavorite: (recipeId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const primaryMealType = recipe.mealType[0] ?? "dinner";

  return (
    <article className="rounded-[28px] border border-border bg-surface p-4 shadow-panel">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => setExpanded((current) => !current)} className="flex-1 text-left">
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted">
            {recipe.mealType.map((mealType) => (
              <span key={`${recipe.id}-${mealType}`} className="rounded-full bg-surfaceAlt px-3 py-1">
                {MEAL_LABELS[mealType]}
              </span>
            ))}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-text">{recipe.name}</h3>
          <p className="mt-2 text-sm text-muted">{recipe.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
            <span className="rounded-full bg-surfaceAlt px-3 py-1">{recipe.cuisine}</span>
            <span className="rounded-full bg-surfaceAlt px-3 py-1">{recipe.prepTime + recipe.cookTime} min</span>
            {recipe.proteins.map((protein) => (
              <span key={`${recipe.id}-${protein}`} className="rounded-full bg-surfaceAlt px-3 py-1">
                {proteinLabels.get(protein) ?? protein}
              </span>
            ))}
            {"isCustom" in recipe && recipe.isCustom ? (
              <span className="rounded-full bg-accentSoft px-3 py-1 font-semibold text-text">Custom</span>
            ) : null}
          </div>
        </button>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${recipe.name}`}
          onClick={() => onToggleFavorite(recipe.id)}
          className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold transition ${
            favorite ? "bg-accent text-white" : "bg-surfaceAlt text-muted hover:text-accent"
          }`}
        >
          {favorite ? "★" : "☆"}
        </button>
      </div>
      {expanded ? <RecipeDetail recipe={recipe} mealType={primaryMealType} /> : null}
    </article>
  );
}

function ReadOnlyGrocerySection({ title, items }: { title: string; items: GroceryItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-[32px] border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-center justify-between rounded-3xl border border-border bg-canvas px-4 py-3 ${
              item.collected ? "opacity-50" : ""
            }`}
          >
            <div className={`font-medium ${item.collected ? "text-muted line-through" : "text-text"}`}>
              {item.isStaple ? "📌 " : ""}
              {item.name}
            </div>
            <div className="text-sm text-muted">
              {item.quantity} {item.unit}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SavedPageContent() {
  const {
    hydrated,
    customRecipes,
    preferences,
    savedWeeks,
    deleteSavedWeek,
    sectionOrder,
    toggleFavoriteRecipe
  } = useAppState();
  const recipeMap = useMemo(() => getRecipeMap(customRecipes), [customRecipes]);
  const allRecipes = useMemo(() => getAllRecipes(customRecipes), [customRecipes]);
  const [visibleSavedWeekCount, setVisibleSavedWeekCount] = useState(SAVED_WEEKS_PAGE_SIZE);
  const [archiveQuery, setArchiveQuery] = useState("");
  const visibleSavedWeeks = useMemo(
    () => getVisibleSavedWeeks(savedWeeks, visibleSavedWeekCount),
    [savedWeeks, visibleSavedWeekCount]
  );
  const remainingSavedWeeks = Math.max(savedWeeks.length - visibleSavedWeeks.length, 0);
  const filteredArchiveRecipes = useMemo(
    () => searchRecipeArchive(allRecipes, archiveQuery),
    [allRecipes, archiveQuery]
  );
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedId = searchParams.get("id");
  const selectedWeek = selectedId ? savedWeeks.find((week) => week.id === selectedId) ?? null : null;

  if (!hydrated) {
    return <main className="p-6 text-sm text-muted">Loading saved weeks...</main>;
  }

  if (selectedWeek) {
    const groupedGroceries = sectionOrder
      .map((category) => ({
        category,
        items: [
          ...selectedWeek.groceryList.filter((item) => item.category === category),
          ...selectedWeek.customGroceryItems
            .filter((item) => item.category === category)
            .map(
              (item) =>
                ({
                  key: item.id,
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit,
                  category: item.category,
                  isStaple: false,
                  collected: item.collected,
                  isCustom: true
                }) satisfies GroceryItem
            )
        ]
      }))
      .filter((section) => section.items.length > 0);

    return (
      <main className="space-y-6 p-4 pb-12">
        <section className="rounded-[32px] bg-gradient-to-br from-teal-200 via-cyan-100 to-sky-100 p-6 text-slate-900 shadow-panel dark:from-slate-800 dark:via-teal-900 dark:to-cyan-900 dark:text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.24em]">Saved</div>
          <h1 className="mt-3 text-3xl font-bold">{selectedWeek.label}</h1>
          <p className="mt-3 text-sm text-slate-800/80 dark:text-white/80">
            Saved {formatSavedAt(selectedWeek.savedAt)} · {getArchivedMealCount(selectedWeek)} meals
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push("/saved")}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              Back to saved
            </button>
            <button
              type="button"
              onClick={() => {
                deleteSavedWeek(selectedWeek.id);
                router.push("/saved");
              }}
              className="rounded-full border border-slate-900/20 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-white/20 dark:text-white"
            >
              Delete saved week
            </button>
          </div>
        </section>

        <section className="space-y-4">
          {selectedWeek.mealPlan.days.map((day) => {
            const formatted = formatDay(day.date);
            const enabledMeals = getEnabledArchivedMealTypes(day);

            if (enabledMeals.length === 0) {
              return null;
            }

            return (
              <section key={day.date} className="rounded-[32px] border border-border bg-surface p-4">
                <div>
                  <div className="text-xl font-semibold text-text">{formatted.weekday}</div>
                  <div className="text-sm text-muted">{formatted.label}</div>
                </div>
                <div className="mt-4 space-y-3">
                  {enabledMeals.map((mealType) => {
                    const recipeId = getArchivedMealSlot(day, mealType).recipeId;
                    const recipe = recipeId ? recipeMap.get(recipeId) : null;

                    return (
                      <ArchivedMealCard
                        key={`${day.date}-${mealType}-${recipeId ?? "missing"}`}
                        mealType={mealType}
                        recipeName={recipe?.name ?? "Recipe unavailable"}
                        description={recipe?.description ?? "This recipe is no longer available in the shared recipe set."}
                        metadata={recipe ? `${recipe.cuisine} · ${recipe.prepTime + recipe.cookTime} min` : undefined}
                      >
                        {recipe ? <RecipeDetail recipe={recipe} mealType={mealType} /> : null}
                      </ArchivedMealCard>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </section>

        {groupedGroceries.map(({ category, items }) => (
          <ReadOnlyGrocerySection key={category} title={CATEGORY_LABELS[category]} items={items} />
        ))}
      </main>
    );
  }

  return (
    <main className="space-y-6 p-4 pb-12">
      <section className="rounded-[32px] bg-gradient-to-br from-teal-200 via-cyan-100 to-sky-100 p-6 text-slate-900 shadow-panel dark:from-slate-800 dark:via-teal-900 dark:to-cyan-900 dark:text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.24em]">Saved</div>
        <h1 className="mt-3 text-3xl font-bold">Saved weeks</h1>
        <p className="mt-3 text-sm text-slate-800/80 dark:text-white/80">
          Finalized meal plans stay here as a shared archive.
        </p>
      </section>

      {savedWeeks.length > 0 ? (
        <section className="space-y-4">
          {visibleSavedWeeks.map((savedWeek) => (
            <Link
              key={savedWeek.id}
              href={`/saved?id=${savedWeek.id}`}
              className="block rounded-[32px] border border-border bg-surface p-5 shadow-panel transition hover:border-accent/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-text">{savedWeek.label}</h2>
                  <p className="mt-2 text-sm text-muted">Saved {formatSavedAt(savedWeek.savedAt)}</p>
                </div>
                <div className="rounded-full bg-surfaceAlt px-3 py-2 text-xs font-semibold text-muted">
                  {getArchivedMealCount(savedWeek)} meals
                </div>
              </div>
            </Link>
          ))}
          {remainingSavedWeeks > 0 ? (
            <button
              type="button"
              onClick={() => setVisibleSavedWeekCount((current) => current + SAVED_WEEKS_PAGE_SIZE)}
              className="w-full rounded-[28px] border border-dashed border-border bg-surface px-5 py-4 text-sm font-semibold text-text transition hover:border-accent hover:text-accent"
            >
              Show 5 more weeks ({remainingSavedWeeks} remaining)
            </button>
          ) : null}
        </section>
      ) : (
        <section className="rounded-[32px] border border-dashed border-border bg-surface p-6 text-sm text-muted">
          Save a week from the Plan page to build your archive.
        </section>
      )}

      <section className="rounded-[32px] border border-border bg-surface p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Recipes</div>
            <h2 className="mt-2 text-2xl font-semibold text-text">Recipe archive</h2>
            <p className="mt-2 text-sm text-muted">
              Search the full Meals recipe library, including your custom recipes.
            </p>
          </div>
          <div className="rounded-full bg-surfaceAlt px-3 py-2 text-xs font-semibold text-muted">
            {allRecipes.length} recipes
          </div>
        </div>

        <label className="mt-4 block">
          <span className="sr-only">Search the recipe archive</span>
          <input
            type="search"
            value={archiveQuery}
            onChange={(event) => setArchiveQuery(event.target.value)}
            placeholder="Search recipes, cuisines, proteins, or ingredients"
            className="w-full rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>

        <div className="mt-3 text-xs text-muted">
          {filteredArchiveRecipes.length} recipe{filteredArchiveRecipes.length !== 1 ? "s" : ""}
          {archiveQuery.trim() ? " matched your search." : " ready to browse."}
        </div>

        <div className="mt-4 space-y-3">
          {filteredArchiveRecipes.length > 0 ? (
            filteredArchiveRecipes.map((recipe) => (
              <RecipeArchiveCard
                key={recipe.id}
                recipe={recipe}
                favorite={preferences.favoriteRecipeIds.includes(recipe.id)}
                onToggleFavorite={toggleFavoriteRecipe}
              />
            ))
          ) : (
            <div className="rounded-[28px] border border-dashed border-border bg-canvas px-4 py-5 text-sm text-muted">
              No recipes matched that search. Try a recipe name, cuisine, or ingredient.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function SavedPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-muted">Loading saved weeks...</main>}>
      <SavedPageContent />
    </Suspense>
  );
}
