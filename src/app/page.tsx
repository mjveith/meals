"use client";

import { useMemo, useState } from "react";
import { MealCard } from "@/components/MealCard";
import { ProteinSelector } from "@/components/ProteinSelector";
import { useAppState } from "@/lib/app-state";
import { formatDay } from "@/lib/date";
import { getRecipeMap, type DayConfig } from "@/lib/meal-generator";
import { MEAL_LABELS } from "@/lib/constants";
import { MealType, ProteinType } from "@/types";

const mealTypes: MealType[] = ["breakfast", "lunch", "dinner"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function defaultDayConfigs(): DayConfig[] {
  return Array.from({ length: 7 }, () => ({
    enabled: true,
    breakfast: true,
    lunch: true,
    dinner: true
  }));
}

function PlanSetup({ onGenerate }: { onGenerate: (configs: DayConfig[]) => void }) {
  const {
    preferences,
    toggleProtein,
    toggleFavoriteProtein
  } = useAppState();
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>(defaultDayConfigs);

  const toggleDay = (index: number) => {
    setDayConfigs((prev) => {
      const next = [...prev];
      const wasEnabled = next[index].enabled;
      next[index] = wasEnabled
        ? { enabled: false, breakfast: false, lunch: false, dinner: false }
        : { enabled: true, breakfast: true, lunch: true, dinner: true };
      return next;
    });
  };

  const toggleMealType = (index: number, meal: MealType) => {
    setDayConfigs((prev) => {
      const next = [...prev];
      const day = { ...next[index], [meal]: !next[index][meal] };
      // If at least one meal is on, day is enabled
      day.enabled = day.breakfast || day.lunch || day.dinner;
      next[index] = day;
      return next;
    });
  };

  const totalMeals = dayConfigs.reduce(
    (sum, d) => sum + (d.breakfast ? 1 : 0) + (d.lunch ? 1 : 0) + (d.dinner ? 1 : 0),
    0
  );

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
        <p className="mt-1 text-sm text-muted">Tap a day to toggle it. Tap meal types to customize.</p>
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
                      {mealTypes.map((meal) => (
                        <button
                          key={meal}
                          type="button"
                          onClick={() => toggleMealType(index, meal)}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                            config[meal]
                              ? "bg-accent text-white"
                              : "bg-surfaceAlt text-muted"
                          }`}
                        >
                          {meal.charAt(0).toUpperCase()}
                        </button>
                      ))}
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
      <button
        type="button"
        disabled={enabledDays === 0}
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
    regenerateWeek,
    regenerateMeal,
    swapMeals,
    toggleMealEnabled,
    toggleFavoriteRecipe,
    generatePlan,
    clearPlan,
    addCustomRecipe,
    saveCurrentWeek,
    planSavedSinceLastChange
  } = useAppState();
  const recipeMap = useMemo(() => getRecipeMap(customRecipes), [customRecipes]);
  const [showSetup, setShowSetup] = useState(false);
  const [isSavingWeek, setIsSavingWeek] = useState(false);
  const [pendingAction, setPendingAction] = useState<"regenerate" | "new" | null>(null);

  if (!hydrated) {
    return <main className="p-6 text-sm text-muted">Loading your plan...</main>;
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
    (count, day) => count + mealTypes.filter((mealType) => day.meals[mealType].enabled).length,
    0
  );
  const scheduledSlots = mealPlan.days.flatMap((day, dayIndex) => {
    const formatted = formatDay(day.date);

    return mealTypes.flatMap((mealType) => {
      const slot = day.meals[mealType];
      const recipe = slot.recipeId ? recipeMap.get(slot.recipeId) : null;

      if (!slot.enabled || !recipe) {
        return [];
      }

      return [{
        dayIndex,
        mealType,
        dayLabel: formatted.weekday,
        recipeName: recipe.name
      }];
    });
  });

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

      <section className="space-y-4">
        {mealPlan.days.map((day, dayIndex) => {
          const formatted = formatDay(day.date);
          const hasAnyEnabled = mealTypes.some((mt) => day.meals[mt].enabled);

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
                  {mealTypes.map((mealType) => {
                    const enabled = day.meals[mealType].enabled;

                    return (
                      <button
                        key={mealType}
                        type="button"
                        onClick={() => toggleMealEnabled(dayIndex, mealType)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold ${
                          enabled
                            ? "bg-accent text-white"
                            : "bg-surfaceAlt text-muted"
                        }`}
                      >
                        {MEAL_LABELS[mealType]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {mealTypes.map((mealType) => {
                  const slot = day.meals[mealType];

                  if (!slot.enabled) return null;

                  const recipe = slot.recipeId ? recipeMap.get(slot.recipeId) : null;
                  if (!recipe) return null;

                  return (
                    <MealCard
                      key={`${day.date}-${mealType}-${recipe.id}`}
                      dayLabel={formatted.weekday}
                      mealType={mealType}
                      recipe={recipe}
                      favorite={preferences.favoriteRecipeIds.includes(recipe.id)}
                      swapTargets={scheduledSlots.filter(
                        (candidate) =>
                          candidate.dayIndex !== dayIndex || candidate.mealType !== mealType
                      )}
                      onSwap={(target) => swapMeals({ dayIndex, mealType }, target)}
                      onRegenerate={(proteinOverride?: ProteinType | "any") => regenerateMeal(dayIndex, mealType, proteinOverride)}
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
