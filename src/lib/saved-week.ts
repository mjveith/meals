import { MEAL_TYPES } from "@/lib/constants";
import { normalizeBucketPlan } from "@/lib/meal-buckets";
import { DayPlan, MealPlan, MealSlot, MealType, SavedArchiveRecord, SavedBucketPlan, SavedWeek, UserPreferences } from "@/types";

type LegacyMealSlotMap = Partial<Record<MealType, MealSlot>>;
type LegacyDayPlan = Omit<DayPlan, "meals"> & { meals?: LegacyMealSlotMap };
type LegacyMealPlan = Omit<MealPlan, "days"> & { days: LegacyDayPlan[] };
type LegacySavedWeek = Omit<SavedWeek, "mealPlan"> & { mealPlan: LegacyMealPlan };

function normalizeArchivedMealSlot(slot: MealSlot | undefined): MealSlot {
  if (!slot?.enabled) {
    return { enabled: false };
  }

  return {
    enabled: true,
    ...(slot.recipeId ? { recipeId: slot.recipeId } : {}),
    ...(!slot.recipeId && slot.unsafeRecipeId ? { unsafeRecipeId: slot.unsafeRecipeId } : {}),
    ...(!slot.recipeId && slot.unsafeExcludedIngredients?.length ? { unsafeExcludedIngredients: slot.unsafeExcludedIngredients } : {}),
    ...(slot.consumed ? { consumed: true } : {})
  };
}

export function normalizeArchivedMealPlan(mealPlan: LegacyMealPlan): MealPlan {
  return {
    ...mealPlan,
    days: mealPlan.days.map((day) => ({
      ...day,
      meals: Object.fromEntries(
        MEAL_TYPES.map((mealType) => [mealType, normalizeArchivedMealSlot(day.meals?.[mealType])])
      ) as Record<MealType, MealSlot>
    }))
  };
}

export function normalizeArchivedSavedWeek(savedWeek: LegacySavedWeek): SavedWeek {
  return {
    ...savedWeek,
    mealPlan: normalizeArchivedMealPlan(savedWeek.mealPlan)
  };
}

function isSavedBucketPlan(savedWeek: SavedArchiveRecord): savedWeek is SavedBucketPlan {
  return "kind" in savedWeek && savedWeek.kind === "bucket-plan";
}

/** Normalizes archive structure only; it intentionally does not apply current safety or household rules. */
export function normalizeSavedArchiveRecord(savedWeek: SavedArchiveRecord): SavedArchiveRecord {
  if (!isSavedBucketPlan(savedWeek)) return normalizeArchivedSavedWeek(savedWeek);
  const mealPlan = normalizeBucketPlan(savedWeek.mealPlan, {} as UserPreferences);
  if (!mealPlan) return savedWeek;
  return { ...savedWeek, mealPlan };
}

export function getArchivedMealSlot(day: LegacyDayPlan, mealType: MealType): MealSlot {
  return day.meals?.[mealType] ?? { enabled: false };
}

export function getEnabledArchivedMealTypes(day: LegacyDayPlan): MealType[] {
  return MEAL_TYPES.filter((mealType) => getArchivedMealSlot(day, mealType).enabled);
}

export function getArchivedMealCount(savedWeek: LegacySavedWeek | SavedBucketPlan): number {
  if ("kind" in savedWeek && savedWeek.kind === "bucket-plan") {
    return Object.values(savedWeek.mealPlan.buckets).flat().length;
  }
  const legacyMealPlan = (savedWeek as LegacySavedWeek).mealPlan as LegacyMealPlan;
  return legacyMealPlan.days.reduce(
    (count, day) => count + getEnabledArchivedMealTypes(day).length,
    0
  );
}
