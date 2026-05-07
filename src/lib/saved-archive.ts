import { PROTEIN_OPTIONS } from "@/lib/constants";
import { Recipe, SavedWeek } from "@/types";

export const SAVED_WEEKS_PAGE_SIZE = 5;

const proteinLabels = new Map(PROTEIN_OPTIONS.map((option) => [option.id, option.label]));

export function getVisibleSavedWeeks(
  savedWeeks: SavedWeek[],
  visibleCount: number = SAVED_WEEKS_PAGE_SIZE
) {
  return savedWeeks.slice(0, Math.max(0, visibleCount));
}

export function buildRecipeArchiveSearchText(recipe: Recipe) {
  return [
    recipe.name,
    recipe.description,
    recipe.cuisine,
    ...recipe.mealType,
    ...recipe.proteins,
    ...recipe.proteins.map((protein) => proteinLabels.get(protein) ?? protein),
    ...recipe.ingredients.map((ingredient) => ingredient.name)
  ]
    .join(" ")
    .toLowerCase();
}

export function searchRecipeArchive(recipes: Recipe[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [...recipes].sort((left, right) => left.name.localeCompare(right.name));
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return recipes
    .map((recipe) => {
      const searchText = buildRecipeArchiveSearchText(recipe);
      const name = recipe.name.toLowerCase();
      let score = 0;

      if (name === normalizedQuery) score += 500;
      else if (name.startsWith(normalizedQuery)) score += 300;
      else if (name.includes(normalizedQuery)) score += 180;
      else if (searchText.includes(normalizedQuery)) score += 120;

      const matchedTokens = tokens.filter((token) => searchText.includes(token)).length;
      if (matchedTokens === 0) {
        return null;
      }

      score += matchedTokens * 25;

      return { recipe, score };
    })
    .filter((result): result is { recipe: Recipe; score: number } => Boolean(result))
    .sort((left, right) => right.score - left.score || left.recipe.name.localeCompare(right.recipe.name))
    .map(({ recipe }) => recipe);
}
