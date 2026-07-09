import { DayConfig } from "@/lib/meal-generator";
import { SharedStateMutator } from "@/lib/use-shared-state-sync";
import {
  CustomGroceryItem,
  CustomRecipe,
  CustomStaple,
  GroceryItem,
  HouseholdMember,
  IngredientCategory,
  MealPlan,
  MealType,
  ProteinType,
  SavedWeek,
  ThemePreference,
  UserPreferences
} from "@/types";

export interface SyncStatusValue {
  hydrated: boolean;
  syncError: string | null;
  hasLoadedSharedState: boolean;
}

export interface PreferencesContextValue extends SyncStatusValue {
  preferences: UserPreferences;
  householdMembers: HouseholdMember[];
  servingMultiplier: number;
  mealServingMultipliers: Record<MealType, number>;
  getServingMultiplierForMeal: (mealType: MealType) => number;
  customStaples: CustomStaple[];
  sectionOrder: IngredientCategory[];
  toggleProtein: (protein: ProteinType) => void;
  toggleFavoriteProtein: (protein: ProteinType) => void;
  toggleFavoriteRecipe: (recipeId: string) => void;
  setTheme: (theme: ThemePreference) => void;
  setBrunchMode: (enabled: boolean) => void;
  updateHouseholdMember: (
    id: string,
    updates: Partial<Pick<HouseholdMember, "name" | "kind" | "mealParticipation">>
  ) => void;
  addHouseholdMember: () => void;
  removeHouseholdMember: (id: string) => void;
  addCustomStaple: (staple: CustomStaple) => void;
  removeCustomStaple: (name: string, unit: string, category: IngredientCategory) => void;
  moveSection: (category: IngredientCategory, direction: "up" | "down") => void;
}

export interface MealPlanContextValue extends SyncStatusValue {
  mealPlan: MealPlan | null;
  customRecipes: CustomRecipe[];
  savedWeeks: SavedWeek[];
  planSavedSinceLastChange: boolean;
  toggleMealEnabled: (dayIndex: number, mealType: MealType) => void;
  toggleMealConsumed: (dayIndex: number, mealType: MealType) => void;
  regenerateMeal: (dayIndex: number, mealType: MealType, proteinOverride?: ProteinType | "any") => void;
  swapMeals: (source: { dayIndex: number; mealType: MealType }, target: { dayIndex: number; mealType: MealType }) => Promise<boolean>;
  assignRecipeToMeal: (dayIndex: number, mealType: MealType, recipeId: string) => Promise<boolean>;
  regenerateWeek: () => void;
  generatePlan: (dayConfigs: DayConfig[]) => void;
  clearPlan: () => void;
  addCustomRecipe: (recipe: Omit<CustomRecipe, "id" | "isCustom">, options?: { favorite?: boolean; assignTo?: { dayIndex: number; mealType: MealType } }) => Promise<CustomRecipe>;
  removeCustomRecipe: (id: CustomRecipe["id"]) => void;
  saveCurrentWeek: () => Promise<SavedWeek | null>;
  deleteSavedWeek: (id: string) => void;
}

export interface GroceryContextValue extends SyncStatusValue {
  groceries: GroceryItem[];
  customItems: CustomGroceryItem[];
  sectionOrder: IngredientCategory[];
  addCustomItem: (name: string, category: IngredientCategory, quantity?: number, unit?: string) => void;
  removeCustomItem: (id: string) => void;
  toggleCustomItemCollected: (id: string) => void;
  toggleGroceryCollected: (key: string) => void;
  adjustGroceryQuantity: (key: string, delta: number) => void;
  setGroceryQuantity: (key: string, quantity: number) => void;
  clearCompletedGroceries: () => void;
}

export type AppStateValue = PreferencesContextValue & MealPlanContextValue & GroceryContextValue;

export type AppStateInternals = {
  mutate: SharedStateMutator;
  setPlanSavedSinceLastChange: (value: boolean) => void;
};
