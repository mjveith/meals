import { Ingredient, Recipe } from "@/types";

export const DEFAULT_EXCLUDED_INGREDIENTS = ["pistachio", "cashew"];

export const ALLERGEN_OPTIONS = [
  { id: "pistachio", label: "Pistachios", note: "Ronin allergy" },
  { id: "cashew", label: "Cashews", note: "Ronin allergy" }
] as const;

const VARIANTS: Record<string, string[]> = {
  pistachio: ["pistachio", "pistachios"],
  cashew: ["cashew", "cashews"]
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeExcludedIngredients(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [...DEFAULT_EXCLUDED_INGREDIENTS];
  }

  const allowed = new Set<string>(ALLERGEN_OPTIONS.map((option) => option.id));
  const normalized = values
    .map((value) => String(value).trim().toLowerCase())
    .filter((value) => allowed.has(value));

  return Array.from(new Set(normalized));
}

export function ingredientMatchesExcluded(name: string, excludedIngredients: string[] = []) {
  const normalizedName = name.toLowerCase();

  return excludedIngredients.some((excluded) => {
    const variants = VARIANTS[excluded] ?? [excluded, `${excluded}s`];
    return variants.some((variant) => new RegExp(`(^|[^a-z])${escapeRegExp(variant)}([^a-z]|$)`, "i").test(normalizedName));
  });
}

export function recipeExcludedAllergens(recipe: Recipe, excludedIngredients: string[] = []) {
  return recipe.ingredients
    .filter((ingredient) => ingredientMatchesExcluded(ingredient.name, excludedIngredients))
    .map((ingredient) => ingredient.name);
}

export function isRecipeSafeForExcludedIngredients(recipe: Recipe, excludedIngredients: string[] = []) {
  return recipeExcludedAllergens(recipe, excludedIngredients).length === 0;
}

export function filterSafeRecipes<T extends Recipe>(recipes: T[], excludedIngredients: string[] = []) {
  return recipes.filter((recipe) => isRecipeSafeForExcludedIngredients(recipe, excludedIngredients));
}

export function filterSafeIngredients<T extends Pick<Ingredient, "name">>(ingredients: T[], excludedIngredients: string[] = []) {
  return ingredients.filter((ingredient) => !ingredientMatchesExcluded(ingredient.name, excludedIngredients));
}

export function formatExcludedIngredients(excludedIngredients: string[] = []) {
  return excludedIngredients
    .map((id) => ALLERGEN_OPTIONS.find((option) => option.id === id)?.label ?? id)
    .join(", ");
}
