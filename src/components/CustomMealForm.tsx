"use client";

import { FormEvent, useMemo, useState } from "react";
import { MEAL_LABELS } from "@/lib/constants";
import { CustomRecipe, Ingredient, MealType } from "@/types";

type IngredientDraft = {
  name: string;
  quantity: string;
  unit: string;
};

interface CustomMealFormProps {
  title: string;
  submitLabel: string;
  initialMealType?: MealType;
  allowMealTypeSelection?: boolean;
  onCancel: () => void;
  onSave: (recipe: Omit<CustomRecipe, "id" | "isCustom">) => void | Promise<void>;
}

function emptyIngredient(): IngredientDraft {
  return { name: "", quantity: "", unit: "" };
}

function buildDescription(name: string, ingredients: Ingredient[]) {
  const firstIngredients = ingredients.slice(0, 3).map((ingredient) => ingredient.name);

  if (firstIngredients.length === 0) {
    return `${name} custom meal.`;
  }

  return `Custom meal with ${firstIngredients.join(", ")}.`;
}

export function CustomMealForm({
  title,
  submitLabel,
  initialMealType = "dinner",
  allowMealTypeSelection = false,
  onCancel,
  onSave
}: CustomMealFormProps) {
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([emptyIngredient()]);
  const [steps, setSteps] = useState([""]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const parsedIngredients = useMemo(
    () =>
      ingredients
        .map((ingredient) => ({
          name: ingredient.name.trim(),
          quantity: Number(ingredient.quantity),
          unit: ingredient.unit.trim()
        }))
        .filter((ingredient) => ingredient.name)
        .map(
          (ingredient) =>
            ({
              name: ingredient.name,
              quantity:
                Number.isFinite(ingredient.quantity) && ingredient.quantity > 0 ? ingredient.quantity : 1,
              unit: ingredient.unit || "item",
              category: "other"
            }) satisfies Ingredient
        ),
    [ingredients]
  );
  const parsedSteps = useMemo(
    () => steps.map((step) => step.trim()).filter(Boolean),
    [steps]
  );

  const canSave = name.trim().length > 0 && parsedIngredients.length > 0 && parsedSteps.length > 0 && !isSaving;

  const updateIngredient = (index: number, field: keyof IngredientDraft, value: string) => {
    setIngredients((current) =>
      current.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
      )
    );
  };

  const updateStep = (index: number, value: string) => {
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? value : step)));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const trimmedName = name.trim();
      await onSave({
        name: trimmedName,
        description: buildDescription(trimmedName, parsedIngredients),
        mealType: [mealType],
        proteins: [],
        cuisine: "Custom",
        prepTime: 0,
        cookTime: 0,
        servings: 4,
        difficulty: "easy",
        ingredients: parsedIngredients,
        instructions: parsedSteps
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "This custom recipe could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-[32px] border border-accent/30 bg-surface p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <p className="mt-1 text-sm text-muted">
            Save a custom recipe to shared state and use it like any other meal.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-muted"
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block">
          <div className="mb-2 text-sm font-medium text-text">Meal name</div>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Grandma's chili"
            className="w-full rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>

        <div>
          <div className="mb-2 text-sm font-medium text-text">Meal type</div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(MEAL_LABELS) as MealType[]).map((option) => {
              const selected = mealType === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => allowMealTypeSelection && setMealType(option)}
                  disabled={!allowMealTypeSelection && option !== mealType}
                  className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                    selected
                      ? "bg-accent text-white"
                      : "border border-border bg-canvas text-muted"
                  } ${!allowMealTypeSelection && option !== mealType ? "opacity-40" : ""}`}
                >
                  {MEAL_LABELS[option]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-text">Ingredients</div>
            <button
              type="button"
              onClick={() => setIngredients((current) => [...current, emptyIngredient()])}
              className="rounded-full bg-surfaceAlt px-3 py-2 text-sm font-semibold text-text"
            >
              Add ingredient
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {ingredients.map((ingredient, index) => (
              <div key={`ingredient-${index}`} className="grid grid-cols-[minmax(0,1fr)_92px_92px_auto] gap-2">
                <input
                  type="text"
                  value={ingredient.name}
                  onChange={(event) => updateIngredient(index, "name", event.target.value)}
                  placeholder="Ingredient"
                  className="rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ingredient.quantity}
                  onChange={(event) => updateIngredient(index, "quantity", event.target.value)}
                  placeholder="Qty"
                  className="rounded-2xl border border-border bg-canvas px-3 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <input
                  type="text"
                  value={ingredient.unit}
                  onChange={(event) => updateIngredient(index, "unit", event.target.value)}
                  placeholder="Unit"
                  className="rounded-2xl border border-border bg-canvas px-3 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setIngredients((current) =>
                      current.length === 1 ? [emptyIngredient()] : current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  className="rounded-2xl bg-surfaceAlt px-3 py-3 text-sm font-semibold text-muted"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-text">Instructions</div>
            <button
              type="button"
              onClick={() => setSteps((current) => [...current, ""])}
              className="rounded-full bg-surfaceAlt px-3 py-2 text-sm font-semibold text-text"
            >
              Add step
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {steps.map((step, index) => (
              <div key={`step-${index}`} className="flex items-start gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surfaceAlt text-sm font-semibold text-text">
                  {index + 1}
                </div>
                <textarea
                  value={step}
                  onChange={(event) => updateStep(index, event.target.value)}
                  rows={2}
                  placeholder="Describe this step"
                  className="flex-1 rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSteps((current) => (current.length === 1 ? [""] : current.filter((_, stepIndex) => stepIndex !== index)))
                  }
                  className="rounded-2xl bg-surfaceAlt px-3 py-3 text-sm font-semibold text-muted"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {saveError && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="alert">
          {saveError}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSave}
        className="mt-5 w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {isSaving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
