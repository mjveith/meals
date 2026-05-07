"use client";

import { useState } from "react";
import { CustomMealForm } from "@/components/CustomMealForm";
import { ProteinSelector } from "@/components/ProteinSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CATEGORY_LABELS, MEAL_LABELS, MEAL_TYPES } from "@/lib/constants";
import {
  formatParticipationCount,
  getMealParticipants,
  getMealParticipationWeight
} from "@/lib/household";
import { useAppState } from "@/lib/app-state";
import { getRecipeMap } from "@/lib/meal-generator";
import { CustomRecipe, IngredientCategory, MealType, Recipe } from "@/types";

const mealTypes: MealType[] = MEAL_TYPES;

export default function SettingsPage() {
  const {
    preferences,
    customRecipes,
    hydrated,
    toggleProtein,
    toggleFavoriteProtein,
    setTheme,
    setBrunchMode,
    addHouseholdMember,
    removeHouseholdMember,
    updateHouseholdMember,
    addCustomStaple,
    removeCustomStaple,
    sectionOrder,
    moveSection,
    toggleFavoriteRecipe,
    addCustomRecipe,
    removeCustomRecipe
  } = useAppState();
  const [showCustomMealForm, setShowCustomMealForm] = useState(false);
  const [showCustomStapleForm, setShowCustomStapleForm] = useState(false);
  const [customStapleName, setCustomStapleName] = useState("");
  const [customStapleQuantity, setCustomStapleQuantity] = useState("1");
  const [customStapleUnit, setCustomStapleUnit] = useState("");
  const [customStapleCategory, setCustomStapleCategory] = useState<IngredientCategory>("produce");

  if (!hydrated) {
    return <main className="p-6 text-sm text-muted">Loading settings...</main>;
  }

  const recipeMap = getRecipeMap(customRecipes);
  const favoriteRecipes = preferences.favoriteRecipeIds
    .map((recipeId) => recipeMap.get(recipeId))
    .filter((recipe): recipe is Recipe => Boolean(recipe));
  const mealParticipationSummary = mealTypes.map((mealType) => ({
    mealType,
    participants: getMealParticipants(preferences.householdMembers, mealType),
    weight: getMealParticipationWeight(preferences.householdMembers, mealType)
  }));

  const handleAddCustomStaple = () => {
    const quantity = Number(customStapleQuantity);
    const trimmedName = customStapleName.trim();
    const trimmedUnit = customStapleUnit.trim();

    if (!trimmedName || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    addCustomStaple({
      name: trimmedName,
      quantity,
      unit: trimmedUnit,
      category: customStapleCategory
    });
    setCustomStapleName("");
    setCustomStapleQuantity("1");
    setCustomStapleUnit("");
    setCustomStapleCategory("produce");
    setShowCustomStapleForm(false);
  };

  return (
    <main className="space-y-6 p-4 pb-12">
      <section className="rounded-[32px] bg-gradient-to-br from-teal-200 via-cyan-100 to-sky-100 p-6 text-slate-900 shadow-panel dark:from-slate-800 dark:via-teal-900 dark:to-cyan-900 dark:text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.24em]">Settings</div>
        <h1 className="mt-3 text-3xl font-bold">Preferences</h1>
        <p className="mt-3 text-sm text-slate-800/80 dark:text-white/80">
          Meal preferences are shared across devices. Theme stays local to this device.
        </p>
      </section>

      <section className="rounded-[32px] border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-text">Household</h2>
        <p className="mt-1 text-sm text-muted">
          Set each person&apos;s meal participation. Adults count as full portions, children count as half portions.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full bg-surfaceAlt px-3 py-1">
            {preferences.adults} adult{preferences.adults !== 1 ? "s" : ""}
          </span>
          <span className="rounded-full bg-surfaceAlt px-3 py-1">
            {preferences.children} child{preferences.children !== 1 ? "ren" : ""}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {preferences.householdMembers.map((member) => (
            <div
              key={member.id}
              className="rounded-3xl border border-border bg-canvas px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[220px] flex-1">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Name
                  </label>
                  <input
                    type="text"
                    defaultValue={member.name}
                    onBlur={(event) => {
                      const nextName = event.target.value.trim();
                      if (nextName && nextName !== member.name) {
                        updateHouseholdMember(member.id, { name: nextName });
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        (event.target as HTMLInputElement).blur();
                      }
                    }}
                    className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeHouseholdMember(member.id)}
                  disabled={preferences.householdMembers.length <= 1}
                  className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-muted disabled:opacity-30"
                >
                  Delete
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(["adult", "child"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => updateHouseholdMember(member.id, { kind })}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                      member.kind === kind
                        ? "bg-accent text-white"
                        : "border border-border bg-surfaceAlt text-muted"
                    }`}
                  >
                    {kind === "adult" ? "Adult" : "Child"}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Meals
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {mealTypes.map((mealType) => {
                    const enabled = member.mealParticipation.includes(mealType);
                    const nextParticipation = enabled
                      ? member.mealParticipation.filter((value) => value !== mealType)
                      : [...member.mealParticipation, mealType];

                    return (
                      <button
                        key={mealType}
                        type="button"
                        onClick={() => updateHouseholdMember(member.id, { mealParticipation: nextParticipation })}
                        className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                          enabled
                            ? "bg-accent text-white"
                            : "border border-border bg-surfaceAlt text-muted"
                        }`}
                      >
                        {MEAL_LABELS[mealType]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addHouseholdMember}
            className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            + Add person
          </button>
        </div>
        <div className="mt-4 space-y-2 rounded-3xl border border-border bg-canvas px-4 py-4 text-sm text-muted">
          <div className="font-medium text-text">Meal participation summary</div>
          {mealParticipationSummary.map(({ mealType, participants, weight }) => (
            <div key={mealType}>
              <span className="font-medium text-text">{MEAL_LABELS[mealType]}:</span>{" "}
              {participants.map((member) => member.name).join(", ") || "No one selected"} · {formatParticipationCount(weight)} serving{weight === 1 ? "" : "s"}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">Brunch Mode</h2>
            <p className="mt-1 text-sm text-muted">
              New weekly plans use Brunch and Dinner only. Brunch can use brunch, breakfast, and lunch recipes.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.brunchMode}
            onClick={() => setBrunchMode(!preferences.brunchMode)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              preferences.brunchMode ? "bg-accent text-white" : "bg-surfaceAlt text-muted"
            }`}
          >
            {preferences.brunchMode ? "On" : "Off"}
          </button>
        </div>
      </section>

      <section className="rounded-[32px] border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-text">Protein preferences</h2>
        <p className="mt-1 text-sm text-muted">
          Starred proteins always stay pre-selected when you come back.
        </p>
        <div className="mt-4">
          <ProteinSelector
            selected={preferences.selectedProteins}
            pinned={preferences.favoriteProteins}
            onToggle={toggleProtein}
            onPin={toggleFavoriteProtein}
          />
        </div>
      </section>

      <section className="rounded-[32px] border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-text">Theme</h2>
        <p className="mt-1 text-sm text-muted">Use system by default or lock the app.</p>
        <div className="mt-4">
          <ThemeToggle value={preferences.theme} onChange={setTheme} />
        </div>
      </section>

      <section className="rounded-[32px] border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-text">Grocery Section Order</h2>
        <p className="mt-1 text-sm text-muted">
          Reorder sections to match how you shop. This order is shared across devices.
        </p>
        <div className="mt-4 space-y-3">
          {sectionOrder.map((category, index) => (
            <div
              key={category}
              className="flex items-center justify-between rounded-3xl border border-border bg-canvas px-4 py-3"
            >
              <div className="font-medium text-text">{CATEGORY_LABELS[category]}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveSection(category, "up")}
                  disabled={index === 0}
                  className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-muted disabled:opacity-30"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(category, "down")}
                  disabled={index === sectionOrder.length - 1}
                  className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-muted disabled:opacity-30"
                >
                  Down
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-text">Custom Staples</h2>
        <p className="mt-1 text-sm text-muted">
          These items are added into their matching grocery sections every week and merge with recipe ingredients by name.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowCustomStapleForm((current) => !current)}
            className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            + Add staple
          </button>
        </div>
        {showCustomStapleForm ? (
          <div className="mt-4 rounded-[28px] border border-accent/30 bg-canvas p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={customStapleName}
                onChange={(event) => setCustomStapleName(event.target.value)}
                placeholder="Name"
                className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <select
                value={customStapleCategory}
                onChange={(event) => setCustomStapleCategory(event.target.value as IngredientCategory)}
                className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
              >
                {sectionOrder.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={customStapleQuantity}
                onChange={(event) => setCustomStapleQuantity(event.target.value)}
                placeholder="Qty"
                className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <input
                type="text"
                value={customStapleUnit}
                onChange={(event) => setCustomStapleUnit(event.target.value)}
                placeholder="Unit"
                className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAddCustomStaple}
                disabled={!customStapleName.trim() || Number(customStapleQuantity) <= 0}
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Save staple
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustomStapleForm(false);
                  setCustomStapleName("");
                  setCustomStapleQuantity("1");
                  setCustomStapleUnit("");
                  setCustomStapleCategory("produce");
                }}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          {preferences.customStaples.length > 0 ? (
            preferences.customStaples.map((staple) => (
              <div
                key={`${staple.name}-${staple.unit}-${staple.quantity}-${staple.category}`}
                className="flex items-center justify-between rounded-3xl border border-border bg-canvas px-4 py-3"
              >
                <div>
                  <div className="font-medium text-text">{staple.name}</div>
                  <div className="text-sm text-muted">
                    {CATEGORY_LABELS[staple.category]} · {staple.quantity} {staple.unit || "item"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomStaple(staple.name, staple.unit, staple.category)}
                  className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-muted"
                >
                  Delete
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-border px-4 py-5 text-sm text-muted">
              Add staples you want included every week.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[32px] border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-text">Favorite meals</h2>
        <p className="mt-1 text-sm text-muted">
          Favorites are prioritized during generation and can be removed here.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowCustomMealForm((current) => !current)}
            className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            + Add custom meal
          </button>
        </div>
        {showCustomMealForm ? (
          <div className="mt-4">
            <CustomMealForm
              title="Add custom meal"
              submitLabel="Save to favorites"
              allowMealTypeSelection
              onCancel={() => setShowCustomMealForm(false)}
              onSave={async (recipe) => {
                await addCustomRecipe(recipe, { favorite: true });
                setShowCustomMealForm(false);
              }}
            />
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          {favoriteRecipes.length > 0 ? (
            favoriteRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="flex items-center justify-between rounded-3xl border border-border bg-canvas px-4 py-3"
              >
                <div>
                  <div className="font-medium text-text">{recipe.name}</div>
                  <div className="text-sm text-muted">
                    {"isCustom" in recipe && recipe.isCustom ? "Custom meal · " : ""}
                    {recipe.cuisine} · {recipe.prepTime + recipe.cookTime} min
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {"isCustom" in recipe && recipe.isCustom ? (
                    <button
                      type="button"
                      onClick={() => removeCustomRecipe((recipe as CustomRecipe).id)}
                      className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-muted"
                    >
                      Delete
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleFavoriteRecipe(recipe.id)}
                    className="rounded-full bg-accent px-3 py-2 text-sm font-semibold text-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-border px-4 py-5 text-sm text-muted">
              Star a meal from the weekly plan to keep it handy.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
