import recipesJson from "@/data/recipes.json";
import { addDays, getMonday, toIsoDate } from "@/lib/date";
import { CustomRecipe, MealPlan, MealType, ProteinType, Recipe, UserPreferences } from "@/types";

export const recipes = recipesJson as Recipe[];

export function getAllRecipes(customRecipes: CustomRecipe[] = []): Recipe[] {
  return [...recipes, ...customRecipes];
}

export function getRecipeMap(customRecipes: CustomRecipe[] = []) {
  return new Map(getAllRecipes(customRecipes).map((recipe) => [recipe.id, recipe]));
}

function filterRecipes(
  recipePool: Recipe[],
  mealType: MealType,
  selectedProteins: ProteinType[],
  favoriteRecipeIds: string[]
) {
  const base = recipePool.filter((recipe) => recipe.mealType.includes(mealType));

  const filtered =
    mealType === "breakfast"
      ? base
      : base.filter(
          (recipe) =>
            recipe.proteins.length === 0 ||
            recipe.proteins.some((protein) => selectedProteins.includes(protein))
        );

  const favoriteSet = new Set(favoriteRecipeIds);

  return {
    favorites: filtered.filter((recipe) => favoriteSet.has(recipe.id)),
    all: filtered
  };
}

function randomize<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function pickRecipe(
  recipePool: Recipe[],
  mealType: MealType,
  preferences: UserPreferences,
  usedIds: Set<string>,
  excludeIds: string[] = []
): Recipe {
  const { favorites, all } = filterRecipes(
    recipePool,
    mealType,
    preferences.selectedProteins,
    preferences.favoriteRecipeIds
  );

  const blocked = new Set([...usedIds, ...excludeIds]);
  const favoritePool = randomize(favorites).filter((recipe) => !blocked.has(recipe.id));
  const mainPool = randomize(all).filter((recipe) => !blocked.has(recipe.id));
  const fallbackPool = randomize(all);

  return favoritePool[0] ?? mainPool[0] ?? fallbackPool[0];
}

function spreadFavoriteIndices(slotCount: number, favoriteCount: number) {
  if (slotCount === 0 || favoriteCount === 0) {
    return [];
  }

  if (favoriteCount === 1) {
    return [Math.floor(slotCount / 2)];
  }

  return Array.from({ length: favoriteCount }, (_, index) =>
    Math.min(
      slotCount - 1,
      Math.round((index * (slotCount - 1)) / Math.max(1, favoriteCount - 1))
    )
  );
}

function placeFavoriteRecipes(
  days: MealPlan["days"],
  preferences: UserPreferences,
  usedIds: Set<string>,
  recipePool: Recipe[],
  dayConfigs?: DayConfig[]
) {
  (["breakfast", "lunch", "dinner"] as MealType[]).forEach((mealType) => {
    const { favorites } = filterRecipes(
      recipePool,
      mealType,
      preferences.selectedProteins,
      preferences.favoriteRecipeIds
    );
    const availableSlots = days
      .map((day, dayIndex) => ({
        dayIndex,
        slot: day.meals[mealType],
        config: dayConfigs?.[dayIndex]
      }))
      .filter(({ slot, config }) => slot.enabled && config?.enabled !== false);

    const favoriteRecipes = favorites.filter((recipe) => !usedIds.has(recipe.id));
    const targetIndices = spreadFavoriteIndices(
      availableSlots.length,
      Math.min(availableSlots.length, favoriteRecipes.length)
    );

    targetIndices.forEach((slotIndex, favoriteIndex) => {
      const target = availableSlots[slotIndex];
      const recipe = favoriteRecipes[favoriteIndex];

      if (!target || !recipe) {
        return;
      }

      days[target.dayIndex] = {
        ...days[target.dayIndex],
        meals: {
          ...days[target.dayIndex].meals,
          [mealType]: {
            enabled: true,
            recipeId: recipe.id
          }
        }
      };
      usedIds.add(recipe.id);
    });
  });
}

export interface DayConfig {
  enabled: boolean;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

export function createDefaultPlan(preferences: UserPreferences): MealPlan {
  return createPlanFromConfig(preferences, undefined, []);
}

export function createPlanFromConfig(
  preferences: UserPreferences,
  dayConfigs?: DayConfig[],
  customRecipes: CustomRecipe[] = []
): MealPlan {
  const weekStart = getMonday();
  const usedIds = new Set<string>();
  const defaultConfig: DayConfig = { enabled: true, breakfast: true, lunch: true, dinner: true };
  const recipePool = getAllRecipes(customRecipes);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = toIsoDate(addDays(weekStart, index));
    const config = dayConfigs?.[index] ?? defaultConfig;

    if (!config.enabled) {
      return {
        date,
        meals: {
          breakfast: { enabled: false },
          lunch: { enabled: false },
          dinner: { enabled: false }
        }
      };
    }

    return {
      date,
      meals: {
        breakfast: { enabled: Boolean(config.breakfast) },
        lunch: { enabled: Boolean(config.lunch) },
        dinner: { enabled: Boolean(config.dinner) }
      } as Record<MealType, { enabled: boolean; recipeId?: string }>
    };
  });

  placeFavoriteRecipes(days, preferences, usedIds, recipePool, dayConfigs);

  return {
    weekOf: toIsoDate(weekStart),
    days: days.map((day) => {
      const meals = { ...day.meals };

      (Object.keys(meals) as MealType[]).forEach((mealType) => {
        const slot = meals[mealType];

        if (!slot.enabled || slot.recipeId) {
          return;
        }

        const recipe = pickRecipe(recipePool, mealType, preferences, usedIds);
        usedIds.add(recipe.id);
        meals[mealType] = { enabled: true, recipeId: recipe.id };
      });

      return { ...day, meals };
    })
  };
}

export function normalizePlan(plan: MealPlan | null, _preferences: UserPreferences): MealPlan | null {
  const currentWeek = toIsoDate(getMonday());

  // If there's no saved plan or it's from a different week, return null
  // so the UI shows the setup screen instead of auto-generating
  if (!plan || plan.weekOf !== currentWeek || plan.days.length !== 7) {
    return null;
  }

  return plan;
}

export function regenerateWeek(
  plan: MealPlan,
  preferences: UserPreferences,
  customRecipes: CustomRecipe[] = []
): MealPlan {
  const usedIds = new Set<string>();
  const recipePool = getAllRecipes(customRecipes);
  const days = plan.days.map((day) => ({
    ...day,
    meals: {
      breakfast: { enabled: day.meals.breakfast.enabled },
      lunch: { enabled: day.meals.lunch.enabled },
      dinner: { enabled: day.meals.dinner.enabled }
    } as Record<MealType, { enabled: boolean; recipeId?: string }>
  }));

  placeFavoriteRecipes(days, preferences, usedIds, recipePool);

  return {
    ...plan,
    days: days.map((day) => {
      const nextMeals = { ...day.meals };

      (Object.keys(day.meals) as MealType[]).forEach((mealType) => {
        const slot = day.meals[mealType];

        if (!slot.enabled) {
          nextMeals[mealType] = { ...slot, recipeId: undefined };
          return;
        }

        if (slot.recipeId) {
          return;
        }

        const recipe = pickRecipe(recipePool, mealType, preferences, usedIds);
        usedIds.add(recipe.id);
        nextMeals[mealType] = { enabled: true, recipeId: recipe.id };
      });

      return { ...day, meals: nextMeals };
    })
  };
}

export function regenerateMealSlot(
  plan: MealPlan,
  dayIndex: number,
  mealType: MealType,
  preferences: UserPreferences,
  customRecipes: CustomRecipe[] = [],
  proteinOverride?: ProteinType | "any"
): MealPlan {
  const usedIds = new Set<string>();
  const currentId = plan.days[dayIndex]?.meals[mealType]?.recipeId;
  const recipePool = getAllRecipes(customRecipes);

  plan.days.forEach((day, index) => {
    (Object.keys(day.meals) as MealType[]).forEach((slotType) => {
      if (index === dayIndex && slotType === mealType) {
        return;
      }

      const recipeId = day.meals[slotType].recipeId;

      if (recipeId) {
        usedIds.add(recipeId);
      }
    });
  });

  // If a specific protein was requested, temporarily override preferences
  const effectivePrefs = proteinOverride && proteinOverride !== "any"
    ? { ...preferences, selectedProteins: [proteinOverride] as ProteinType[] }
    : preferences;

  const nextRecipe = pickRecipe(
    recipePool,
    mealType,
    effectivePrefs,
    usedIds,
    currentId ? [currentId] : []
  );
  const days = [...plan.days];
  const day = days[dayIndex];

  days[dayIndex] = {
    ...day,
    meals: {
      ...day.meals,
      [mealType]: {
        enabled: true,
        recipeId: nextRecipe.id
      }
    }
  };

  return {
    ...plan,
    days
  };
}
