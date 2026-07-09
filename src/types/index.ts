export type MealType = "breakfast" | "brunch" | "lunch" | "dinner";
export type ProteinType = "chicken" | "pork" | "fish" | "red-meat";
export type HouseholdMemberKind = "adult" | "child";
export type IngredientCategory =
  | "produce"
  | "dairy"
  | "protein"
  | "pantry"
  | "spice"
  | "bakery"
  | "frozen"
  | "beverage"
  | "household"
  | "other";
export type ThemePreference = "light" | "dark" | "system";

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  mealType: MealType[];
  proteins: ProteinType[];
  cuisine: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: "easy" | "medium";
  ingredients: Ingredient[];
  instructions: string[];
}

export interface CustomRecipe extends Recipe {
  id: `custom-${string}`;
  isCustom: true;
}

export interface MealSlot {
  enabled: boolean;
  recipeId?: string;
  consumed?: boolean;
}

export interface DayPlan {
  date: string;
  meals: Record<MealType, MealSlot>;
}

export interface MealPlan {
  weekOf: string;
  days: DayPlan[];
}

export interface CustomStaple {
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
}

export interface HouseholdMember {
  id: string;
  name: string;
  kind: HouseholdMemberKind;
  mealParticipation: MealType[];
}

export interface UserPreferences {
  selectedProteins: ProteinType[];
  favoriteProteins: ProteinType[];
  theme: ThemePreference;
  favoriteRecipeIds: string[];
  adults: number;
  children: number;
  householdMembers: HouseholdMember[];
  customStaples: CustomStaple[];
  sectionOrder: IngredientCategory[];
  brunchMode: boolean;
}

export type SharedPreferences = Omit<UserPreferences, "theme">;

export interface GroceryOverride {
  collected: boolean;
  adjustment: number;
}

export interface GroceryItem {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
  isStaple: boolean;
  collected: boolean;
  isCustom?: boolean;
}

export interface CustomGroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
  collected: boolean;
}

export interface SavedWeek {
  id: string;
  savedAt: string;
  weekOf: string;
  label: string;
  mealPlan: MealPlan;
  groceryList: GroceryItem[];
  customGroceryItems: CustomGroceryItem[];
}

export interface SharedAppState {
  preferences: SharedPreferences;
  mealPlan: MealPlan | null;
  groceryOverrides: Record<string, GroceryOverride>;
  customGroceryItems: CustomGroceryItem[];
  customRecipes: CustomRecipe[];
  savedWeeks: SavedWeek[];
}

export type SharedStatePatch = Partial<SharedAppState> & {
  customStaplesReplace?: true;
  savedWeekDeletedIds?: string[];
};

export interface SharedStateResponse extends SharedAppState {
  version: number;
}
