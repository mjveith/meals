import { DEFAULT_SECTION_ORDER } from "@/lib/constants";
import { getRecipeMap } from "@/lib/meal-generator";
import {
  CustomRecipe,
  CustomStaple,
  GroceryItem,
  GroceryOverride,
  Ingredient,
  IngredientCategory,
  MealPlan,
  MealType
} from "@/types";

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function normalizeUnit(unit: string) {
  return unit.trim().toLowerCase();
}

function makeKey(item: Pick<Ingredient, "name" | "unit" | "category">) {
  return `${item.category}::${normalizeName(item.name)}::${normalizeUnit(item.unit)}`;
}

function sortItems(items: GroceryItem[], sectionOrder: IngredientCategory[]) {
  const order = new Map(sectionOrder.map((category, index) => [category, index]));

  return [...items].sort((a, b) => {
    const categoryDiff = (order.get(a.category) ?? Number.MAX_SAFE_INTEGER)
      - (order.get(b.category) ?? Number.MAX_SAFE_INTEGER);

    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    return a.name.localeCompare(b.name);
  });
}

export function buildGroceryList(
  plan: MealPlan,
  overrides: Record<string, GroceryOverride> = {},
  customRecipes: CustomRecipe[] = [],
  servingMultiplier: number = 1,
  customStaples: CustomStaple[] = [],
  sectionOrder: IngredientCategory[] = DEFAULT_SECTION_ORDER
): GroceryItem[] {
  const recipeMap = getRecipeMap(customRecipes);
  const aggregated = new Map<string, GroceryItem>();
  const nameToKeys = new Map<string, string[]>();

  const addOrMerge = (item: Omit<GroceryItem, "key" | "collected">, quantityDelta = item.quantity) => {
    const key = makeKey(item);
    const existing = aggregated.get(key);

    if (existing) {
      existing.quantity += quantityDelta;
      existing.isStaple = existing.isStaple || item.isStaple;
    } else {
      aggregated.set(key, {
        key,
        ...item,
        quantity: quantityDelta,
        collected: false
      });
      const normalizedName = normalizeName(item.name);
      nameToKeys.set(normalizedName, [...(nameToKeys.get(normalizedName) ?? []), key]);
    }
  };

  plan.days.forEach((day) => {
    (Object.keys(day.meals) as MealType[]).forEach((mealType) => {
      const slot = day.meals[mealType];

      if (!slot.enabled || !slot.recipeId) {
        return;
      }

      const recipe = recipeMap.get(slot.recipeId);

      recipe?.ingredients.forEach((ingredient) => {
        addOrMerge(
          {
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            category: ingredient.category,
            isStaple: false
          },
          Math.round(ingredient.quantity * servingMultiplier * 100) / 100
        );
      });
    });
  });

  customStaples.forEach((staple) => {
    const normalizedName = normalizeName(staple.name);
    const matchingKeys = nameToKeys.get(normalizedName) ?? [];
    const matchedKey = matchingKeys[0];

    if (matchedKey) {
      const existing = aggregated.get(matchedKey);

      if (existing) {
        existing.quantity += staple.quantity;
        existing.isStaple = true;
      }

      return;
    }

    addOrMerge({
      name: staple.name,
      quantity: staple.quantity,
      unit: staple.unit,
      category: staple.category,
      isStaple: true
    });
  });

  return sortItems(
    [...aggregated.values()]
      .map((item) => {
        const override = overrides[item.key];
        return {
          ...item,
          quantity: Math.max(0, item.quantity + (override?.adjustment ?? 0)),
          collected: override?.collected ?? false
        };
      })
      .filter((item) => item.quantity > 0),
    sectionOrder
  );
}
