export function toggleFavoriteRecipeIds(favoriteRecipeIds: string[], recipeId: string) {
  return favoriteRecipeIds.includes(recipeId)
    ? favoriteRecipeIds.filter((id) => id !== recipeId)
    : Array.from(new Set([...favoriteRecipeIds, recipeId]));
}
