import { getMealParticipants } from "@/lib/household";
import { useAppState } from "@/lib/app-state";
import { MealType, Recipe } from "@/types";

function formatQty(n: number): string {
  const rounded = Math.round(n * 4) / 4; // round to nearest quarter
  if (rounded === Math.floor(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function RecipeDetail({ recipe, mealType }: { recipe: Recipe; mealType: MealType }) {
  const { getServingMultiplierForMeal, householdMembers } = useAppState();
  const servingMultiplier = getServingMultiplierForMeal(mealType);
  const participantLabel = getMealParticipants(householdMembers, mealType)
    .map((member) => member.name)
    .join(", ");

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
      <div className="rounded-2xl bg-surfaceAlt px-3 py-2 text-xs text-muted">
        Scaled for {participantLabel || "the selected household"}.
      </div>
      <div>
        <h4 className="text-sm font-semibold text-text">Ingredients</h4>
        <ul className="mt-2 space-y-2 text-muted">
          {recipe.ingredients.map((ingredient) => {
            const scaled = Math.round(ingredient.quantity * servingMultiplier * 100) / 100;
            return (
              <li key={`${ingredient.name}-${ingredient.unit}`}>
                {formatQty(scaled)} {ingredient.unit} {ingredient.name}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-text">Instructions</h4>
        <ol className="mt-2 space-y-2 text-muted">
          {recipe.instructions.map((step, index) => (
            <li key={step}>
              {index + 1}. {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
