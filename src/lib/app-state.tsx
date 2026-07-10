"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { ingredientMatchesExcluded, normalizeExcludedIngredients, recipeExcludedAllergens } from "@/lib/allergens";
import { buildGroceryList } from "@/lib/grocery-builder";
import {
  countHouseholdMembers,
  createBlankHouseholdMember,
  getFullHouseholdServingMultiplier,
  getMealServingMultipliers,
  normalizeHouseholdMembers
} from "@/lib/household";
import {
  assignRecipeToSlot,
  createPlanFromConfig,
  getRecipeMap,
  regenerateMealSlot,
  regenerateWeek as regenerateWeekPlan,
  swapRecipesBetweenSlots,
  toggleMealSlotEnabled
} from "@/lib/meal-generator";
import { storage } from "@/lib/storage";
import { mergePreferences, SharedStateMutator, useSharedStateSync } from "@/lib/use-shared-state-sync";
import { formatWeekLabel } from "@/lib/date";
import { toggleFavoriteRecipeIds } from "@/lib/favorites";
import { normalizeMealProfileId } from "@/lib/meal-profiles";
import {
  AppStateInternals,
  AppStateValue,
  GroceryContextValue,
  MealPlanContextValue,
  PreferencesContextValue,
  SyncStatusValue
} from "@/lib/app-state-types";
import {
  CustomRecipe,
  MealSlot,
  MealType,
  SavedWeek,
  ThemePreference,
  UserPreferences
} from "@/types";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const MealPlanContext = createContext<MealPlanContextValue | null>(null);
const GroceryContext = createContext<GroceryContextValue | null>(null);
function useRequiredContext<T>(context: React.Context<T | null>, name: string) {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${name} must be used within AppStateProvider`);
  }
  return value;
}

function usePreferencesValue(
  preferences: UserPreferences,
  status: SyncStatusValue,
  { mutate, setPlanSavedSinceLastChange }: AppStateInternals,
  setThemeState: (theme: ThemePreference) => void
): PreferencesContextValue {
  const mealServingMultipliers = useMemo(
    () => getMealServingMultipliers(preferences.householdMembers),
    [preferences.householdMembers]
  );
  const servingMultiplier = useMemo(
    () => getFullHouseholdServingMultiplier(preferences.householdMembers),
    [preferences.householdMembers]
  );
  const getServingMultiplierForMeal = useCallback(
    (mealType: MealType) => mealServingMultipliers[mealType],
    [mealServingMultipliers]
  );

  return useMemo(() => ({
    ...status,
    preferences,
    householdMembers: preferences.householdMembers,
    servingMultiplier,
    mealServingMultipliers,
    getServingMultiplierForMeal,
    customStaples: preferences.customStaples,
    sectionOrder: preferences.sectionOrder,
    toggleProtein: (protein) => {
      void mutate((current, currentPreferences) => {
        const selected = currentPreferences.selectedProteins.includes(protein)
          ? currentPreferences.selectedProteins.filter((item) => item !== protein)
          : [...currentPreferences.selectedProteins, protein];
        if (selected.length === 0) return null;
        return { preferences: { ...current.preferences, selectedProteins: Array.from(new Set([...selected, ...currentPreferences.favoriteProteins])) } };
      });
    },
    toggleFavoriteProtein: (protein) => {
      void mutate((current, currentPreferences) => {
        const isFavorite = currentPreferences.favoriteProteins.includes(protein);
        const favoriteProteins = isFavorite
          ? currentPreferences.favoriteProteins.filter((item) => item !== protein)
          : [...currentPreferences.favoriteProteins, protein];
        const selectedProteins = Array.from(new Set(isFavorite ? currentPreferences.selectedProteins : [...currentPreferences.selectedProteins, protein]));
        return { preferences: { ...current.preferences, favoriteProteins, selectedProteins } };
      });
    },
    toggleFavoriteRecipe: (recipeId) => {
      void mutate((current, currentPreferences) => ({
        preferences: {
          ...current.preferences,
          favoriteRecipeIds: toggleFavoriteRecipeIds(currentPreferences.favoriteRecipeIds, recipeId)
        }
      }));
    },
    setTheme: (nextTheme) => {
      storage.saveTheme(nextTheme);
      setThemeState(nextTheme);
    },
    setBrunchMode: (enabled) => {
      void mutate((current) => ({ preferences: { ...current.preferences, brunchMode: enabled } }));
    },
    setMealProfile: (mealProfileId) => {
      void mutate((current) => ({
        preferences: {
          ...current.preferences,
          mealProfileId: normalizeMealProfileId(mealProfileId)
        },
        mealPlan: null,
        groceryOverrides: {}
      }));
      setPlanSavedSinceLastChange(false);
    },
    toggleExcludedIngredient: (ingredient) => {
      void mutate((current, currentPreferences) => {
        const currentExcluded = normalizeExcludedIngredients(currentPreferences.excludedIngredients);
        const normalized = ingredient.trim().toLowerCase();
        const excludedIngredients = currentExcluded.includes(normalized)
          ? currentExcluded.filter((item) => item !== normalized)
          : normalizeExcludedIngredients([...currentExcluded, normalized]);
        const unsafeRecipes = new Map(
          [...getRecipeMap(current.customRecipes, currentPreferences.mealProfileId).values()]
            .map((recipe) => [recipe.id, recipeExcludedAllergens(recipe, excludedIngredients)] as const)
            .filter(([, allergens]) => allergens.length > 0)
        );
        const mealPlan = current.mealPlan
          ? {
              ...current.mealPlan,
              days: current.mealPlan.days.map((day) => ({
                ...day,
                meals: Object.fromEntries(
                  (Object.entries(day.meals) as Array<[MealType, MealSlot]>).map(([mealType, slot]) => [
                    mealType,
                    slot.recipeId && unsafeRecipes.has(slot.recipeId)
                      ? {
                          enabled: slot.enabled,
                          unsafeRecipeId: slot.recipeId,
                          unsafeExcludedIngredients: unsafeRecipes.get(slot.recipeId),
                          ...(slot.consumed ? { consumed: true } : {})
                        }
                      : slot
                  ])
                ) as Record<MealType, MealSlot>
              }))
            }
          : current.mealPlan;

        return {
          preferences: {
            ...current.preferences,
            excludedIngredients
          },
          mealPlan,
          groceryOverrides: {}
        };
      });
      setPlanSavedSinceLastChange(false);
    },
    updateHouseholdMember: (id, updates) => {
      void mutate((current, currentPreferences) => {
        const householdMembers = currentPreferences.householdMembers.map((member) =>
          member.id === id
            ? { ...member, ...updates, name: updates.name?.trim() || member.name, mealParticipation: updates.mealParticipation ?? member.mealParticipation }
            : member
        );
        const normalizedMembers = normalizeHouseholdMembers(householdMembers, currentPreferences.adults, currentPreferences.children);
        const householdCounts = countHouseholdMembers(normalizedMembers);
        return { preferences: { ...current.preferences, adults: householdCounts.adults, children: householdCounts.children, householdMembers: normalizedMembers } };
      });
      setPlanSavedSinceLastChange(false);
    },
    addHouseholdMember: () => {
      void mutate((current, currentPreferences) => {
        const householdMembers = [...currentPreferences.householdMembers, createBlankHouseholdMember(currentPreferences.householdMembers)];
        const householdCounts = countHouseholdMembers(householdMembers);
        return { preferences: { ...current.preferences, adults: householdCounts.adults, children: householdCounts.children, householdMembers } };
      });
      setPlanSavedSinceLastChange(false);
    },
    removeHouseholdMember: (id) => {
      void mutate((current, currentPreferences) => {
        if (currentPreferences.householdMembers.length <= 1) return null;
        const householdMembers = currentPreferences.householdMembers.filter((member) => member.id !== id);
        const householdCounts = countHouseholdMembers(householdMembers);
        return { preferences: { ...current.preferences, adults: householdCounts.adults, children: householdCounts.children, householdMembers } };
      });
      setPlanSavedSinceLastChange(false);
    },
    addCustomStaple: (staple) => {
      void mutate((current, currentPreferences) => ({
        preferences: {
          ...current.preferences,
          customStaples: [...currentPreferences.customStaples, { name: staple.name.trim(), quantity: Math.max(0.01, Math.round(staple.quantity * 100) / 100), unit: staple.unit.trim(), category: staple.category }]
        }
      }));
    },
    removeCustomStaple: (name, unit, category) => {
      void mutate((current) => ({
        preferences: {
          ...current.preferences,
          customStaples: current.preferences.customStaples.filter((staple) => !(staple.name === name && staple.unit === unit && staple.category === category))
        },
        customStaplesReplace: true
      }));
    },
    moveSection: (category, direction) => {
      void mutate((current, currentPreferences) => {
        const order = [...currentPreferences.sectionOrder];
        const index = order.indexOf(category);
        if (index === -1) return null;
        const swapIndex = direction === "up" ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= order.length) return null;
        [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
        return { preferences: { ...current.preferences, sectionOrder: order } };
      });
    }
  }), [getServingMultiplierForMeal, mealServingMultipliers, mutate, preferences, servingMultiplier, setPlanSavedSinceLastChange, setThemeState, status]);
}

function useMealPlanValue(
  syncState: ReturnType<typeof useSharedStateSync>["state"],
  preferences: UserPreferences,
  status: SyncStatusValue,
  { mutate, setPlanSavedSinceLastChange }: AppStateInternals,
  planSavedSinceLastChange: boolean
): MealPlanContextValue {
  return useMemo(() => ({
    ...status,
    mealPlan: syncState.mealPlan,
    customRecipes: syncState.customRecipes,
    savedWeeks: syncState.savedWeeks,
    planSavedSinceLastChange,
    toggleMealEnabled: (dayIndex, mealType) => {
      void mutate((current, currentPreferences) => {
        if (!current.mealPlan) return null;
        const nextPlan = toggleMealSlotEnabled(current.mealPlan, dayIndex, mealType, currentPreferences, current.customRecipes);
        return nextPlan === current.mealPlan ? null : { mealPlan: nextPlan };
      });
      setPlanSavedSinceLastChange(false);
    },
    toggleMealConsumed: (dayIndex, mealType) => {
      void mutate((current) => {
        if (!current.mealPlan) return null;
        const day = current.mealPlan.days[dayIndex];
        const slot = day?.meals[mealType];
        if (!day || !slot?.enabled || !slot.recipeId) return null;
        const days = [...current.mealPlan.days];
        days[dayIndex] = { ...day, meals: { ...day.meals, [mealType]: { ...slot, consumed: !slot.consumed } } };
        return { mealPlan: { ...current.mealPlan, days } };
      });
      setPlanSavedSinceLastChange(false);
    },
    regenerateMeal: (dayIndex, mealType, proteinOverride) => {
      void mutate((current, currentPreferences) =>
        current.mealPlan && !current.mealPlan.days[dayIndex]?.meals[mealType]?.consumed
          ? { mealPlan: regenerateMealSlot(current.mealPlan, dayIndex, mealType, currentPreferences, current.customRecipes, proteinOverride) }
          : null
      );
      setPlanSavedSinceLastChange(false);
    },
    swapMeals: async (source, target) => {
      const changed = await mutate((current) => {
        if (!current.mealPlan) return null;
        const nextPlan = swapRecipesBetweenSlots(current.mealPlan, source, target, current.customRecipes);
        return nextPlan === current.mealPlan ? null : { mealPlan: nextPlan };
      });
      if (changed) setPlanSavedSinceLastChange(false);
      return changed;
    },
    assignRecipeToMeal: async (dayIndex, mealType, recipeId) => {
      const changed = await mutate((current, currentPreferences) => {
        if (!current.mealPlan) return null;
        const nextPlan = assignRecipeToSlot(current.mealPlan, dayIndex, mealType, recipeId, current.customRecipes, currentPreferences.excludedIngredients, currentPreferences.mealProfileId);
        return nextPlan === current.mealPlan ? null : { mealPlan: nextPlan };
      });
      if (changed) setPlanSavedSinceLastChange(false);
      return changed;
    },
    regenerateWeek: () => {
      void mutate((current, currentPreferences) => current.mealPlan ? { mealPlan: regenerateWeekPlan(current.mealPlan, currentPreferences, current.customRecipes) } : null);
      setPlanSavedSinceLastChange(false);
    },
    generatePlan: (dayConfigs) => {
      void mutate((current, currentPreferences) => ({ mealPlan: createPlanFromConfig(currentPreferences, dayConfigs, current.customRecipes), groceryOverrides: {} }));
      setPlanSavedSinceLastChange(false);
    },
    clearPlan: () => {
      void mutate(() => ({ mealPlan: null, groceryOverrides: {} }));
      setPlanSavedSinceLastChange(true);
    },
    addCustomRecipe: async (recipe, options) => {
      if (recipe.ingredients.some((item) => ingredientMatchesExcluded(item.name, preferences.excludedIngredients))) {
        throw new Error("Custom recipe contains an excluded allergen and was not saved.");
      }

      let nextRecipe: CustomRecipe | null = null;
      await mutate((current) => {
        const createdRecipe: CustomRecipe = { ...recipe, id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, isCustom: true };
        nextRecipe = createdRecipe;
        const nextFavoriteIds = options?.favorite ? Array.from(new Set([...current.preferences.favoriteRecipeIds, createdRecipe.id])) : current.preferences.favoriteRecipeIds;
        const nextPlan = options?.assignTo && current.mealPlan
          ? { ...current.mealPlan, days: current.mealPlan.days.map((day, index) => index === options.assignTo?.dayIndex ? { ...day, meals: { ...day.meals, [options.assignTo.mealType]: { enabled: true, recipeId: createdRecipe.id } } } : day) }
          : current.mealPlan;
        return { customRecipes: [...current.customRecipes, createdRecipe], preferences: { ...current.preferences, favoriteRecipeIds: nextFavoriteIds }, mealPlan: nextPlan };
      });
      if (!nextRecipe) throw new Error("Unable to create custom recipe");
      setPlanSavedSinceLastChange(false);
      return nextRecipe;
    },
    removeCustomRecipe: (id) => {
      void mutate((current) => ({
        customRecipes: current.customRecipes.filter((recipe) => recipe.id !== id),
        preferences: { ...current.preferences, favoriteRecipeIds: current.preferences.favoriteRecipeIds.filter((recipeId) => recipeId !== id) },
        mealPlan: current.mealPlan ? { ...current.mealPlan, days: current.mealPlan.days.map((day) => ({ ...day, meals: { breakfast: day.meals.breakfast.recipeId === id ? { enabled: day.meals.breakfast.enabled } : day.meals.breakfast, brunch: day.meals.brunch.recipeId === id ? { enabled: day.meals.brunch.enabled } : day.meals.brunch, lunch: day.meals.lunch.recipeId === id ? { enabled: day.meals.lunch.enabled } : day.meals.lunch, dinner: day.meals.dinner.recipeId === id ? { enabled: day.meals.dinner.enabled } : day.meals.dinner } })) } : null
      }));
    },
    saveCurrentWeek: async () => {
      let nextSavedWeek: SavedWeek | null = null;
      await mutate((current, currentPreferences) => {
        if (!current.mealPlan) return null;
        const savedAt = new Date().toISOString();
        const groceryList = buildGroceryList(
          current.mealPlan,
          current.groceryOverrides,
          current.customRecipes,
          getMealServingMultipliers(currentPreferences.householdMembers),
          currentPreferences.customStaples,
          currentPreferences.sectionOrder,
          currentPreferences.excludedIngredients,
          currentPreferences.mealProfileId
        );
        const savedWeek: SavedWeek = {
          id: `week-${current.mealPlan.weekOf}-${Date.now().toString(36)}`,
          savedAt,
          weekOf: current.mealPlan.weekOf,
          label: formatWeekLabel(current.mealPlan.weekOf),
          mealPlan: current.mealPlan,
          groceryList: groceryList.filter((item) => !item.collected),
          customGroceryItems: current.customGroceryItems.filter((item) => !item.collected && !ingredientMatchesExcluded(item.name, currentPreferences.excludedIngredients))
        };
        nextSavedWeek = savedWeek;
        return { savedWeeks: [savedWeek, ...current.savedWeeks].sort((a, b) => b.savedAt.localeCompare(a.savedAt)) };
      });
      setPlanSavedSinceLastChange(true);
      return nextSavedWeek;
    },
    deleteSavedWeek: (id) => {
      void mutate((current) => ({ savedWeeks: current.savedWeeks.filter((week) => week.id !== id), savedWeekDeletedIds: [id] }));
    }
  }), [mutate, planSavedSinceLastChange, preferences, setPlanSavedSinceLastChange, status, syncState.customRecipes, syncState.mealPlan, syncState.savedWeeks]);
}

function useGroceryValue(
  syncState: ReturnType<typeof useSharedStateSync>["state"],
  preferences: UserPreferences,
  mealServingMultipliers: Record<MealType, number>,
  status: SyncStatusValue,
  mutate: SharedStateMutator
): GroceryContextValue {
  const groceries = useMemo(
    () => syncState.mealPlan
      ? buildGroceryList(
          syncState.mealPlan,
          syncState.groceryOverrides,
          syncState.customRecipes,
          mealServingMultipliers,
          preferences.customStaples,
          preferences.sectionOrder,
          preferences.excludedIngredients,
          preferences.mealProfileId
        )
      : [],
    [mealServingMultipliers, preferences.customStaples, preferences.excludedIngredients, preferences.mealProfileId, preferences.sectionOrder, syncState.customRecipes, syncState.groceryOverrides, syncState.mealPlan]
  );
  const safeCustomItems = useMemo(
    () => syncState.customGroceryItems.filter((item) => !ingredientMatchesExcluded(item.name, preferences.excludedIngredients)),
    [preferences.excludedIngredients, syncState.customGroceryItems]
  );

  return useMemo(() => ({
    ...status,
    groceries,
    customItems: safeCustomItems,
    sectionOrder: preferences.sectionOrder,
    addCustomItem: (name, category, quantity = 1, unit = "") => {
      if (ingredientMatchesExcluded(name, preferences.excludedIngredients)) {
        return;
      }
      void mutate((current) => ({ customGroceryItems: [...current.customGroceryItems, { id: `custom::${Date.now()}::${name.toLowerCase()}`, name, quantity, unit, category, collected: false }] }));
    },
    removeCustomItem: (id) => {
      void mutate((current) => ({ customGroceryItems: current.customGroceryItems.filter((item) => item.id !== id) }));
    },
    toggleCustomItemCollected: (id) => {
      void mutate((current) => ({ customGroceryItems: current.customGroceryItems.map((item) => item.id === id ? { ...item, collected: !item.collected } : item) }));
    },
    toggleGroceryCollected: (key) => {
      void mutate((current) => {
        const override = current.groceryOverrides[key] ?? { collected: false, adjustment: 0 };
        return { groceryOverrides: { ...current.groceryOverrides, [key]: { ...override, collected: !override.collected } } };
      });
    },
    adjustGroceryQuantity: (key, delta) => {
      void mutate((current) => {
        const override = current.groceryOverrides[key] ?? { collected: false, adjustment: 0 };
        return { groceryOverrides: { ...current.groceryOverrides, [key]: { ...override, adjustment: override.adjustment + delta } } };
      });
    },
    setGroceryQuantity: (key, quantity) => {
      void mutate((current) => {
        if (!current.mealPlan) return null;
        const currentPreferences = mergePreferences(current.preferences, preferences.theme);
        const baseItem = buildGroceryList(
          current.mealPlan,
          {},
          current.customRecipes,
          getMealServingMultipliers(currentPreferences.householdMembers),
          currentPreferences.customStaples,
          currentPreferences.sectionOrder,
          currentPreferences.excludedIngredients,
          currentPreferences.mealProfileId
        ).find((item) => item.key === key);
        if (!baseItem) return null;
        const override = current.groceryOverrides[key] ?? { collected: false, adjustment: 0 };
        return { groceryOverrides: { ...current.groceryOverrides, [key]: { ...override, adjustment: Math.max(0, quantity) - baseItem.quantity } } };
      });
    },
    clearCompletedGroceries: () => {
      void mutate((current) => ({
        groceryOverrides: Object.fromEntries(Object.entries(current.groceryOverrides).filter(([, override]) => !override.collected)),
        customGroceryItems: current.customGroceryItems.filter((item) => !item.collected)
      }));
    }
  }), [groceries, mutate, preferences.excludedIngredients, preferences.sectionOrder, preferences.theme, safeCustomItems, status]);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [planSavedSinceLastChange, setPlanSavedSinceLastChange] = useState(true);

  useEffect(() => {
    const storedTheme = storage.loadTheme();
    setTheme(storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system");
  }, []);

  const sync = useSharedStateSync(theme);
  const status = useMemo(() => ({ hydrated: sync.hydrated, syncError: sync.syncError, hasLoadedSharedState: sync.hasLoadedSharedState }), [sync.hydrated, sync.syncError, sync.hasLoadedSharedState]);
  const preferences = useMemo(() => mergePreferences(sync.state.preferences, theme), [sync.state.preferences, theme]);
  const internals = useMemo(() => ({ mutate: sync.mutate, setPlanSavedSinceLastChange }), [sync.mutate]);
  const preferencesValue = usePreferencesValue(preferences, status, internals, setTheme);
  const mealPlanValue = useMealPlanValue(sync.state, preferences, status, internals, planSavedSinceLastChange);
  const groceryValue = useGroceryValue(sync.state, preferences, preferencesValue.mealServingMultipliers, status, sync.mutate);

  useEffect(() => {
    if (sync.syncError && sync.hydrated) console.error(sync.syncError);
  }, [sync.hydrated, sync.syncError]);

  return (
    <PreferencesContext.Provider value={preferencesValue}>
      <MealPlanContext.Provider value={mealPlanValue}>
        <GroceryContext.Provider value={groceryValue}>{children}</GroceryContext.Provider>
      </MealPlanContext.Provider>
    </PreferencesContext.Provider>
  );
}

export function usePreferencesState() {
  return useRequiredContext(PreferencesContext, "usePreferencesState");
}

export function useMealPlanState() {
  return useRequiredContext(MealPlanContext, "useMealPlanState");
}

export function useGroceryState() {
  return useRequiredContext(GroceryContext, "useGroceryState");
}

export function useAppState(): AppStateValue {
  const preferences = usePreferencesState();
  const mealPlan = useMealPlanState();
  const grocery = useGroceryState();
  return useMemo(() => ({ ...preferences, ...mealPlan, ...grocery }), [grocery, mealPlan, preferences]);
}
