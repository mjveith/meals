"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { DEFAULT_PREFERENCES } from "@/lib/constants";
import { ingredientMatchesExcluded, normalizeExcludedIngredients, recipeExcludedAllergens } from "@/lib/allergens";
import { migrateLegacyCustomStaplesToSharedState } from "@/lib/custom-staples";
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
  getRecipeMap,
  normalizePlan,
  regenerateMealSlot,
  regenerateWeek as regenerateWeekPlan,
  createPlanFromConfig,
  swapRecipesBetweenSlots,
  toggleMealSlotEnabled,
  type DayConfig
} from "@/lib/meal-generator";
import { storage } from "@/lib/storage";
import { SharedStateSyncError, fetchSharedState, pushSharedState } from "@/lib/sync";
import {
  CustomStaple,
  CustomRecipe,
  CustomGroceryItem,
  GroceryItem,
  HouseholdMember,
  IngredientCategory,
  MealPlan,
  MealProfileId,
  MealSlot,
  MealType,
  ProteinType,
  SavedWeek,
  SharedAppState,
  SharedPreferences,
  SharedStateResponse,
  ThemePreference,
  UserPreferences
} from "@/types";
import { formatWeekLabel } from "@/lib/date";
import { toggleFavoriteRecipeIds } from "@/lib/favorites";
import { normalizeArchivedSavedWeek } from "@/lib/saved-week";
import { normalizeMealProfileId } from "@/lib/meal-profiles";

interface AppStateValue {
  preferences: UserPreferences;
  mealPlan: MealPlan | null;
  groceries: GroceryItem[];
  customRecipes: CustomRecipe[];
  hydrated: boolean;
  syncError: string | null;
  hasLoadedSharedState: boolean;
  householdMembers: HouseholdMember[];
  servingMultiplier: number;
  mealServingMultipliers: Record<MealType, number>;
  getServingMultiplierForMeal: (mealType: MealType) => number;
  toggleProtein: (protein: ProteinType) => void;
  toggleFavoriteProtein: (protein: ProteinType) => void;
  toggleMealEnabled: (dayIndex: number, mealType: MealType) => void;
  toggleMealConsumed: (dayIndex: number, mealType: MealType) => void;
  regenerateMeal: (dayIndex: number, mealType: MealType, proteinOverride?: ProteinType | "any") => void;
  swapMeals: (
    source: { dayIndex: number; mealType: MealType },
    target: { dayIndex: number; mealType: MealType }
  ) => Promise<boolean>;
  assignRecipeToMeal: (dayIndex: number, mealType: MealType, recipeId: string) => Promise<boolean>;
  regenerateWeek: () => void;
  generatePlan: (dayConfigs: DayConfig[]) => void;
  clearPlan: () => void;
  toggleFavoriteRecipe: (recipeId: string) => void;
  setTheme: (theme: ThemePreference) => void;
  setBrunchMode: (enabled: boolean) => void;
  setMealProfile: (mealProfileId: MealProfileId) => void;
  toggleExcludedIngredient: (ingredient: string) => void;
  updateHouseholdMember: (
    id: string,
    updates: Partial<Pick<HouseholdMember, "name" | "kind" | "mealParticipation">>
  ) => void;
  addHouseholdMember: () => void;
  removeHouseholdMember: (id: string) => void;
  customStaples: CustomStaple[];
  addCustomStaple: (staple: CustomStaple) => void;
  removeCustomStaple: (name: string, unit: string, category: IngredientCategory) => void;
  sectionOrder: IngredientCategory[];
  moveSection: (category: IngredientCategory, direction: "up" | "down") => void;
  customItems: CustomGroceryItem[];
  addCustomItem: (
    name: string,
    category: IngredientCategory,
    quantity?: number,
    unit?: string
  ) => void;
  removeCustomItem: (id: string) => void;
  addCustomRecipe: (
    recipe: Omit<CustomRecipe, "id" | "isCustom">,
    options?: { favorite?: boolean; assignTo?: { dayIndex: number; mealType: MealType } }
  ) => Promise<CustomRecipe>;
  removeCustomRecipe: (id: CustomRecipe["id"]) => void;
  toggleCustomItemCollected: (id: string) => void;
  toggleGroceryCollected: (key: string) => void;
  adjustGroceryQuantity: (key: string, delta: number) => void;
  setGroceryQuantity: (key: string, quantity: number) => void;
  clearCompletedGroceries: () => void;
  savedWeeks: SavedWeek[];
  saveCurrentWeek: () => Promise<SavedWeek | null>;
  deleteSavedWeek: (id: string) => void;
  planSavedSinceLastChange: boolean;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const DEFAULT_SHARED_PREFERENCES: SharedPreferences = {
  selectedProteins: DEFAULT_PREFERENCES.selectedProteins,
  favoriteProteins: DEFAULT_PREFERENCES.favoriteProteins,
  favoriteRecipeIds: DEFAULT_PREFERENCES.favoriteRecipeIds,
  adults: DEFAULT_PREFERENCES.adults,
  children: DEFAULT_PREFERENCES.children,
  householdMembers: DEFAULT_PREFERENCES.householdMembers,
  customStaples: DEFAULT_PREFERENCES.customStaples,
  sectionOrder: DEFAULT_PREFERENCES.sectionOrder,
  brunchMode: DEFAULT_PREFERENCES.brunchMode,
  excludedIngredients: DEFAULT_PREFERENCES.excludedIngredients,
  mealProfileId: DEFAULT_PREFERENCES.mealProfileId
};

function mergePreferences(
  sharedPreferences: SharedPreferences,
  theme: ThemePreference
): UserPreferences {
  const householdMembers = normalizeHouseholdMembers(
    sharedPreferences.householdMembers,
    sharedPreferences.adults ?? DEFAULT_SHARED_PREFERENCES.adults,
    sharedPreferences.children ?? DEFAULT_SHARED_PREFERENCES.children
  );
  const householdCounts = countHouseholdMembers(householdMembers);

  return {
    ...DEFAULT_PREFERENCES,
    ...sharedPreferences,
    adults: householdCounts.adults,
    children: householdCounts.children,
    householdMembers,
    selectedProteins: Array.from(
      new Set([
        ...(sharedPreferences.selectedProteins ?? DEFAULT_SHARED_PREFERENCES.selectedProteins),
        ...(sharedPreferences.favoriteProteins ?? DEFAULT_SHARED_PREFERENCES.favoriteProteins)
      ])
    ) as ProteinType[],
    excludedIngredients: normalizeExcludedIngredients(sharedPreferences.excludedIngredients),
    mealProfileId: normalizeMealProfileId(sharedPreferences.mealProfileId),
    theme
  };
}

function normalizeSharedState(state: SharedAppState, theme: ThemePreference): SharedAppState {
  const preferences = mergePreferences(state.preferences, theme);

  return {
    preferences: {
      selectedProteins: preferences.selectedProteins,
      favoriteProteins: preferences.favoriteProteins,
      favoriteRecipeIds: preferences.favoriteRecipeIds,
      adults: preferences.adults,
      children: preferences.children,
      householdMembers: preferences.householdMembers,
      customStaples: preferences.customStaples,
      sectionOrder: preferences.sectionOrder,
      brunchMode: preferences.brunchMode,
      excludedIngredients: preferences.excludedIngredients,
      mealProfileId: preferences.mealProfileId
    },
    mealPlan: normalizePlan(state.mealPlan, preferences, state.customRecipes ?? []),
    groceryOverrides: state.groceryOverrides ?? {},
    customGroceryItems: state.customGroceryItems ?? [],
    customRecipes: state.customRecipes ?? [],
    savedWeeks: [...(state.savedWeeks ?? [])]
      .map(normalizeArchivedSavedWeek)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [sharedPreferences, setSharedPreferences] = useState(DEFAULT_SHARED_PREFERENCES);
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [groceryOverrides, setGroceryOverrides] = useState<
    Record<string, { collected: boolean; adjustment: number }>
  >({});
  const [customItems, setCustomItems] = useState<CustomGroceryItem[]>([]);
  const [customRecipes, setCustomRecipes] = useState<CustomRecipe[]>([]);
  const [savedWeeks, setSavedWeeks] = useState<SavedWeek[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [hasLoadedSharedState, setHasLoadedSharedState] = useState(false);
  const [planSavedSinceLastChange, setPlanSavedSinceLastChange] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const etagRef = useRef<string | null>(null);
  const versionRef = useRef<number>(0);
  const isMutatingRef = useRef(false);
  const sharedStateRef = useRef<SharedAppState>({
    preferences: DEFAULT_SHARED_PREFERENCES,
    mealPlan: null,
    groceryOverrides: {},
    customGroceryItems: [],
    customRecipes: [],
    savedWeeks: []
  });
  const themeRef = useRef<ThemePreference>("system");
  const mutationQueueRef = useRef<Promise<boolean>>(Promise.resolve(false));

  const applyRemoteState = (state: SharedAppState, nextVersion: number, nextEtag: string | null) => {
    const normalized = normalizeSharedState(state, themeRef.current);
    sharedStateRef.current = normalized;
    versionRef.current = nextVersion;
    etagRef.current = nextEtag;
    setSharedPreferences(normalized.preferences);
    setMealPlan(normalized.mealPlan);
    setGroceryOverrides(normalized.groceryOverrides);
    setCustomItems(normalized.customGroceryItems);
    setCustomRecipes(normalized.customRecipes);
    setSavedWeeks(normalized.savedWeeks);
  };

  useEffect(() => {
    const storedTheme = storage.loadTheme();
    const nextTheme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
      ? storedTheme
      : "system";

    themeRef.current = nextTheme;
    setThemeState(nextTheme);

    let cancelled = false;

    const hydrate = async () => {
      try {
        const response = await fetchSharedState();

        if (cancelled || !response.state) {
          return;
        }

        const migrated = await migrateLegacyCustomStaplesToSharedState(
          response.state,
          response.etag,
          {
            hasMigrationCompleted: storage.hasLegacyCustomStaplesMigration,
            loadLegacyCustomStaples: storage.loadLegacyCustomStaples,
            markMigrationComplete: storage.markLegacyCustomStaplesMigrationComplete,
            pushSharedState
          }
        );

        if (cancelled) {
          return;
        }

        applyRemoteState(migrated.state, migrated.version, migrated.etag);
        setHasLoadedSharedState(true);
        setSyncError(migrated.syncError);
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : "Unable to load shared state");
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const interval = window.setInterval(() => {
      if (isMutatingRef.current) {
        return;
      }

      void (async () => {
        try {
          const response = await fetchSharedState(etagRef.current ?? undefined);

          if (response.notModified || !response.state) {
            return;
          }

          if (response.state.version === versionRef.current) {
            etagRef.current = response.etag;
            return;
          }

          applyRemoteState(response.state, response.state.version, response.etag);
          setSyncError(null);
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : "Unable to refresh shared state");
        }
      })();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [hydrated]);

  const preferences = useMemo(
    () => mergePreferences(sharedPreferences, theme),
    [sharedPreferences, theme]
  );

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const mealServingMultipliers = useMemo(
    () => getMealServingMultipliers(preferences.householdMembers),
    [preferences.householdMembers]
  );

  // Recipes assume ~4 servings. Scale based on the full household by default,
  // then use per-meal multipliers where meal participation differs.
  const servingMultiplier = useMemo(
    () => getFullHouseholdServingMultiplier(preferences.householdMembers),
    [preferences.householdMembers]
  );

  const safeCustomItems = useMemo(
    () => customItems.filter((item) => !ingredientMatchesExcluded(item.name, preferences.excludedIngredients)),
    [customItems, preferences.excludedIngredients]
  );

  const groceries = useMemo(
    () =>
      mealPlan
        ? buildGroceryList(
            mealPlan,
            groceryOverrides,
            customRecipes,
            mealServingMultipliers,
            preferences.customStaples,
            preferences.sectionOrder,
            preferences.excludedIngredients,
            preferences.mealProfileId
          )
        : [],
    [
      customRecipes,
      mealPlan,
      groceryOverrides,
      mealServingMultipliers,
      preferences.customStaples,
      preferences.sectionOrder,
      preferences.excludedIngredients,
      preferences.mealProfileId
    ]
  );

  const enqueueMutation = (
    updater: (current: SharedAppState, currentPreferences: UserPreferences) => Partial<SharedAppState> | null
  ) => {
    mutationQueueRef.current = mutationQueueRef.current.then(async () => {
      if (!hydrated) {
        return false;
      }

      if (!hasLoadedSharedState) {
        setSyncError("Shared state is not loaded yet. Retry once Meals reconnects.");
        return false;
      }

      const tryMutation = async (current: SharedAppState, etag?: string) => {
        const currentPreferences = mergePreferences(current.preferences, themeRef.current);
        const patch = updater(current, currentPreferences);

        if (!patch) {
          return { status: "noop" as const };
        }

        const response = await pushSharedState(patch, etag);
        applyRemoteState(response.state, response.state.version, response.etag);
        setSyncError(null);
        return { status: "applied" as const };
      };

      isMutatingRef.current = true;

      try {
        try {
          const result = await tryMutation(sharedStateRef.current, etagRef.current ?? undefined);
          return result.status === "applied";
        } catch (error) {
          if (error instanceof SharedStateSyncError && error.status === 412) {
            try {
              const latest = await fetchSharedState();

              if (latest.state) {
                applyRemoteState(latest.state, latest.state.version, latest.etag);
                const retryResult = await tryMutation(latest.state, latest.etag ?? undefined);
                return retryResult.status === "applied";
              }
            } catch (retryError) {
              if (retryError instanceof SharedStateSyncError && retryError.status === 412) {
                setSyncError("Meals changed again before this update could finish. Please try that action once more.");
                return false;
              }

              setSyncError(retryError instanceof Error ? retryError.message : "Unable to save shared state");
              return false;
            }

            setSyncError("Meals was updated elsewhere before this save finished. Latest state is loaded, please retry.");
            return false;
          }

          setSyncError(error instanceof Error ? error.message : "Unable to save shared state");
          return false;
        }
      } finally {
        isMutatingRef.current = false;
      }
    });

    return mutationQueueRef.current;
  };

  const value = useMemo<AppStateValue>(
    () => ({
      preferences,
      mealPlan,
      groceries,
      customRecipes,
      hydrated,
      syncError,
      hasLoadedSharedState,
      householdMembers: preferences.householdMembers,
      servingMultiplier,
      mealServingMultipliers,
      getServingMultiplierForMeal: (mealType) => mealServingMultipliers[mealType],
      toggleProtein: (protein) => {
        enqueueMutation((current, currentPreferences) => {
          const selected = currentPreferences.selectedProteins.includes(protein)
            ? currentPreferences.selectedProteins.filter((item) => item !== protein)
            : [...currentPreferences.selectedProteins, protein];

          if (selected.length === 0) {
            return null;
          }

          return {
            preferences: {
              ...current.preferences,
              selectedProteins: Array.from(
                new Set([...selected, ...currentPreferences.favoriteProteins])
              ) as ProteinType[]
            }
          };
        });
      },
      toggleFavoriteProtein: (protein) => {
        enqueueMutation((current, currentPreferences) => {
          const isFavorite = currentPreferences.favoriteProteins.includes(protein);
          const favoriteProteins = isFavorite
            ? currentPreferences.favoriteProteins.filter((item) => item !== protein)
            : [...currentPreferences.favoriteProteins, protein];

          const selectedProteins = Array.from(
            new Set(
              isFavorite
                ? currentPreferences.selectedProteins
                : [...currentPreferences.selectedProteins, protein]
            )
          ) as ProteinType[];

          return {
            preferences: {
              ...current.preferences,
              favoriteProteins,
              selectedProteins
            }
          };
        });
      },
      toggleMealEnabled: (dayIndex, mealType) => {
        enqueueMutation((current, currentPreferences) => {
          if (!current.mealPlan) {
            return null;
          }

          const nextPlan = toggleMealSlotEnabled(
            current.mealPlan,
            dayIndex,
            mealType,
            currentPreferences,
            current.customRecipes
          );

          if (nextPlan === current.mealPlan) {
            return null;
          }

          return { mealPlan: nextPlan };
        });
        setPlanSavedSinceLastChange(false);
      },
      toggleMealConsumed: (dayIndex, mealType) => {
        enqueueMutation((current) => {
          if (!current.mealPlan) {
            return null;
          }

          const day = current.mealPlan.days[dayIndex];
          const slot = day?.meals[mealType];

          if (!day || !slot?.enabled || !slot.recipeId) {
            return null;
          }

          const days = [...current.mealPlan.days];
          days[dayIndex] = {
            ...day,
            meals: {
              ...day.meals,
              [mealType]: {
                ...slot,
                consumed: !slot.consumed
              }
            }
          };

          return { mealPlan: { ...current.mealPlan, days } };
        });
        setPlanSavedSinceLastChange(false);
      },
      regenerateMeal: (dayIndex, mealType, proteinOverride?) => {
        enqueueMutation((current, currentPreferences) =>
          current.mealPlan && !current.mealPlan.days[dayIndex]?.meals[mealType]?.consumed
            ? {
                mealPlan: regenerateMealSlot(
                  current.mealPlan,
                  dayIndex,
                  mealType,
                  currentPreferences,
                  current.customRecipes,
                  proteinOverride
                )
              }
            : null
        );
        setPlanSavedSinceLastChange(false);
      },
      swapMeals: async (source, target) => {
        const changed = await enqueueMutation((current) => {
          if (!current.mealPlan) {
            return null;
          }

          const nextPlan = swapRecipesBetweenSlots(
            current.mealPlan,
            source,
            target,
            current.customRecipes
          );

          if (nextPlan === current.mealPlan) {
            return null;
          }

          return {
            mealPlan: nextPlan
          };
        });

        if (changed) {
          setPlanSavedSinceLastChange(false);
        }

        return changed;
      },
      assignRecipeToMeal: async (dayIndex, mealType, recipeId) => {
        const changed = await enqueueMutation((current, currentPreferences) => {
          if (!current.mealPlan) {
            return null;
          }

          const nextPlan = assignRecipeToSlot(
            current.mealPlan,
            dayIndex,
            mealType,
            recipeId,
            current.customRecipes,
            currentPreferences.excludedIngredients,
            currentPreferences.mealProfileId
          );

          if (nextPlan === current.mealPlan) {
            return null;
          }

          return {
            mealPlan: nextPlan
          };
        });

        if (changed) {
          setPlanSavedSinceLastChange(false);
        }

        return changed;
      },
      regenerateWeek: () => {
        enqueueMutation((current, currentPreferences) =>
          current.mealPlan
            ? {
                mealPlan: regenerateWeekPlan(
                  current.mealPlan,
                  currentPreferences,
                  current.customRecipes
                )
              }
            : null
        );
        setPlanSavedSinceLastChange(false);
      },
      generatePlan: (dayConfigs) => {
        enqueueMutation((current, currentPreferences) => ({
          mealPlan: createPlanFromConfig(currentPreferences, dayConfigs, current.customRecipes),
          groceryOverrides: {}
        }));
        setPlanSavedSinceLastChange(false);
      },
      clearPlan: () => {
        enqueueMutation(() => ({
          mealPlan: null,
          groceryOverrides: {}
        }));
        setPlanSavedSinceLastChange(true);
      },
      toggleFavoriteRecipe: (recipeId) => {
        enqueueMutation((current, currentPreferences) => ({
          preferences: {
            ...current.preferences,
            favoriteRecipeIds: toggleFavoriteRecipeIds(currentPreferences.favoriteRecipeIds, recipeId)
          }
        }));
      },
      setTheme: (nextTheme) => {
        storage.saveTheme(nextTheme);
        themeRef.current = nextTheme;
        setThemeState(nextTheme);
      },
      setBrunchMode: (enabled) => {
        enqueueMutation((current) => ({
          preferences: {
            ...current.preferences,
            brunchMode: enabled
          }
        }));
      },
      setMealProfile: (mealProfileId) => {
        enqueueMutation((current) => ({
          preferences: {
            ...current.preferences,
            mealProfileId: normalizeMealProfileId(mealProfileId)
          },
          groceryOverrides: {}
        }));
        setPlanSavedSinceLastChange(false);
      },
      toggleExcludedIngredient: (ingredient) => {
        enqueueMutation((current, currentPreferences) => {
          const currentExcluded = normalizeExcludedIngredients(currentPreferences.excludedIngredients);
          const normalized = ingredient.trim().toLowerCase();
          const excludedIngredients = currentExcluded.includes(normalized)
            ? currentExcluded.filter((item) => item !== normalized)
            : normalizeExcludedIngredients([...currentExcluded, normalized]);
          const unsafeRecipes = new Map(
            [...getRecipeMap(current.customRecipes).values()]
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
                            unsafeExcludedIngredients: unsafeRecipes.get(slot.recipeId)
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
        enqueueMutation((current, currentPreferences) => {
          const householdMembers = currentPreferences.householdMembers.map((member) =>
            member.id === id
              ? {
                  ...member,
                  ...updates,
                  name: updates.name?.trim() || member.name,
                  mealParticipation: updates.mealParticipation ?? member.mealParticipation
                }
              : member
          );
          const normalizedMembers = normalizeHouseholdMembers(
            householdMembers,
            currentPreferences.adults,
            currentPreferences.children
          );
          const householdCounts = countHouseholdMembers(normalizedMembers);

          return {
            preferences: {
              ...current.preferences,
              adults: householdCounts.adults,
              children: householdCounts.children,
              householdMembers: normalizedMembers
            }
          };
        });
        setPlanSavedSinceLastChange(false);
      },
      addHouseholdMember: () => {
        enqueueMutation((current, currentPreferences) => {
          const householdMembers = [
            ...currentPreferences.householdMembers,
            createBlankHouseholdMember(currentPreferences.householdMembers)
          ];
          const householdCounts = countHouseholdMembers(householdMembers);

          return {
            preferences: {
              ...current.preferences,
              adults: householdCounts.adults,
              children: householdCounts.children,
              householdMembers
            }
          };
        });
        setPlanSavedSinceLastChange(false);
      },
      removeHouseholdMember: (id) => {
        enqueueMutation((current, currentPreferences) => {
          if (currentPreferences.householdMembers.length <= 1) {
            return null;
          }

          const householdMembers = currentPreferences.householdMembers.filter((member) => member.id !== id);
          const householdCounts = countHouseholdMembers(householdMembers);

          return {
            preferences: {
              ...current.preferences,
              adults: householdCounts.adults,
              children: householdCounts.children,
              householdMembers
            }
          };
        });
        setPlanSavedSinceLastChange(false);
      },
      customStaples: preferences.customStaples,
      sectionOrder: preferences.sectionOrder,
      addCustomStaple: (staple) => {
        enqueueMutation((current, currentPreferences) => ({
          preferences: {
            ...current.preferences,
            customStaples: [
              ...currentPreferences.customStaples,
              {
                name: staple.name.trim(),
                quantity: Math.max(0.01, Math.round(staple.quantity * 100) / 100),
                unit: staple.unit.trim(),
                category: staple.category
              }
            ]
          }
        }));
      },
      removeCustomStaple: (name, unit, category) => {
        enqueueMutation((current) => ({
          preferences: {
            ...current.preferences,
            customStaples: current.preferences.customStaples.filter(
              (staple) =>
                !(staple.name === name && staple.unit === unit && staple.category === category)
            )
          }
        }));
      },
      moveSection: (category, direction) => {
        enqueueMutation((current, currentPreferences) => {
          const order = [...currentPreferences.sectionOrder];
          const index = order.indexOf(category);

          if (index === -1) {
            return null;
          }

          const swapIndex = direction === "up" ? index - 1 : index + 1;

          if (swapIndex < 0 || swapIndex >= order.length) {
            return null;
          }

          [order[index], order[swapIndex]] = [order[swapIndex], order[index]];

          return {
            preferences: {
              ...current.preferences,
              sectionOrder: order
            }
          };
        });
      },
      customItems: safeCustomItems,
      addCustomItem: (name, category, quantity = 1, unit = "") => {
        if (ingredientMatchesExcluded(name, preferences.excludedIngredients)) {
          setSyncError(`${name} is excluded by allergen preferences and was not added.`);
          return;
        }

        enqueueMutation((current) => {
          const id = `custom::${Date.now()}::${name.toLowerCase()}`;
          return {
            customGroceryItems: [
              ...current.customGroceryItems,
              { id, name, quantity, unit, category, collected: false }
            ]
          };
        });
      },
      removeCustomItem: (id) => {
        enqueueMutation((current) => ({
          customGroceryItems: current.customGroceryItems.filter((item) => item.id !== id)
        }));
      },
      addCustomRecipe: async (recipe, options) => {
        if (recipe.ingredients.some((item) => ingredientMatchesExcluded(item.name, preferences.excludedIngredients))) {
          throw new Error("Custom recipe contains an excluded allergen and was not saved.");
        }

        let nextRecipe: CustomRecipe | null = null;

        await enqueueMutation((current) => {
          const createdRecipe: CustomRecipe = {
            ...recipe,
            id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` as CustomRecipe["id"],
            isCustom: true
          };
          nextRecipe = createdRecipe;

          const nextFavoriteIds = options?.favorite
            ? Array.from(new Set([...current.preferences.favoriteRecipeIds, createdRecipe.id]))
            : current.preferences.favoriteRecipeIds;
          const nextPlan = options?.assignTo && current.mealPlan
            ? {
                ...current.mealPlan,
                days: current.mealPlan.days.map((day, index) =>
                  index === options.assignTo?.dayIndex
                    ? {
                        ...day,
                        meals: {
                          ...day.meals,
                          [options.assignTo.mealType]: {
                            enabled: true,
                            recipeId: createdRecipe.id
                          }
                        }
                      }
                    : day
                )
              }
            : current.mealPlan;

          return {
            customRecipes: [...current.customRecipes, createdRecipe],
            preferences: {
              ...current.preferences,
              favoriteRecipeIds: nextFavoriteIds
            },
            mealPlan: nextPlan
          };
        });

        if (!nextRecipe) {
          throw new Error("Unable to create custom recipe");
        }

        setPlanSavedSinceLastChange(false);
        return nextRecipe;
      },
      removeCustomRecipe: (id) => {
        enqueueMutation((current) => ({
          customRecipes: current.customRecipes.filter((recipe) => recipe.id !== id),
          preferences: {
            ...current.preferences,
            favoriteRecipeIds: current.preferences.favoriteRecipeIds.filter((recipeId) => recipeId !== id)
          },
          mealPlan: current.mealPlan
            ? {
                ...current.mealPlan,
                days: current.mealPlan.days.map((day) => ({
                  ...day,
                  meals: {
                    breakfast:
                      day.meals.breakfast.recipeId === id
                        ? { enabled: day.meals.breakfast.enabled }
                        : day.meals.breakfast,
                    brunch:
                      day.meals.brunch.recipeId === id
                        ? { enabled: day.meals.brunch.enabled }
                        : day.meals.brunch,
                    lunch:
                      day.meals.lunch.recipeId === id
                        ? { enabled: day.meals.lunch.enabled }
                        : day.meals.lunch,
                    dinner:
                      day.meals.dinner.recipeId === id
                        ? { enabled: day.meals.dinner.enabled }
                        : day.meals.dinner
                  }
                }))
              }
            : null
        }));
      },
      toggleCustomItemCollected: (id) => {
        enqueueMutation((current) => ({
          customGroceryItems: current.customGroceryItems.map((item) =>
            item.id === id ? { ...item, collected: !item.collected } : item
          )
        }));
      },
      toggleGroceryCollected: (key) => {
        enqueueMutation((current) => {
          const override = current.groceryOverrides[key] ?? { collected: false, adjustment: 0 };

          return {
            groceryOverrides: {
              ...current.groceryOverrides,
              [key]: {
                ...override,
                collected: !override.collected
              }
            }
          };
        });
      },
      adjustGroceryQuantity: (key, delta) => {
        enqueueMutation((current) => {
          const override = current.groceryOverrides[key] ?? { collected: false, adjustment: 0 };

          return {
            groceryOverrides: {
              ...current.groceryOverrides,
              [key]: {
                ...override,
                adjustment: override.adjustment + delta
              }
            }
          };
        });
      },
      setGroceryQuantity: (key, quantity) => {
        enqueueMutation((current) => {
          if (!current.mealPlan) {
            return null;
          }

          const currentPreferences = mergePreferences(current.preferences, themeRef.current);
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

          if (!baseItem) {
            return null;
          }

          const override = current.groceryOverrides[key] ?? { collected: false, adjustment: 0 };

          return {
            groceryOverrides: {
              ...current.groceryOverrides,
              [key]: {
                ...override,
                adjustment: Math.max(0, quantity) - baseItem.quantity
              }
            }
          };
        });
      },
      clearCompletedGroceries: () => {
        enqueueMutation((current) => ({
          groceryOverrides: Object.fromEntries(
            Object.entries(current.groceryOverrides).filter(([, override]) => !override.collected)
          ),
          customGroceryItems: current.customGroceryItems.filter((item) => !item.collected)
        }));
      },
      planSavedSinceLastChange,
      savedWeeks,
      saveCurrentWeek: async () => {
        let nextSavedWeek: SavedWeek | null = null;

        await enqueueMutation((current, currentPreferences) => {
          if (!current.mealPlan) {
            return null;
          }

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
            customGroceryItems: current.customGroceryItems.filter(
              (item) => !item.collected && !ingredientMatchesExcluded(item.name, currentPreferences.excludedIngredients)
            )
          };
          nextSavedWeek = savedWeek;

          return {
            savedWeeks: [savedWeek, ...current.savedWeeks].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
          };
        });

        setPlanSavedSinceLastChange(true);
        return nextSavedWeek;
      },
      deleteSavedWeek: (id) => {
        enqueueMutation((current) => ({
          savedWeeks: current.savedWeeks.filter((week) => week.id !== id)
        }));
      }
    }),
    [
      safeCustomItems,
      customRecipes,
      groceries,
      hasLoadedSharedState,
      hydrated,
      mealServingMultipliers,
      mealPlan,
      planSavedSinceLastChange,
      preferences,
      savedWeeks,
      servingMultiplier,
      syncError
    ]
  );

  useEffect(() => {
    if (syncError && hydrated) {
      console.error(syncError);
    }
  }, [hydrated, syncError]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return context;
}
