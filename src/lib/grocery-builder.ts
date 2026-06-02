import { filterSafeIngredients, isRecipeSafeForExcludedIngredients } from "@/lib/allergens";
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

type ServingMultiplier = number | Partial<Record<MealType, number>>;

// Conversion factors to a canonical unit within each group.
// Each entry maps a unit alias to [canonicalUnit, multiplier].
const UNIT_CONVERSIONS: Record<string, [string, number]> = {
  pint: ["cup", 2],
  quart: ["cup", 4],
  gallon: ["cup", 16],
  tbsp: ["tbsp", 1],
  tablespoon: ["tbsp", 1],
  tablespoons: ["tbsp", 1],
  tsp: ["tsp", 1],
  teaspoon: ["tsp", 1],
  teaspoons: ["tsp", 1],
  oz: ["oz", 1],
  ounce: ["oz", 1],
  ounces: ["oz", 1],
  lb: ["lb", 1],
  lbs: ["lb", 1],
  pound: ["lb", 1],
  pounds: ["lb", 1],
};

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function normalizeUnit(unit: string) {
  return unit.trim().toLowerCase();
}

function canonicalizeUnit(unit: string): [string, number] {
  const normalized = normalizeUnit(unit);
  return UNIT_CONVERSIONS[normalized] ?? [normalized, 1];
}

function makeKey(item: Pick<Ingredient, "name" | "unit" | "category">) {
  const [canonicalUnit] = canonicalizeUnit(item.unit);
  return `${item.category}::${normalizeName(item.name)}::${canonicalUnit}`;
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
  servingMultiplier: ServingMultiplier = 1,
  customStaples: CustomStaple[] = [],
  sectionOrder: IngredientCategory[] = DEFAULT_SECTION_ORDER,
  excludedIngredients: string[] = [],
  mealProfileId: unknown = "home"
): GroceryItem[] {
  const recipeMap = getRecipeMap(customRecipes, mealProfileId);
  const aggregated = new Map<string, GroceryItem>();
  const nameToKeys = new Map<string, string[]>();

  const addOrMerge = (item: Omit<GroceryItem, "key" | "collected">, quantityDelta = item.quantity) => {
    const key = makeKey(item);
    const [canonicalUnit, multiplier] = canonicalizeUnit(item.unit);
    const canonicalDelta = Math.round(quantityDelta * multiplier * 100) / 100;
    const existing = aggregated.get(key);

    if (existing) {
      existing.quantity += canonicalDelta;
      existing.isStaple = existing.isStaple || item.isStaple;
    } else {
      aggregated.set(key, {
        key,
        ...item,
        unit: canonicalUnit,
        quantity: canonicalDelta,
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

      if (!recipe || !isRecipeSafeForExcludedIngredients(recipe, excludedIngredients)) {
        return;
      }

      recipe.ingredients.forEach((ingredient) => {
        const mealServingMultiplier = typeof servingMultiplier === "number"
          ? servingMultiplier
          : servingMultiplier[mealType] ?? 1;

        addOrMerge(
          {
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            category: ingredient.category,
            isStaple: false
          },
          Math.round(ingredient.quantity * mealServingMultiplier * 100) / 100
        );
      });
    });
  });

  filterSafeIngredients(customStaples, excludedIngredients).forEach((staple) => {
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
