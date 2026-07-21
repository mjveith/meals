"use client";

import { createContext, type Context, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ingredientMatchesExcluded, normalizeExcludedIngredients } from "@/lib/allergens";
import { buildGroceryList } from "@/lib/grocery-builder";
import { countHouseholdMembers, createBlankHouseholdMember, getFullHouseholdServingMultiplier, getMealServingMultipliers, normalizeHouseholdMembers } from "@/lib/household";
import { assignBucketMealRecipe, createBucketPlan, regenerateAllBucketMeals, regenerateBucketMeal, reconcileBucketPlanSafety, removeRecipeFromBucketPlan, toggleBucketMealConsumed } from "@/lib/meal-buckets";
import { storage } from "@/lib/storage";
import { mergePreferences, type SharedStateMutator, useSharedStateSync } from "@/lib/use-shared-state-sync";
import { toggleFavoriteRecipeIds } from "@/lib/favorites";
import { normalizeMealProfileId } from "@/lib/meal-profiles";
import { finalizePlanSave } from "@/lib/plan-save";
import type { AppStateInternals, AppStateValue, GroceryContextValue, MealPlanContextValue, PreferencesContextValue, SyncStatusValue } from "@/lib/app-state-types";
import type { CustomRecipe, MealType, SavedArchiveRecord, SavedBucketPlan, ThemePreference, UserPreferences } from "@/types";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const MealPlanContext = createContext<MealPlanContextValue | null>(null);
const GroceryContext = createContext<GroceryContextValue | null>(null);

function useRequiredContext<T>(context: Context<T | null>, name: string): T {
  const value = useContext(context);
  if (!value) throw new Error(`${name} must be used within AppStateProvider`);
  return value;
}

function usePreferencesValue(preferences: UserPreferences, status: SyncStatusValue, { mutate, setPlanSavedSinceLastChange }: AppStateInternals, setThemeState: (theme: ThemePreference) => void): PreferencesContextValue {
  const mealServingMultipliers = useMemo(() => getMealServingMultipliers(preferences.householdMembers), [preferences.householdMembers]);
  const servingMultiplier = useMemo(() => getFullHouseholdServingMultiplier(preferences.householdMembers), [preferences.householdMembers]);
  const getServingMultiplierForMeal = useCallback((mealType: MealType) => mealServingMultipliers[mealType], [mealServingMultipliers]);

  return useMemo(() => ({
    ...status, preferences, householdMembers: preferences.householdMembers, servingMultiplier, mealServingMultipliers, getServingMultiplierForMeal,
    customStaples: preferences.customStaples, sectionOrder: preferences.sectionOrder,
    toggleProtein: (protein) => { void mutate((current, currentPreferences) => {
      const selected = currentPreferences.selectedProteins.includes(protein) ? currentPreferences.selectedProteins.filter((item) => item !== protein) : [...currentPreferences.selectedProteins, protein];
      return selected.length ? { preferences: { ...current.preferences, selectedProteins: Array.from(new Set([...selected, ...currentPreferences.favoriteProteins])) } } : null;
    }); },
    toggleFavoriteProtein: (protein) => { void mutate((current, currentPreferences) => {
      const favoriteProteins = currentPreferences.favoriteProteins.includes(protein) ? currentPreferences.favoriteProteins.filter((item) => item !== protein) : [...currentPreferences.favoriteProteins, protein];
      return { preferences: { ...current.preferences, favoriteProteins, selectedProteins: Array.from(new Set([...currentPreferences.selectedProteins, ...favoriteProteins])) } };
    }); },
    toggleFavoriteRecipe: (recipeId) => { void mutate((current, currentPreferences) => ({ preferences: { ...current.preferences, favoriteRecipeIds: toggleFavoriteRecipeIds(currentPreferences.favoriteRecipeIds, recipeId) } })); },
    setTheme: (nextTheme) => { storage.saveTheme(nextTheme); setThemeState(nextTheme); },
    setBrunchMode: (enabled) => { void mutate((current) => ({ preferences: { ...current.preferences, brunchMode: enabled } })); },
    setMealProfile: (mealProfileId) => { void mutate((current) => ({ preferences: { ...current.preferences, mealProfileId: normalizeMealProfileId(mealProfileId) }, mealPlan: null, mealPlanReplace: true, groceryOverrides: {} })); setPlanSavedSinceLastChange(false); },
    toggleExcludedIngredient: (ingredient) => { void mutate((current, currentPreferences) => {
      const normalized = ingredient.trim().toLowerCase();
      const currentExcluded = normalizeExcludedIngredients(currentPreferences.excludedIngredients);
      const excludedIngredients = currentExcluded.includes(normalized) ? currentExcluded.filter((item) => item !== normalized) : normalizeExcludedIngredients([...currentExcluded, normalized]);
      const nextPreferences = { ...currentPreferences, excludedIngredients };
      return { preferences: { ...current.preferences, excludedIngredients }, ...(current.mealPlan ? { mealPlan: reconcileBucketPlanSafety(current.mealPlan, nextPreferences, current.customRecipes) } : {}), groceryOverrides: {} };
    }); setPlanSavedSinceLastChange(false); },
    updateHouseholdMember: (id, updates) => { void mutate((current, currentPreferences) => {
      const members = currentPreferences.householdMembers.map((member) => member.id === id ? { ...member, ...updates, name: updates.name?.trim() || member.name, mealParticipation: updates.mealParticipation ?? member.mealParticipation } : member);
      const householdMembers = normalizeHouseholdMembers(members, currentPreferences.adults, currentPreferences.children); const counts = countHouseholdMembers(householdMembers);
      return { preferences: { ...current.preferences, adults: counts.adults, children: counts.children, householdMembers } };
    }); setPlanSavedSinceLastChange(false); },
    addHouseholdMember: () => { void mutate((current, currentPreferences) => { const householdMembers = [...currentPreferences.householdMembers, createBlankHouseholdMember(currentPreferences.householdMembers)]; const counts = countHouseholdMembers(householdMembers); return { preferences: { ...current.preferences, adults: counts.adults, children: counts.children, householdMembers } }; }); setPlanSavedSinceLastChange(false); },
    removeHouseholdMember: (id) => { void mutate((current, currentPreferences) => { if (currentPreferences.householdMembers.length <= 1) return null; const householdMembers = currentPreferences.householdMembers.filter((member) => member.id !== id); const counts = countHouseholdMembers(householdMembers); return { preferences: { ...current.preferences, adults: counts.adults, children: counts.children, householdMembers } }; }); setPlanSavedSinceLastChange(false); },
    addCustomStaple: (staple) => { void mutate((current, currentPreferences) => ({ preferences: { ...current.preferences, customStaples: [...currentPreferences.customStaples, { ...staple, name: staple.name.trim(), unit: staple.unit.trim(), quantity: Math.max(0.01, Math.round(staple.quantity * 100) / 100) }] } })); },
    removeCustomStaple: (name, unit, category) => { void mutate((current) => ({ preferences: { ...current.preferences, customStaples: current.preferences.customStaples.filter((staple) => !(staple.name === name && staple.unit === unit && staple.category === category)) }, customStaplesReplace: true })); },
    moveSection: (category, direction) => { void mutate((current, currentPreferences) => { const order = [...currentPreferences.sectionOrder]; const index = order.indexOf(category); const reorderIndex = direction === "up" ? index - 1 : index + 1; if (index < 0 || reorderIndex < 0 || reorderIndex >= order.length) return null; [order[index], order[reorderIndex]] = [order[reorderIndex], order[index]]; return { preferences: { ...current.preferences, sectionOrder: order } }; }); }
  }), [getServingMultiplierForMeal, mealServingMultipliers, mutate, preferences, servingMultiplier, setPlanSavedSinceLastChange, setThemeState, status]);
}

function useMealPlanValue(syncState: ReturnType<typeof useSharedStateSync>["state"], preferences: UserPreferences, status: SyncStatusValue, { mutate, setPlanSavedSinceLastChange }: AppStateInternals, planSavedSinceLastChange: boolean): MealPlanContextValue {
  return useMemo(() => ({
    ...status, mealPlan: syncState.mealPlan, customRecipes: syncState.customRecipes, savedWeeks: syncState.savedWeeks, planSavedSinceLastChange,
    toggleMealConsumed: (mealId) => { void mutate((current) => current.mealPlan ? { mealPlan: toggleBucketMealConsumed(current.mealPlan, mealId) } : null); setPlanSavedSinceLastChange(false); },
    regenerateMeal: (mealId, proteinOverride = "any") => { void mutate((current, currentPreferences) => current.mealPlan ? { mealPlan: regenerateBucketMeal(current.mealPlan, mealId, currentPreferences, current.customRecipes, proteinOverride) } : null); setPlanSavedSinceLastChange(false); },
    assignRecipeToMeal: async (mealId, recipeId) => { const changed = await mutate((current, currentPreferences) => { if (!current.mealPlan) return null; const mealPlan = assignBucketMealRecipe(current.mealPlan, mealId, recipeId, currentPreferences, current.customRecipes); return mealPlan === current.mealPlan ? null : { mealPlan }; }); if (changed) setPlanSavedSinceLastChange(false); return changed; },
    regenerateRemaining: () => { void mutate((current, currentPreferences) => current.mealPlan ? { mealPlan: regenerateAllBucketMeals(current.mealPlan, currentPreferences, current.customRecipes) } : null); setPlanSavedSinceLastChange(false); },
    generatePlan: (counts) => { void mutate((current, currentPreferences) => ({ mealPlan: createBucketPlan(currentPreferences, counts, current.customRecipes), groceryOverrides: {} })); setPlanSavedSinceLastChange(false); },
    clearPlan: () => { void mutate(() => ({ mealPlan: null, mealPlanReplace: true, groceryOverrides: {} })); setPlanSavedSinceLastChange(true); },
    addCustomRecipe: async (recipe, options) => {
      if (recipe.ingredients.some((item) => ingredientMatchesExcluded(item.name, preferences.excludedIngredients))) throw new Error("Custom recipe contains an excluded allergen and was not saved.");
      let created: CustomRecipe | null = null;
      await mutate((current, currentPreferences) => {
        created = { ...recipe, id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, isCustom: true };
        const customRecipe = created as CustomRecipe;
        const mealPlan = options?.assignToMealId && current.mealPlan ? assignBucketMealRecipe(current.mealPlan, options.assignToMealId, customRecipe.id, currentPreferences, [...current.customRecipes, customRecipe]) : current.mealPlan;
        return { customRecipes: [...current.customRecipes, customRecipe], preferences: { ...current.preferences, favoriteRecipeIds: options?.favorite ? Array.from(new Set([...currentPreferences.favoriteRecipeIds, customRecipe.id])) : currentPreferences.favoriteRecipeIds }, mealPlan };
      });
      if (!created) throw new Error("Unable to create custom recipe"); setPlanSavedSinceLastChange(false); return created;
    },
    removeCustomRecipe: (id) => { void mutate((current) => ({ customRecipes: current.customRecipes.filter((recipe) => recipe.id !== id), preferences: { ...current.preferences, favoriteRecipeIds: current.preferences.favoriteRecipeIds.filter((recipeId) => recipeId !== id) }, ...(current.mealPlan ? { mealPlan: removeRecipeFromBucketPlan(current.mealPlan, id) } : {}) })); setPlanSavedSinceLastChange(false); },
    saveCurrentPlan: async () => {
      let saved: SavedArchiveRecord | null = null;
      const changed = await mutate((current, currentPreferences) => {
        if (!current.mealPlan) return null;
        const savedAt = new Date().toISOString();
        const groceryList = buildGroceryList(current.mealPlan, current.groceryOverrides, current.customRecipes, getMealServingMultipliers(currentPreferences.householdMembers), currentPreferences.customStaples, currentPreferences.sectionOrder, currentPreferences.excludedIngredients, currentPreferences.mealProfileId);
        saved = { kind: "bucket-plan", schemaVersion: 1, id: `plan-${current.mealPlan.id}-${Date.now().toString(36)}`, savedAt, label: `Plan saved ${savedAt.slice(0, 10)}`, mealPlan: current.mealPlan, groceryList: groceryList.filter((item) => !item.collected), customGroceryItems: current.customGroceryItems.filter((item) => !item.collected && !ingredientMatchesExcluded(item.name, currentPreferences.excludedIngredients)) } satisfies SavedBucketPlan;
        return { savedWeeks: [saved, ...current.savedWeeks].sort((a, b) => b.savedAt.localeCompare(a.savedAt)) };
      });
      return finalizePlanSave(Promise.resolve(changed), saved, setPlanSavedSinceLastChange);
    },
    deleteSavedPlan: (id) => { void mutate((current) => ({ savedWeeks: current.savedWeeks.filter((plan) => plan.id !== id), savedWeekDeletedIds: [id] })); }
  }), [mutate, planSavedSinceLastChange, preferences, setPlanSavedSinceLastChange, status, syncState.customRecipes, syncState.mealPlan, syncState.savedWeeks]);
}

function useGroceryValue(syncState: ReturnType<typeof useSharedStateSync>["state"], preferences: UserPreferences, mealServingMultipliers: Record<MealType, number>, status: SyncStatusValue, mutate: SharedStateMutator): GroceryContextValue {
  const groceries = useMemo(() => syncState.mealPlan ? buildGroceryList(syncState.mealPlan, syncState.groceryOverrides, syncState.customRecipes, mealServingMultipliers, preferences.customStaples, preferences.sectionOrder, preferences.excludedIngredients, preferences.mealProfileId) : [], [mealServingMultipliers, preferences.customStaples, preferences.excludedIngredients, preferences.mealProfileId, preferences.sectionOrder, syncState.customRecipes, syncState.groceryOverrides, syncState.mealPlan]);
  const safeCustomItems = useMemo(() => syncState.customGroceryItems.filter((item) => !ingredientMatchesExcluded(item.name, preferences.excludedIngredients)), [preferences.excludedIngredients, syncState.customGroceryItems]);
  return useMemo(() => ({ ...status, groceries, customItems: safeCustomItems, sectionOrder: preferences.sectionOrder,
    addCustomItem: (name, category, quantity = 1, unit = "") => { if (!ingredientMatchesExcluded(name, preferences.excludedIngredients)) void mutate((current) => ({ customGroceryItems: [...current.customGroceryItems, { id: `custom::${Date.now()}::${name.toLowerCase()}`, name, quantity, unit, category, collected: false }] })); },
    removeCustomItem: (id) => { void mutate((current) => ({ customGroceryItems: current.customGroceryItems.filter((item) => item.id !== id) })); },
    toggleCustomItemCollected: (id) => { void mutate((current) => ({ customGroceryItems: current.customGroceryItems.map((item) => item.id === id ? { ...item, collected: !item.collected } : item) })); },
    toggleGroceryCollected: (key) => { void mutate((current) => { const override = current.groceryOverrides[key] ?? { collected: false, adjustment: 0 }; return { groceryOverrides: { ...current.groceryOverrides, [key]: { ...override, collected: !override.collected } } }; }); },
    adjustGroceryQuantity: (key, delta) => { void mutate((current) => { const override = current.groceryOverrides[key] ?? { collected: false, adjustment: 0 }; return { groceryOverrides: { ...current.groceryOverrides, [key]: { ...override, adjustment: override.adjustment + delta } } }; }); },
    setGroceryQuantity: (key, quantity) => { void mutate((current) => { if (!current.mealPlan) return null; const base = buildGroceryList(current.mealPlan, {}, current.customRecipes, mealServingMultipliers, preferences.customStaples, preferences.sectionOrder, preferences.excludedIngredients, preferences.mealProfileId).find((item) => item.key === key); if (!base) return null; const override = current.groceryOverrides[key] ?? { collected: false, adjustment: 0 }; return { groceryOverrides: { ...current.groceryOverrides, [key]: { ...override, adjustment: Math.max(0, quantity) - base.quantity } } }; }); },
    clearCompletedGroceries: () => { void mutate((current) => ({ groceryOverrides: Object.fromEntries(Object.entries(current.groceryOverrides).filter(([, override]) => !override.collected)), customGroceryItems: current.customGroceryItems.filter((item) => !item.collected) })); }
  }), [groceries, mealServingMultipliers, mutate, preferences, safeCustomItems, status]);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [planSavedSinceLastChange, setPlanSavedSinceLastChange] = useState(true);
  useEffect(() => { const stored = storage.loadTheme(); setTheme(stored === "light" || stored === "dark" || stored === "system" ? stored : "system"); }, []);
  const sync = useSharedStateSync(theme);
  const status = useMemo(() => ({ hydrated: sync.hydrated, syncError: sync.syncError, hasLoadedSharedState: sync.hasLoadedSharedState }), [sync.hydrated, sync.syncError, sync.hasLoadedSharedState]);
  const preferences = useMemo(() => mergePreferences(sync.state.preferences, theme), [sync.state.preferences, theme]);
  const internals = useMemo(() => ({ mutate: sync.mutate, setPlanSavedSinceLastChange }), [sync.mutate]);
  const preferencesValue = usePreferencesValue(preferences, status, internals, setTheme);
  const mealPlanValue = useMealPlanValue(sync.state, preferences, status, internals, planSavedSinceLastChange);
  const groceryValue = useGroceryValue(sync.state, preferences, preferencesValue.mealServingMultipliers, status, sync.mutate);
  useEffect(() => { if (sync.syncError && sync.hydrated) console.error(sync.syncError); }, [sync.hydrated, sync.syncError]);
  return <PreferencesContext.Provider value={preferencesValue}><MealPlanContext.Provider value={mealPlanValue}><GroceryContext.Provider value={groceryValue}>{children}</GroceryContext.Provider></MealPlanContext.Provider></PreferencesContext.Provider>;
}

export function usePreferencesState() { return useRequiredContext(PreferencesContext, "usePreferencesState"); }
export function useMealPlanState() { return useRequiredContext(MealPlanContext, "useMealPlanState"); }
export function useGroceryState() { return useRequiredContext(GroceryContext, "useGroceryState"); }

/** Compatibility composition for screens that consume all three app-state contexts. */
export function useAppState(): AppStateValue {
  return { ...usePreferencesState(), ...useMealPlanState(), ...useGroceryState() };
}
