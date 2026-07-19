import { filterSafeRecipes, formatExcludedIngredients, recipeExcludedAllergens } from "@/lib/allergens";
import { addDays, getMonday, toIsoDate } from "@/lib/date";
import { BRUNCH_MODE_MEAL_TYPES, MEAL_TYPES, STANDARD_MEAL_TYPES } from "@/lib/constants";
import { getMealParticipationAvailability } from "@/lib/household";
import { DEFAULT_MEAL_PROFILE_ID, getAllProfileRecipes, getProfileRecipes, scoreRecipeForMealProfile } from "@/lib/meal-profiles";
import { CustomRecipe, MealPlan, MealSlot, MealType, ProteinType, Recipe, UserPreferences } from "@/types";

export const recipes = getAllProfileRecipes();

type LunchDinnerMealType = Extract<MealType, "lunch" | "dinner">;

type RecipeFreshnessProfile = "fresh-fish" | "fresh-butcher" | "late-friendly" | "neutral";

interface SlotContext {
  dayIndex: number;
  mealType: LunchDinnerMealType;
  lunchDinnerIndex: number;
  lunchDinnerCount: number;
}

const FRESH_FISH_KEYWORDS = [
  "salmon",
  "cod",
  "halibut",
  "trout",
  "snapper",
  "tilapia",
  "mahi",
  "mahi mahi",
  "mahi-mahi",
  "sea bass",
  "branzino",
  "white fish",
  "fish fillet",
  "fish filet"
];

const NON_FRESH_FISH_KEYWORDS = ["tuna", "shrimp", "chowder"];

const BUTCHER_STYLE_KEYWORDS = [
  "steak",
  "sirloin",
  "flank",
  "strip steak",
  "ribeye",
  "pork chop",
  "pork chops",
  "pork loin",
  "pork tenderloin",
  "tenderloin",
  "cutlet",
  "medallion",
  "schnitzel",
  "lamb chop",
  "lamb loin",
  "leg of lamb"
];

const LATE_FRIENDLY_KEYWORDS = [
  "ground beef",
  "ground pork",
  "ground chicken",
  "ground turkey",
  "ground lamb",
  "bacon",
  "sausage",
  "meatball",
  "meatballs",
  "bolognese"
];

export function getAllRecipes(customRecipes: CustomRecipe[] = [], mealProfileId: unknown = DEFAULT_MEAL_PROFILE_ID): Recipe[] {
  return [...getProfileRecipes(mealProfileId), ...customRecipes];
}

export function getSafeRecipes(
  customRecipes: CustomRecipe[] = [],
  excludedIngredients: string[] = [],
  mealProfileId: unknown = DEFAULT_MEAL_PROFILE_ID
): Recipe[] {
  return filterSafeRecipes(getAllRecipes(customRecipes, mealProfileId), excludedIngredients);
}

export function getRecipeMap(customRecipes: CustomRecipe[] = [], _mealProfileId: unknown = DEFAULT_MEAL_PROFILE_ID) {
  return new Map([...recipes, ...customRecipes].map((recipe) => [recipe.id, recipe]));
}
export function isRecipeEligibleForMealType(recipe: Recipe, mealType: MealType) {
  if (mealType === "brunch") {
    return recipe.mealType.some((type) => type === "brunch" || type === "breakfast" || type === "lunch");
  }

  return recipe.mealType.includes(mealType);
}

function makeEmptyMeals(): Record<MealType, MealSlot> {
  return {
    breakfast: { enabled: false },
    brunch: { enabled: false },
    lunch: { enabled: false },
    dinner: { enabled: false }
  };
}

function normalizeSlot(slot: MealSlot | undefined): MealSlot {
  if (!slot?.enabled) {
    return { enabled: false };
  }

  return {
    enabled: true,
    ...(slot.recipeId ? { recipeId: slot.recipeId } : {}),
    ...(!slot.recipeId && slot.unsafeRecipeId ? { unsafeRecipeId: slot.unsafeRecipeId } : {}),
    ...(!slot.recipeId && slot.unsafeExcludedIngredients?.length
      ? { unsafeExcludedIngredients: slot.unsafeExcludedIngredients }
      : {}),
    ...(slot.consumed ? { consumed: true } : {})
  };
}

function blockUnsafeSlot(slot: MealSlot, recipeId: string, allergens: string[]): MealSlot {
  return {
    enabled: slot.enabled,
    unsafeRecipeId: recipeId,
    unsafeExcludedIngredients: allergens,
    ...(slot.consumed ? { consumed: true } : {})
  };
}

function getActiveMealTypes(preferences: UserPreferences): MealType[] {
  return preferences.brunchMode ? BRUNCH_MODE_MEAL_TYPES : STANDARD_MEAL_TYPES;
}


export function assignRecipeToSlot(
  plan: MealPlan,
  dayIndex: number,
  mealType: MealType,
  recipeId: string,
  customRecipes: CustomRecipe[] = [],
  excludedIngredients: string[] = [],
  mealProfileId: unknown = "home"
): MealPlan {
  const day = plan.days[dayIndex];

  if (!day) {
    return plan;
  }

  const slot = day.meals[mealType];
  const recipe = getRecipeMap(customRecipes, mealProfileId).get(recipeId);

  if (
    !slot.enabled ||
    slot.consumed ||
    !recipe ||
    !isRecipeEligibleForMealType(recipe, mealType) ||
    !filterSafeRecipes([recipe], excludedIngredients).length
  ) {
    return plan;
  }

  const days = [...plan.days];
  days[dayIndex] = {
    ...day,
    meals: {
      ...day.meals,
      [mealType]: {
        enabled: true,
        recipeId,
        ...(slot.consumed ? { consumed: true } : {})
      }
    }
  };

  return {
    ...plan,
    days
  };
}

export function swapRecipesBetweenSlots(
  plan: MealPlan,
  source: { dayIndex: number; mealType: MealType },
  target: { dayIndex: number; mealType: MealType },
  customRecipes: CustomRecipe[] = []
): MealPlan {
  if (source.dayIndex === target.dayIndex && source.mealType === target.mealType) {
    return plan;
  }

  const sourceDay = plan.days[source.dayIndex];
  const targetDay = plan.days[target.dayIndex];

  if (!sourceDay || !targetDay) {
    return plan;
  }

  const sourceSlot = sourceDay.meals[source.mealType];
  const targetSlot = targetDay.meals[target.mealType];

  if (
    !sourceSlot.enabled ||
    !targetSlot.enabled ||
    sourceSlot.consumed ||
    targetSlot.consumed ||
    !sourceSlot.recipeId
  ) {
    return plan;
  }

  const recipeMap = getRecipeMap(customRecipes);
  const sourceRecipe = recipeMap.get(sourceSlot.recipeId);

  if (!sourceRecipe) {
    return plan;
  }

  const days = [...plan.days];

  if (source.dayIndex === target.dayIndex) {
    const day = sourceDay;

    days[source.dayIndex] = {
      ...day,
      meals: {
        ...day.meals,
        [source.mealType]: targetSlot.recipeId
          ? { ...sourceSlot, recipeId: targetSlot.recipeId }
          : { enabled: sourceSlot.enabled },
        [target.mealType]: {
          ...targetSlot,
          recipeId: sourceSlot.recipeId
        }
      }
    };
  } else {
    days[source.dayIndex] = {
      ...sourceDay,
      meals: {
        ...sourceDay.meals,
        [source.mealType]: targetSlot.recipeId
          ? { ...sourceSlot, recipeId: targetSlot.recipeId }
          : { enabled: sourceSlot.enabled }
      }
    };

    days[target.dayIndex] = {
      ...targetDay,
      meals: {
        ...targetDay.meals,
        [target.mealType]: {
          ...targetSlot,
          recipeId: sourceSlot.recipeId
        }
      }
    };
  }

  return {
    ...plan,
    days
  };
}

function recipeSearchText(recipe: Recipe) {
  return [recipe.name, recipe.description, ...recipe.ingredients.map((ingredient) => ingredient.name)]
    .join(" ")
    .toLowerCase();
}

function includesKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isFreshFishRecipe(recipe: Recipe, text = recipeSearchText(recipe)) {
  if (!recipe.proteins.includes("fish") || includesKeyword(text, NON_FRESH_FISH_KEYWORDS)) {
    return false;
  }

  return includesKeyword(text, FRESH_FISH_KEYWORDS);
}

function isLateFriendlyRecipe(recipe: Recipe, text = recipeSearchText(recipe)) {
  return recipe.proteins.includes("chicken") || includesKeyword(text, LATE_FRIENDLY_KEYWORDS);
}

function isButcherStyleRecipe(recipe: Recipe, text = recipeSearchText(recipe)) {
  if (isFreshFishRecipe(recipe, text) || isLateFriendlyRecipe(recipe, text)) {
    return false;
  }

  return includesKeyword(text, BUTCHER_STYLE_KEYWORDS);
}

function getRecipeFreshnessProfile(recipe: Recipe, text = recipeSearchText(recipe)): RecipeFreshnessProfile {
  if (isFreshFishRecipe(recipe, text)) {
    return "fresh-fish";
  }

  if (isButcherStyleRecipe(recipe, text)) {
    return "fresh-butcher";
  }

  if (isLateFriendlyRecipe(recipe, text)) {
    return "late-friendly";
  }

  return "neutral";
}

function getLunchDinnerSlotContexts(days: MealPlan["days"]) {
  const lunchDinnerCount = days.reduce(
    (count, day) => count + Number(day.meals.lunch.enabled) + Number(day.meals.dinner.enabled),
    0
  );

  let lunchDinnerIndex = 0;

  return days.map((day, dayIndex) => {
    const contexts: Partial<Record<LunchDinnerMealType, SlotContext>> = {};

    (["lunch", "dinner"] as LunchDinnerMealType[]).forEach((mealType) => {
      if (!day.meals[mealType].enabled) {
        return;
      }

      contexts[mealType] = {
        dayIndex,
        mealType,
        lunchDinnerIndex,
        lunchDinnerCount
      };
      lunchDinnerIndex += 1;
    });

    return contexts;
  });
}

function getSlotContext(
  slotContexts: Array<Partial<Record<LunchDinnerMealType, SlotContext>>>,
  dayIndex: number,
  mealType: MealType
) {
  if (mealType !== "lunch" && mealType !== "dinner") {
    return undefined;
  }

  return slotContexts[dayIndex]?.[mealType];
}

function getWeekProgress(slotContext?: SlotContext) {
  if (!slotContext || slotContext.lunchDinnerCount <= 1) {
    return 0;
  }

  return slotContext.lunchDinnerIndex / Math.max(1, slotContext.lunchDinnerCount - 1);
}

function scoreRecipeForSlot(recipe: Recipe, slotContext?: SlotContext, mealProfileId: unknown = DEFAULT_MEAL_PROFILE_ID) {
  const profileScore = scoreRecipeForMealProfile(recipe, mealProfileId);

  if (!slotContext) {
    return profileScore;
  }

  const text = recipeSearchText(recipe);
  const weekProgress = getWeekProgress(slotContext);
  const earlyWeekBias = 1 - weekProgress;
  const lateWeekBias = weekProgress;
  const isFirstLunchDinnerSlot = slotContext.lunchDinnerIndex === 0;

  switch (getRecipeFreshnessProfile(recipe, text)) {
    case "fresh-fish":
      return profileScore + (isFirstLunchDinnerSlot ? 42 : 0) + earlyWeekBias * 14 - lateWeekBias * 6;
    case "fresh-butcher":
      return profileScore + (isFirstLunchDinnerSlot ? 6 : 0) + earlyWeekBias * 10 - lateWeekBias * 4;
    case "late-friendly":
      return profileScore + lateWeekBias * 10 - earlyWeekBias * 6 - (isFirstLunchDinnerSlot ? 10 : 0);
    default:
      return profileScore + earlyWeekBias * 1.5 - lateWeekBias * 0.5;
  }
}

function rankRecipesForSlot(recipePool: Recipe[], slotContext?: SlotContext, mealProfileId: unknown = DEFAULT_MEAL_PROFILE_ID) {
  return recipePool
    .map((recipe) => ({
      recipe,
      score: scoreRecipeForSlot(recipe, slotContext, mealProfileId),
      tiebreaker: Math.random()
    }))
    .sort((left, right) => right.score - left.score || left.tiebreaker - right.tiebreaker)
    .map(({ recipe }) => recipe);
}

function pickRankedRecipe(recipePool: Recipe[], slotContext?: SlotContext, mealProfileId: unknown = DEFAULT_MEAL_PROFILE_ID) {
  return rankRecipesForSlot(recipePool, slotContext, mealProfileId)[0];
}

function filterRecipes(
  recipePool: Recipe[],
  mealType: MealType,
  selectedProteins: ProteinType[],
  favoriteRecipeIds: string[]
) {
  const base = recipePool.filter((recipe) => isRecipeEligibleForMealType(recipe, mealType));

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

export interface MealRecipeSelectionContext {
  ordinal: number;
  total: number;
}

export function pickMealRecipe(
  recipePool: Recipe[],
  mealType: MealType,
  preferences: UserPreferences,
  usedIds: Set<string>,
  excludeIds: string[] = [],
  context?: MealRecipeSelectionContext
): Recipe {
  const slotContext = context && (mealType === "lunch" || mealType === "dinner")
    ? { dayIndex: context.ordinal, mealType, lunchDinnerIndex: context.ordinal, lunchDinnerCount: context.total }
    : undefined;

  return pickRecipe(recipePool, mealType, preferences, usedIds, excludeIds, slotContext);
}

function pickRecipe(
  recipePool: Recipe[],
  mealType: MealType,
  preferences: UserPreferences,
  usedIds: Set<string>,
  excludeIds: string[] = [],
  slotContext?: SlotContext
): Recipe {
  const { favorites, all } = filterRecipes(
    recipePool,
    mealType,
    preferences.selectedProteins,
    preferences.favoriteRecipeIds
  );

  const blocked = new Set([...usedIds, ...excludeIds]);
  const favoritePool = favorites.filter((recipe) => !blocked.has(recipe.id));
  const mainPool = all.filter((recipe) => !blocked.has(recipe.id));
  const fallbackPool = all;
  const recipe =
    pickRankedRecipe(favoritePool, slotContext, preferences.mealProfileId) ??
    pickRankedRecipe(mainPool, slotContext, preferences.mealProfileId) ??
    pickRankedRecipe(fallbackPool, slotContext, preferences.mealProfileId);

  if (!recipe) {
    throw new Error(`Meal generation blocked: no safe ${mealType} recipes remain after excluding ${formatExcludedIngredients(preferences.excludedIngredients)}.`);
  }

  return recipe;
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
  const slotContexts = getLunchDinnerSlotContexts(days);

  getActiveMealTypes(preferences).forEach((mealType) => {
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
      .filter(({ slot, config }) => slot.enabled && !slot.recipeId && !slot.consumed && config?.enabled !== false);

    const targetIndices = spreadFavoriteIndices(
      availableSlots.length,
      Math.min(
        availableSlots.length,
        favorites.filter((recipe) => !usedIds.has(recipe.id)).length
      )
    );

    targetIndices.forEach((slotIndex) => {
      const target = availableSlots[slotIndex];
      const recipe = pickRankedRecipe(
        favorites.filter((candidate) => !usedIds.has(candidate.id)),
        target ? getSlotContext(slotContexts, target.dayIndex, mealType) : undefined,
        preferences.mealProfileId
      );

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
  brunch: boolean;
  lunch: boolean;
  dinner: boolean;
}

function normalizeDayConfig(
  config: DayConfig | undefined,
  mealAvailability: Record<MealType, boolean>
): DayConfig {
  const merged = {
    enabled: true,
    breakfast: true,
    brunch: true,
    lunch: true,
    dinner: true,
    ...config
  } satisfies DayConfig;

  const breakfast = Boolean(merged.enabled && merged.breakfast && mealAvailability.breakfast);
  const brunch = Boolean(merged.enabled && merged.brunch && mealAvailability.brunch);
  const lunch = Boolean(merged.enabled && merged.lunch && mealAvailability.lunch);
  const dinner = Boolean(merged.enabled && merged.dinner && mealAvailability.dinner);

  return {
    enabled: breakfast || brunch || lunch || dinner,
    breakfast,
    brunch,
    lunch,
    dinner
  };
}

export function syncPlanMealParticipation(
  plan: MealPlan,
  preferences: UserPreferences,
  customRecipes: CustomRecipe[] = []
): MealPlan {
  const mealAvailability = getMealParticipationAvailability(preferences.householdMembers);
  const recipeMap = getRecipeMap(customRecipes);
  let changed = false;

  const days = plan.days.map((day) => {
    const meals = { ...day.meals };
    let dayChanged = false;

    (Object.keys(meals) as MealType[]).forEach((mealType) => {
      const slot = normalizeSlot(meals[mealType]);
      const enabled = Boolean(slot.enabled && mealAvailability[mealType]);

      if (!slot.recipeId) {
        if (enabled !== slot.enabled) {
          changed = true;
          dayChanged = true;
        }
        meals[mealType] = enabled
          ? { ...slot, enabled: true }
          : { enabled: false };
        return;
      }

      const recipe = recipeMap.get(slot.recipeId);
      const unsafeAllergens = recipe ? recipeExcludedAllergens(recipe, preferences.excludedIngredients) : [];
      const recipeId = enabled && (!recipe || unsafeAllergens.length === 0) ? slot.recipeId : undefined;

      if (enabled !== slot.enabled || recipeId !== slot.recipeId || (!recipeId && unsafeAllergens.length > 0)) {
        changed = true;
        dayChanged = true;
      }

      meals[mealType] = recipeId
        ? { enabled, recipeId, ...(slot.consumed ? { consumed: true } : {}) }
        : enabled && unsafeAllergens.length > 0
          ? blockUnsafeSlot(slot, slot.recipeId, unsafeAllergens)
          : { enabled };
    });

    return dayChanged ? { ...day, meals } : day;
  });

  return changed ? { ...plan, days } : plan;
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
  const recipePool = getSafeRecipes(customRecipes, preferences.excludedIngredients, preferences.mealProfileId);
  const mealAvailability = getMealParticipationAvailability(preferences.householdMembers);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = toIsoDate(addDays(weekStart, index));
    const config = normalizeDayConfig(dayConfigs?.[index], mealAvailability);

    if (!config.enabled) {
      return {
        date,
        meals: makeEmptyMeals()
      };
    }

    return {
      date,
      meals: {
        breakfast: { enabled: Boolean(config.breakfast && !preferences.brunchMode) },
        brunch: { enabled: Boolean(config.brunch && preferences.brunchMode) },
        lunch: { enabled: Boolean(config.lunch && !preferences.brunchMode) },
        dinner: { enabled: Boolean(config.dinner) }
      } as Record<MealType, MealSlot>
    };
  });

  const slotContexts = getLunchDinnerSlotContexts(days);

  placeFavoriteRecipes(days, preferences, usedIds, recipePool, dayConfigs);

  return {
    weekOf: toIsoDate(weekStart),
    days: days.map((day, dayIndex) => {
      const meals = { ...day.meals };

      (Object.keys(meals) as MealType[]).forEach((mealType) => {
        const slot = meals[mealType];

        if (!slot.enabled || slot.recipeId) {
          return;
        }

        const recipe = pickRecipe(
          recipePool,
          mealType,
          preferences,
          usedIds,
          [],
          getSlotContext(slotContexts, dayIndex, mealType)
        );
        usedIds.add(recipe.id);
        meals[mealType] = { enabled: true, recipeId: recipe.id };
      });

      return { ...day, meals };
    })
  };
}

export function normalizePlan(
  plan: MealPlan | null,
  preferences: UserPreferences,
  customRecipes: CustomRecipe[] = []
): MealPlan | null {
  const currentWeek = toIsoDate(getMonday());

  // If there's no saved plan or it's from a different week, return null
  // so the UI shows the setup screen instead of auto-generating
  if (!plan || plan.weekOf !== currentWeek || plan.days.length !== 7) {
    return null;
  }

  return syncPlanMealParticipation({
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      meals: {
        ...makeEmptyMeals(),
        ...Object.fromEntries(
          MEAL_TYPES.map((mealType) => [mealType, normalizeSlot(day.meals?.[mealType])])
        )
      } as Record<MealType, MealSlot>
    }))
  }, preferences, customRecipes);
}

export function regenerateWeek(
  plan: MealPlan,
  preferences: UserPreferences,
  customRecipes: CustomRecipe[] = []
): MealPlan {
  const usedIds = new Set<string>();
  const recipePool = getSafeRecipes(customRecipes, preferences.excludedIngredients, preferences.mealProfileId);
  const mealAvailability = getMealParticipationAvailability(preferences.householdMembers);
  const days = plan.days.map((day) => ({
    ...day,
    meals: {
      breakfast: day.meals.breakfast.consumed
        ? normalizeSlot(day.meals.breakfast)
        : { enabled: day.meals.breakfast.enabled && mealAvailability.breakfast && !preferences.brunchMode },
      brunch: day.meals.brunch.consumed
        ? normalizeSlot(day.meals.brunch)
        : { enabled: day.meals.brunch.enabled && mealAvailability.brunch && preferences.brunchMode },
      lunch: day.meals.lunch.consumed
        ? normalizeSlot(day.meals.lunch)
        : { enabled: day.meals.lunch.enabled && mealAvailability.lunch && !preferences.brunchMode },
      dinner: day.meals.dinner.consumed
        ? normalizeSlot(day.meals.dinner)
        : { enabled: day.meals.dinner.enabled && mealAvailability.dinner }
    } as Record<MealType, MealSlot>
  }));

  days.forEach((day) => {
    (Object.keys(day.meals) as MealType[]).forEach((mealType) => {
      const slot = day.meals[mealType];
      if (slot.consumed && slot.recipeId) {
        usedIds.add(slot.recipeId);
      }
    });
  });

  const slotContexts = getLunchDinnerSlotContexts(days);

  placeFavoriteRecipes(days, preferences, usedIds, recipePool);

  return {
    ...plan,
    days: days.map((day, dayIndex) => {
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

        const recipe = pickRecipe(
          recipePool,
          mealType,
          preferences,
          usedIds,
          [],
          getSlotContext(slotContexts, dayIndex, mealType)
        );
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
  const mealAvailability = getMealParticipationAvailability(preferences.householdMembers);

  const currentSlot = plan.days[dayIndex]?.meals[mealType];

  if (currentSlot?.consumed) {
    return plan;
  }

  if (!mealAvailability[mealType]) {
    const days = [...plan.days];
    const day = days[dayIndex];

    if (!day) {
      return plan;
    }

    days[dayIndex] = {
      ...day,
      meals: {
        ...day.meals,
        [mealType]: {
          enabled: false
        }
      }
    };

    return {
      ...plan,
      days
    };
  }

  const usedIds = new Set<string>();
  const currentId = currentSlot?.recipeId;
  const recipePool = getSafeRecipes(customRecipes, preferences.excludedIngredients, preferences.mealProfileId);
  const slotContexts = getLunchDinnerSlotContexts(plan.days);

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
  const effectivePrefs =
    proteinOverride && proteinOverride !== "any"
      ? { ...preferences, selectedProteins: [proteinOverride] as ProteinType[] }
      : preferences;

  const nextRecipe = pickRecipe(
    recipePool,
    mealType,
    effectivePrefs,
    usedIds,
    currentId ? [currentId] : [],
    getSlotContext(slotContexts, dayIndex, mealType)
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

export function toggleMealSlotEnabled(
  plan: MealPlan,
  dayIndex: number,
  mealType: MealType,
  preferences: UserPreferences,
  customRecipes: CustomRecipe[] = []
): MealPlan {
  const days = [...plan.days];
  const day = days[dayIndex];
  const slot = day?.meals[mealType];

  if (!day || !slot || slot.consumed) {
    return plan;
  }

  days[dayIndex] = {
    ...day,
    meals: {
      ...day.meals,
      [mealType]: {
        enabled: !slot.enabled,
        recipeId: !slot.enabled ? slot.recipeId : undefined
      }
    }
  };

  const nextPlan = { ...plan, days };

  return !slot.enabled
    ? regenerateMealSlot(nextPlan, dayIndex, mealType, preferences, customRecipes)
    : nextPlan;
}
