import { MEAL_TYPES } from "@/lib/constants";
import { DayPlan, MealPlan, MealSlot, MealType, SavedWeek } from "@/types";

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

export function getArchivedMealSlot(day: LegacyDayPlan, mealType: MealType): MealSlot {
  return day.meals?.[mealType] ?? { enabled: false };
}

export function getEnabledArchivedMealTypes(day: LegacyDayPlan): MealType[] {
  return MEAL_TYPES.filter((mealType) => getArchivedMealSlot(day, mealType).enabled);
}

export function getArchivedMealCount(savedWeek: LegacySavedWeek): number {
  return savedWeek.mealPlan.days.reduce(
    (count, day) => count + getEnabledArchivedMealTypes(day).length,
    0
  );
}
