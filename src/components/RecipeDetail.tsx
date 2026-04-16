import { Recipe } from "@/types";
import { useAppState } from "@/lib/app-state";

function formatQty(n: number): string {
  const rounded = Math.round(n * 4) / 4; // round to nearest quarter
  if (rounded === Math.floor(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const { servingMultiplier } = useAppState();

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
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
