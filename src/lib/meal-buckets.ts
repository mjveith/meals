import { recipeExcludedAllergens } from "@/lib/allergens";
import { MEAL_TYPES } from "@/lib/constants";
import { getMealParticipationAvailability } from "@/lib/household";
import { getRecipeMap, getSafeRecipes, isRecipeEligibleForMealType, pickMealRecipe } from "@/lib/meal-generator";
import { BucketMealPlan, CustomRecipe, MealCounts, MealPlan, MealSlot, MealType, PlannedMeal, UserPreferences } from "@/types";

export type { BucketMealPlan, MealCounts, PlannedMeal } from "@/types";

const emptyBuckets = (): Record<MealType, PlannedMeal[]> => ({ breakfast: [], brunch: [], lunch: [], dinner: [] });
const emptyCounts = (): MealCounts => ({ breakfast: 0, brunch: 0, lunch: 0, dinner: 0 });
const isMealType = (value: unknown): value is MealType => typeof value === "string" && (MEAL_TYPES as readonly string[]).includes(value);
const asString = (value: unknown) => typeof value === "string" && value.trim() ? value : undefined;
const asBoolean = (value: unknown) => value === true;

function count(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(50, Math.max(0, Math.trunc(value))) : 0;
}

export function normalizeMealCounts(raw: Partial<MealCounts> | unknown, preferences: UserPreferences): MealCounts {
  const source = raw && typeof raw === "object" ? raw as Partial<MealCounts> : {};
  const availability = getMealParticipationAvailability(preferences.householdMembers);
  return MEAL_TYPES.reduce((counts, mealType) => {
    counts[mealType] = availability[mealType] ? count(source[mealType]) : 0;
    return counts;
  }, emptyCounts());
}

function makePlanId() {
  return `bucket-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getLunchDinnerFreshnessContext(requestedCounts: MealCounts, mealType: MealType, index: number) {
  if (mealType !== "lunch" && mealType !== "dinner") return undefined;
  const lunchCount = requestedCounts.lunch;
  return { ordinal: mealType === "lunch" ? index : lunchCount + index, total: lunchCount + requestedCounts.dinner };
}

function selectRecipe(requestedCounts: MealCounts, mealType: MealType, index: number, preferences: UserPreferences, customRecipes: CustomRecipe[], usedIds: Set<string>, excludeIds: string[] = []) {
  return pickMealRecipe(
    getSafeRecipes(customRecipes, preferences.excludedIngredients, preferences.mealProfileId),
    mealType,
    preferences,
    usedIds,
    excludeIds,
    getLunchDinnerFreshnessContext(requestedCounts, mealType, index)
  );
}

export function createBucketPlan(preferences: UserPreferences, rawCounts: Partial<MealCounts>, customRecipes: CustomRecipe[] = []): BucketMealPlan {
  const requestedCounts = normalizeMealCounts(rawCounts, preferences);
  if (MEAL_TYPES.every((mealType) => requestedCounts[mealType] === 0)) {
    throw new Error("Choose at least one meal before creating a bucket plan.");
  }
  const id = makePlanId();
  const plan: BucketMealPlan = { schemaVersion: 2, id, createdAt: new Date().toISOString(), requestedCounts, buckets: emptyBuckets() };
  const usedIds = new Set<string>();
  MEAL_TYPES.forEach((mealType) => {
    plan.buckets[mealType] = Array.from({ length: requestedCounts[mealType] }, (_, index) => {
      const recipe = selectRecipe(requestedCounts, mealType, index, preferences, customRecipes, usedIds);
      usedIds.add(recipe.id);
      return { id: `${id}-${mealType}-${index + 1}`, mealType, recipeId: recipe.id };
    });
  });
  return plan;
}

function normalizeMeal(raw: unknown, mealType: MealType, fallbackId: string): PlannedMeal | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = asString(value.id) ?? fallbackId;
  const recipeId = asString(value.recipeId);
  const unsafeRecipeId = recipeId ? undefined : asString(value.unsafeRecipeId);
  if (!recipeId && !unsafeRecipeId) return null;
  const unsafeExcludedIngredients = Array.isArray(value.unsafeExcludedIngredients)
    ? value.unsafeExcludedIngredients.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
  return {
    id, mealType, ...(recipeId ? { recipeId } : { unsafeRecipeId }),
    ...(!recipeId && unsafeExcludedIngredients.length ? { unsafeExcludedIngredients } : {}),
    ...(asBoolean(value.consumed) ? { consumed: true, ...(asString(value.consumedAt) ? { consumedAt: asString(value.consumedAt) } : {}) } : {})
  };
}

function countsFromBuckets(buckets: Record<MealType, PlannedMeal[]>): MealCounts {
  return MEAL_TYPES.reduce((counts, mealType) => { counts[mealType] = buckets[mealType].length; return counts; }, emptyCounts());
}

function isValidDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(`${value}T`);
}

function isValidIsoTimestamp(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)));
}

function migrateLegacyPlan(raw: Record<string, unknown>): BucketMealPlan | null {
  const buckets = emptyBuckets();
  const days = Array.isArray(raw.days) ? raw.days : [];
  days
    .map((day, index) => ({ day, index, date: day && typeof day === "object" ? asString((day as Record<string, unknown>).date) ?? "" : "" }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.index - right.index)
    .forEach(({ day, index }) => {
      if (!day || typeof day !== "object") return;
      const meals = (day as Record<string, unknown>).meals;
      if (!meals || typeof meals !== "object") return;
      MEAL_TYPES.forEach((mealType) => {
        const slot = (meals as Record<string, unknown>)[mealType];
        if (!slot || typeof slot !== "object" || (slot as MealSlot).enabled !== true) return;
        const entry = normalizeMeal(slot, mealType, `legacy-${asString(raw.weekOf) ?? "unknown"}-${index}-${mealType}`);
        if (entry) buckets[mealType].push(entry);
      });
    });
  if (MEAL_TYPES.every((mealType) => buckets[mealType].length === 0)) return null;
  const weekOf = asString(raw.weekOf);
  const idToken = weekOf?.replace(/[^a-zA-Z0-9_-]/g, "-") || "unknown";
  return { schemaVersion: 2, id: `legacy-${idToken}`, createdAt: isValidDate(weekOf) ? `${weekOf}T00:00:00.000Z` : new Date(0).toISOString(), requestedCounts: countsFromBuckets(buckets), buckets };
}

export function normalizeBucketPlan(raw: unknown, _preferences: UserPreferences): BucketMealPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.schemaVersion !== 2) return Array.isArray(value.days) ? migrateLegacyPlan(value) : null;
  if (!value.buckets || typeof value.buckets !== "object") return null;
  const buckets = emptyBuckets();
  const rawBuckets = value.buckets as Record<string, unknown>;
  const rawIdCounts = new Map<string, number>();
  MEAL_TYPES.forEach((mealType) => {
    const entries = Array.isArray(rawBuckets[mealType]) ? rawBuckets[mealType] : [];
    entries.slice(0, 50).forEach((entry) => {
      const id = entry && typeof entry === "object" ? asString((entry as Record<string, unknown>).id) : undefined;
      if (id) rawIdCounts.set(id, (rawIdCounts.get(id) ?? 0) + 1);
    });
  });
  const reservedIds = new Set([...rawIdCounts].filter(([, occurrences]) => occurrences === 1).map(([id]) => id));
  const usedIds = new Set<string>();
  MEAL_TYPES.forEach((mealType) => {
    const entries = Array.isArray(rawBuckets[mealType]) ? rawBuckets[mealType] : [];
    buckets[mealType] = entries.slice(0, 50).map((entry, index) => {
      const fallbackId = `bucket-normalized-${mealType}-${index + 1}`;
      const hasExplicitId = Boolean(entry && typeof entry === "object" && asString((entry as Record<string, unknown>).id));
      const meal = normalizeMeal(entry, mealType, fallbackId);
      if (!meal) return null;
      let id = meal.id;
      if (usedIds.has(id) || (!hasExplicitId && reservedIds.has(id))) {
        let suffix = 1;
        id = fallbackId;
        while (usedIds.has(id) || reservedIds.has(id)) id = `${fallbackId}-${++suffix}`;
      }
      usedIds.add(id);
      return { ...meal, id };
    }).filter((entry): entry is PlannedMeal => Boolean(entry));
  });
  if (MEAL_TYPES.every((mealType) => buckets[mealType].length === 0)) return null;
  const createdAt = asString(value.createdAt);
  return { schemaVersion: 2, id: asString(value.id) ?? "bucket-normalized", createdAt: isValidIsoTimestamp(createdAt) ? createdAt : new Date(0).toISOString(), requestedCounts: countsFromBuckets(buckets), buckets };
}

/** Reconciles stored bucket recipes against current allergens without changing bucket membership. */
export function reconcileBucketPlanSafety(plan: BucketMealPlan, preferences: UserPreferences, customRecipes: CustomRecipe[] = []): BucketMealPlan {
  const recipeMap = getRecipeMap(customRecipes, preferences.mealProfileId);
  const buckets = emptyBuckets();
  MEAL_TYPES.forEach((mealType) => {
    buckets[mealType] = plan.buckets[mealType].map((meal) => {
      const recipeId = meal.recipeId ?? meal.unsafeRecipeId;
      const recipe = recipeId ? recipeMap.get(recipeId) : undefined;
      if (!recipe) return meal;
      const excluded = recipeExcludedAllergens(recipe, preferences.excludedIngredients);
      const preserved = { id: meal.id, mealType: meal.mealType, ...(meal.consumed ? { consumed: true, ...(meal.consumedAt ? { consumedAt: meal.consumedAt } : {}) } : {}) };
      return excluded.length
        ? { ...preserved, unsafeRecipeId: recipe.id, unsafeExcludedIngredients: excluded }
        : { ...preserved, recipeId: recipe.id };
    });
  });
  return { ...plan, buckets };
}

function locate(plan: BucketMealPlan, id: string) {
  for (const mealType of MEAL_TYPES) {
    const index = plan.buckets[mealType].findIndex((meal) => meal.id === id);
    if (index >= 0) return { mealType, index, meal: plan.buckets[mealType][index] };
  }
}

function replaceMeal(plan: BucketMealPlan, mealType: MealType, index: number, meal: PlannedMeal): BucketMealPlan {
  const meals = [...plan.buckets[mealType]];
  meals[index] = meal;
  return { ...plan, buckets: { ...plan.buckets, [mealType]: meals } };
}

export function toggleBucketMealConsumed(plan: BucketMealPlan, id: string, consumed = !locate(plan, id)?.meal.consumed): BucketMealPlan {
  const found = locate(plan, id);
  if (!found) return plan;
  return replaceMeal(plan, found.mealType, found.index, { ...found.meal, ...(consumed ? { consumed: true, consumedAt: new Date().toISOString() } : { consumed: undefined, consumedAt: undefined }) });
}

export function assignBucketMealRecipe(plan: BucketMealPlan, id: string, recipeId: string, preferences: UserPreferences, customRecipes: CustomRecipe[] = []): BucketMealPlan {
  const found = locate(plan, id);
  const recipe = getRecipeMap(customRecipes, preferences.mealProfileId).get(recipeId);
  if (!found || found.meal.consumed || !recipe || !isRecipeEligibleForMealType(recipe, found.mealType) || !getSafeRecipes(customRecipes, preferences.excludedIngredients, preferences.mealProfileId).some((item) => item.id === recipeId)) return plan;
  return replaceMeal(plan, found.mealType, found.index, { id: found.meal.id, mealType: found.mealType, recipeId });
}

export function regenerateBucketMeal(plan: BucketMealPlan, id: string, preferences: UserPreferences, customRecipes: CustomRecipe[] = []): BucketMealPlan {
  const found = locate(plan, id);
  if (!found || found.meal.consumed) return plan;
  const usedIds = new Set(Object.values(plan.buckets).flat().filter((meal) => meal.id !== id).map((meal) => meal.recipeId).filter((recipeId): recipeId is string => Boolean(recipeId)));
  try {
    const recipe = selectRecipe(plan.requestedCounts, found.mealType, found.index, preferences, customRecipes, usedIds, found.meal.recipeId ? [found.meal.recipeId] : []);
    return replaceMeal(plan, found.mealType, found.index, { id: found.meal.id, mealType: found.mealType, recipeId: recipe.id });
  } catch { return plan; }
}

export function regenerateAllBucketMeals(plan: BucketMealPlan, preferences: UserPreferences, customRecipes: CustomRecipe[] = []): BucketMealPlan {
  let next = plan;
  MEAL_TYPES.forEach((mealType) => plan.buckets[mealType].forEach((meal) => { if (!meal.consumed) next = regenerateBucketMeal(next, meal.id, preferences, customRecipes); }));
  return next;
}

export function getBucketMealCompletion(plan: BucketMealPlan) {
  const total = Object.values(plan.buckets).flat().length;
  const completed = Object.values(plan.buckets).flat().filter((meal) => meal.consumed).length;
  return { total, completed, remaining: total - completed };
}
