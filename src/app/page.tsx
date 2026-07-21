// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { MealCard } from "@/components/MealCard";
import { ProteinSelector } from "@/components/ProteinSelector";
import { useAppState } from "@/lib/app-state";
import { formatDay } from "@/lib/date";
import { getMealParticipationAvailability } from "@/lib/household";
import { getRecipeMap, getSafeRecipes, type DayConfig } from "@/lib/meal-generator";
import { BRUNCH_MODE_MEAL_TYPES, MEAL_LABELS, MEAL_TYPES, STANDARD_MEAL_TYPES } from "@/lib/constants";
import { MealType, ProteinType, Recipe } from "@/types";

const allMealTypes = MEAL_TYPES;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type SwapTargetOption = {
  dayIndex: number;
  mealType: MealType;
  dayLabel: string;
  dateLabel: string;
  recipe: Recipe | null;
};

function defaultDayConfigs(mealAvailability: Record<MealType, boolean>): DayConfig[] {
  return Array.from({ length: 7 }, () => ({
    enabled: mealAvailability.breakfast || mealAvailability.brunch || mealAvailability.lunch || mealAvailability.dinner,
    breakfast: mealAvailability.breakfast,
    brunch: mealAvailability.brunch,
    lunch: mealAvailability.lunch,
    dinner: mealAvailability.dinner
  }));
}

function PlanSetup({ onGenerate }: { onGenerate: (configs: DayConfig[]) => void }) {
  const {
    preferences,
    toggleProtein,
    toggleFavoriteProtein
  } = useAppState();
  const mealAvailability = useMemo(
    () => getMealParticipationAvailability(preferences.householdMembers),
    [preferences.householdMembers]
  );
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>(() => defaultDayConfigs(mealAvailability));
  const setupMealTypes = preferences.brunchMode ? BRUNCH_MODE_MEAL_TYPES : STANDARD_MEAL_TYPES;

  useEffect(() => {
    setDayConfigs((prev) =>
      prev.map((day) => {
        const breakfast = !preferences.brunchMode && day.breakfast && mealAvailability.breakfast;
        const brunch = preferences.brunchMode && day.brunch && mealAvailability.brunch;
        const lunch = !preferences.brunchMode && day.lunch && mealAvailability.lunch;
        const dinner = day.dinner && mealAvailability.dinner;
        const enabled = breakfast || brunch || lunch || dinner;

        if (day.enabled === enabled && day.breakfast === breakfast && day.brunch === brunch && day.lunch === lunch && day.dinner === dinner) {
          return day;
        }

        return { enabled, breakfast, brunch, lunch, dinner };
      })
    );
  }, [mealAvailability, preferences.brunchMode]);

  const toggleDay = (index: number) => {
    setDayConfigs((prev) => {
      const next = [...prev];
      const wasEnabled = next[index].enabled;
      next[index] = wasEnabled
        ? { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false }
        : {
            enabled: setupMealTypes.some((mealType) => mealAvailability[mealType]),
            breakfast: !preferences.brunchMode && mealAvailability.breakfast,
            brunch: preferences.brunchMode && mealAvailability.brunch,
            lunch: !preferences.brunchMode && mealAvailability.lunch,
            dinner: mealAvailability.dinner
          };
      return next;
    });
  };

  const toggleMealType = (index: number, meal: MealType) => {
    if (!mealAvailability[meal]) {
      return;
    }

    setDayConfigs((prev) => {
      const next = [...prev];
      const day = { ...next[index], [meal]: !next[index][meal] };
      // If at least one meal is on, day is enabled
      day.enabled = day.breakfast || day.brunch || day.lunch || day.dinner;
      next[index] = day;
      return next;
    });
  };

  const totalMeals = dayConfigs.reduce(
    (sum, d) => sum + setupMealTypes.reduce((count, mealType) => count + (d[mealType] ? 1 : 0), 0),
    0
  );

  const availableMealCount = setupMealTypes.filter((mealType) => mealAvailability[mealType]).length;

  const enabledDays = dayConfigs.filter((d) => d.enabled).length;

  return (
    <main className="space-y-6 p-4 pb-12">
      <section className="rounded-[32px] bg-gradient-to-br from-teal-200 via-cyan-100 to-sky-100 p-6 text-slate-900 shadow-panel dark:from-slate-800 dark:via-teal-900 dark:to-cyan-900 dark:text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.24em]">Meals</div>
        <h1 className="mt-3 text-3xl font-bold">Plan your week</h1>
        <p className="mt-3 max-w-sm text-sm text-slate-800/80 dark:text-white/80">
          Select which days and meals to include, choose your proteins, then generate.
        </p>
      </section>

      {/* Day selector */}
      <section className="rounded-[32px] border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-text">Days</h2>
        <p className="mt-1 text-sm text-muted">
          Tap a day to toggle it. Tap meal types to customize. Unavailable meals are hidden from generation.
        </p>
        <div className="mt-4 space-y-2">
          {DAY_LABELS.map((label, index) => {
            const config = dayConfigs[index];
            return (
              <div
                key={label}
                className={`rounded-2xl border p-3 transition ${
                  config.enabled
                    ? "border-accent/40 bg-canvas"
                    : "border-border bg-surfaceAlt opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleDay(index)}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
                        config.enabled
                          ? "bg-accent text-white"
                          : "bg-surfaceAlt text-muted"
                      }`}
                    >
                      {label.charAt(0)}
                    </div>
                    <span className={`text-sm font-semibold ${config.enabled ? "text-text" : "text-muted"}`}>
                      {label}
                    </span>
                  </button>
                  {config.enabled && (
                    <div className="flex gap-1.5">
                      {setupMealTypes.map((meal) => {
                        const available = mealAvailability[meal];

                        return (
                          <button
                            key={meal}
                            type="button"
                            onClick={() => toggleMealType(index, meal)}
                            disabled={!available}
                            title={available ? undefined : `${MEAL_LABELS[meal]} is unavailable for the current household`}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                              config[meal]
                                ? "bg-accent text-white"
                                : "bg-surfaceAlt text-muted"
                            } ${available ? "" : "cursor-not-allowed opacity-35"}`}
                          >
                            {meal.charAt(0).toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Protein selector */}
      <section className="rounded-[32px] border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-text">Proteins</h2>
        <p className="mt-1 text-sm text-muted">Which proteins to include in your meals.</p>
        <div className="mt-4">
          <ProteinSelector
            selected={preferences.selectedProteins}
            pinned={preferences.favoriteProteins}
            onToggle={toggleProtein}
            onPin={toggleFavoriteProtein}
          />
        </div>
      </section>

      {/* Generate button */}
      {availableMealCount === 0 ? (
        <div className="rounded-[32px] border border-border bg-surface p-4 text-sm text-muted">
          No meal types are currently enabled for the household. Add at least one meal in Settings to generate a plan.
        </div>
      ) : null}

      <button
        type="button"
        disabled={enabledDays === 0 || availableMealCount === 0}
        onClick={() => onGenerate(dayConfigs)}
        className="w-full rounded-full bg-accent px-5 py-4 text-base font-bold text-white shadow-lg transition disabled:opacity-40"
      >
        Generate {totalMeals} meals across {enabledDays} day{enabledDays !== 1 ? "s" : ""}
      </button>
    </main>
  );
}

export default function PlanPage() {
  const {
    preferences,
    mealPlan,
    customRecipes,
    hydrated,
    syncError,
    hasLoadedSharedState,
    regenerateWeek,
    regenerateMeal,
    assignRecipeToMeal,
    swapMeals,
    toggleMealEnabled,
    toggleMealConsumed,
    toggleFavoriteRecipe,
    generatePlan,
    clearPlan,
    addCustomRecipe,
    saveCurrentWeek,
    planSavedSinceLastChange
  } = useAppState();
  const recipeMap = useMemo(() => getRecipeMap(customRecipes, preferences.mealProfileId), [customRecipes, preferences.mealProfileId]);
  const recipeOptionsByMealType = useMemo(() => {
    const safeRecipes = getSafeRecipes(customRecipes, preferences.excludedIngredients, preferences.mealProfileId);

    return {
      breakfast: safeRecipes.filter((recipe) => recipe.mealType.includes("breakfast")),
      brunch: safeRecipes.filter((recipe) => recipe.mealType.some((type) => type === "brunch" || type === "breakfast" || type === "lunch")),
      lunch: safeRecipes.filter((recipe) => recipe.mealType.includes("lunch")),
      dinner: safeRecipes.filter((recipe) => recipe.mealType.includes("dinner"))
    };
  }, [customRecipes, preferences.excludedIngredients, preferences.mealProfileId]);
  const swapTargetsBySlot = useMemo<Record<string, SwapTargetOption[]>>(() => {
    if (!mealPlan) {
      return {};
    }

    const targetsBySlot: Record<string, SwapTargetOption[]> = {};

    mealPlan.days.forEach((sourceDay, sourceDayIndex) => {
      allMealTypes.forEach((sourceMealType) => {
        const sourceKey = `${sourceDayIndex}-${sourceMealType}`;
        const sourceSlot = sourceDay.meals[sourceMealType];
        const sourceRecipe = sourceSlot?.recipeId ? recipeMap.get(sourceSlot.recipeId) : null;

        if (!sourceSlot?.enabled || sourceSlot.consumed || !sourceRecipe) {
          targetsBySlot[sourceKey] = [];
          return;
        }

        const swapTargets: SwapTargetOption[] = [];

        mealPlan.days.forEach((targetDay, targetDayIndex) => {
          allMealTypes.forEach((targetMealType) => {
            if (sourceDayIndex === targetDayIndex && sourceMealType === targetMealType) {
              return;
            }

            const targetSlot = targetDay.meals[targetMealType];
            const targetRecipe = targetSlot?.recipeId ? recipeMap.get(targetSlot.recipeId) ?? null : null;

            if (!targetSlot?.enabled || targetSlot.consumed) {
              return;
            }

            const formattedTargetDay = formatDay(targetDay.date);

            swapTargets.push({
              dayIndex: targetDayIndex,
              mealType: targetMealType,
              dayLabel: formattedTargetDay.weekday,
              dateLabel: formattedTargetDay.label,
              recipe: targetRecipe
            });
          });
        });

        targetsBySlot[sourceKey] = swapTargets.sort(
          (left, right) =>
            left.dayIndex - right.dayIndex ||
            allMealTypes.indexOf(left.mealType) - allMealTypes.indexOf(right.mealType)
        );
      });
    });

    return targetsBySlot;
  }, [mealPlan, recipeMap]);
  const [showSetup, setShowSetup] = useState(false);
  const [isSavingWeek, setIsSavingWeek] = useState(false);
  const [pendingAction, setPendingAction] = useState<"regenerate" | "new" | null>(null);

  if (!hydrated) {
    return <main className="p-6 text-sm text-muted">Loading your plan...</main>;
  }

  if (!hasLoadedSharedState && syncError) {
    return (
      <main className="space-y-6 p-4 pb-12">
        <section className="rounded-[32px] bg-gradient-to-br from-amber-200 via-orange-100 to-rose-100 p-6 text-slate-900 shadow-panel dark:from-amber-900 dark:via-orange-950 dark:to-rose-950 dark:text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.24em]">Meals</div>
          <h1 className="mt-3 text-3xl font-bold">Couldn&apos;t load your saved plan</h1>
          <p className="mt-3 max-w-sm text-sm text-slate-800/80 dark:text-white/80">
            Your data does not look deleted, the app just couldn&apos;t reach shared state right now.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              Retry
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-700/80 dark:text-white/70">{syncError}</p>
        </section>
      </main>
    );
  }

  // Show setup screen if no plan exists or user requested it
  if (!mealPlan || showSetup) {
    return (
      <PlanSetup
        onGenerate={(configs) => {
          generatePlan(configs);
          setShowSetup(false);
        }}
      />
    );
  }

  const totalEnabledMeals = mealPlan.days.reduce(
    (count, day) => count + allMealTypes.filter((mealType) => day.meals[mealType]?.enabled).length,
    0
  );

  return (
    <main className="space-y-6 p-4 pb-12">
      <section className="rounded-[32px] bg-gradient-to-br from-teal-200 via-cyan-100 to-sky-100 p-6 text-slate-900 shadow-panel dark:from-slate-800 dark:via-teal-900 dark:to-cyan-900 dark:text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.24em]">Meals</div>
        <h1 className="mt-3 text-3xl font-bold">Weekly plan</h1>
        <p className="mt-3 max-w-sm text-sm text-slate-800/80 dark:text-white/80">
          {totalEnabledMeals} meals scheduled this week from{" "}
          {preferences.selectedProteins.length} selected protein groups.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={async () => {
              setIsSavingWeek(true);
              try {
                await saveCurrentWeek();
              } finally {
                setIsSavingWeek(false);
              }
            }}
            className="rounded-full bg-white/75 px-5 py-3 text-sm font-semibold text-slate-900 dark:bg-slate-900/70 dark:text-white"
          >
            {isSavingWeek ? "Saving..." : "Save this week"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!planSavedSinceLastChange) { setPendingAction("regenerate"); return; }
              regenerateWeek();
            }}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Regenerate all
          </button>
          <button
            type="button"
            onClick={() => {
              if (!planSavedSinceLastChange) { setPendingAction("new"); return; }
              clearPlan(); setShowSetup(true);
            }}
            className="rounded-full border border-slate-900/20 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-white/20 dark:text-white"
          >
            New plan
          </button>
        </div>
      </section>

      {syncError ? (
        <section className="rounded-[28px] border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          {syncError}
        </section>
      ) : null}

      <section className="space-y-4">
        {mealPlan.days.map((day, dayIndex) => {
          const formatted = formatDay(day.date);
          const visibleMealTypes = allMealTypes.filter((mealType) => day.meals[mealType]?.enabled);
          const hasAnyEnabled = visibleMealTypes.length > 0;

          if (!hasAnyEnabled) return null;

          return (
            <section
              key={day.date}
              className="rounded-[32px] border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-semibold">{formatted.weekday}</div>
                  <div className="text-sm text-muted">{formatted.label}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleMealTypes.map((mealType) => {
                    const slot = day.meals[mealType];
                    const enabled = slot.enabled;
                    const consumed = Boolean(slot.consumed);

                    return (
                      <button
                        key={mealType}
                        type="button"
                        onClick={() => {
                          if (!consumed) toggleMealEnabled(dayIndex, mealType);
                        }}
                        disabled={consumed}
                        aria-label={consumed ? `${MEAL_LABELS[mealType]} consumed and locked` : undefined}
                        className={`rounded-full px-3 py-2 text-xs font-semibold ${
                          consumed
                            ? "cursor-not-allowed bg-slate-700 text-white line-through opacity-80"
                            : enabled
                              ? "bg-accent text-white"
                              : "bg-surfaceAlt text-muted"
                        }`}
                      >
                        {MEAL_LABELS[mealType]}{consumed ? " ✓" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {visibleMealTypes.map((mealType) => {
                  const slot = day.meals[mealType];

                  if (!slot.enabled) return null;

                  const recipe = slot.recipeId ? recipeMap.get(slot.recipeId) : null;
                  if (!recipe) {
                    const unsafeRecipe = slot.unsafeRecipeId ? recipeMap.get(slot.unsafeRecipeId) : null;
                    const unsafeAllergens = slot.unsafeExcludedIngredients ?? [];

                    return (
                      <div
                        key={`${day.date}-${mealType}-empty`}
                        className={`rounded-[28px] border border-dashed p-4 text-sm ${unsafeRecipe ? "border-amber-300 bg-amber-50 text-amber-900" : "border-border bg-surfaceAlt text-muted"}`}
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                          {MEAL_LABELS[mealType]}
                        </div>
                        {unsafeRecipe ? (
                          <>
                            <div className="mt-2 font-semibold text-amber-950">Allergen blocked: {unsafeRecipe.name}</div>
                            <div className="mt-1">
                              This saved meal contains excluded {unsafeAllergens.length === 1 ? "allergen" : "allergens"}
                              {unsafeAllergens.length ? ` (${unsafeAllergens.join(", ")})` : ""}. It was preserved in place but removed from groceries and future generation.
                            </div>
                            <button
                              type="button"
                              onClick={() => regenerateMeal(dayIndex, mealType)}
                              className="mt-3 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white"
                            >
                              Replace with safe meal
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="mt-2 font-semibold text-text">Empty slot</div>
                            <div className="mt-1">Use Swap meal from another card to move a meal here.</div>
                          </>
                        )}
                      </div>
                    );
                  }

                  return (
                    <MealCard
                      key={`${day.date}-${mealType}-${recipe.id}`}
                      dayLabel={formatted.weekday}
                      mealType={mealType}
                      recipe={recipe}
                      favorite={preferences.favoriteRecipeIds.includes(recipe.id)}
                      favoriteRecipeIds={preferences.favoriteRecipeIds}
                      consumed={Boolean(slot.consumed)}
                      recipeOptions={recipeOptionsByMealType[mealType]}
                      swapTargets={swapTargetsBySlot[`${dayIndex}-${mealType}`] ?? []}
                      onAssignRecipe={(recipeId) => assignRecipeToMeal(dayIndex, mealType, recipeId)}
                      onSwapRecipe={(target) => swapMeals({ dayIndex, mealType }, target)}
                      onRegenerate={(proteinOverride?: ProteinType | "any") => regenerateMeal(dayIndex, mealType, proteinOverride)}
                      onToggleConsumed={() => toggleMealConsumed(dayIndex, mealType)}
                      onToggleFavorite={() => toggleFavoriteRecipe(recipe.id)}
                      onCreateCustomMeal={async (customRecipe) => {
                        await addCustomRecipe(customRecipe, {
                          assignTo: { dayIndex, mealType }
                        });
                      }}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>

      {/* Unsaved plan warning dialog */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-bold text-text">Unsaved plan</h3>
            <p className="mt-2 text-sm text-muted">
              Your current meal plan hasn&apos;t been saved. {pendingAction === "regenerate" ? "Regenerating" : "Creating a new plan"} will replace it.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  setIsSavingWeek(true);
                  await saveCurrentWeek();
                  setIsSavingWeek(false);
                  if (pendingAction === "regenerate") regenerateWeek();
                  else { clearPlan(); setShowSetup(true); }
                  setPendingAction(null);
                }}
                className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white"
              >
                {isSavingWeek ? "Saving..." : "Save & continue"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingAction === "regenerate") regenerateWeek();
                  else { clearPlan(); setShowSetup(true); }
                  setPendingAction(null);
                }}
                className="w-full rounded-full border border-border px-5 py-3 text-sm font-semibold text-muted"
              >
                {pendingAction === "regenerate" ? "Regenerate anyway" : "New plan anyway"}
              </button>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="w-full rounded-full px-5 py-2 text-sm text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
