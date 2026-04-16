import { IngredientCategory, ProteinType, UserPreferences } from "@/types";

export const PROTEIN_OPTIONS: { id: ProteinType; label: string }[] = [
  { id: "chicken", label: "Chicken" },
  { id: "pork", label: "Pork" },
  { id: "fish", label: "Salmon / Fish" },
  { id: "red-meat", label: "Red Meat" }
];

export const DEFAULT_SECTION_ORDER: IngredientCategory[] = [
  "produce",
  "dairy",
  "protein",
  "pantry",
  "spice",
  "bakery",
  "frozen",
  "beverage",
  "household",
  "other"
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  selectedProteins: ["chicken", "pork", "fish", "red-meat"],
  favoriteProteins: [],
  theme: "system",
  favoriteRecipeIds: [],
  adults: 2,
  children: 1,
  customStaples: [],
  sectionOrder: DEFAULT_SECTION_ORDER
};

export const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner"
} as const;

export const CATEGORY_LABELS = {
  produce: "Produce",
  dairy: "Dairy",
  protein: "Protein",
  pantry: "Pantry",
  spice: "Spices",
  bakery: "Bakery",
  frozen: "Frozen",
  beverage: "Beverages",
  household: "Household",
  other: "Other"
} as const;
