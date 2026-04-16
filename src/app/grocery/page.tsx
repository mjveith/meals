"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/constants";
import { useAppState } from "@/lib/app-state";
import { CustomGroceryItem, GroceryItem, IngredientCategory } from "@/types";

type GrocerySectionItem =
  | { kind: "generated"; item: GroceryItem }
  | { kind: "custom"; item: CustomGroceryItem };

const defaultForm = {
  name: "",
  category: "produce" as IngredientCategory,
  quantity: "1",
  unit: ""
};

export default function GroceryPage() {
  const {
    groceries,
    customItems,
    hydrated,
    sectionOrder,
    toggleGroceryCollected,
    adjustGroceryQuantity,
    setGroceryQuantity,
    clearCompletedGroceries,
    addCustomItem,
    removeCustomItem,
    toggleCustomItemCollected
  } = useAppState();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState(defaultForm);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState("");

  const grouped = useMemo(() => {
    const entries = new Map<IngredientCategory, GrocerySectionItem[]>();

    sectionOrder.forEach((category) => entries.set(category, []));

    groceries.forEach((item) => {
      entries.get(item.category)?.push({ kind: "generated", item });
    });

    customItems.forEach((item) => {
      entries.get(item.category)?.push({ kind: "custom", item });
    });

    return sectionOrder
      .map((category) => ({
        category,
        items: (entries.get(category) ?? []).sort((a, b) => a.item.name.localeCompare(b.item.name))
      }))
      .filter((section) => section.items.length > 0);
  }, [customItems, groceries, sectionOrder]);

  if (!hydrated) {
    return <main className="p-6 text-sm text-muted">Loading grocery list...</main>;
  }

  const handleAddItem = () => {
    const trimmed = newItem.name.trim();
    const quantity = Number(newItem.quantity);

    if (!trimmed || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    addCustomItem(trimmed, newItem.category, quantity, newItem.unit.trim());
    setNewItem(defaultForm);
    setShowAddForm(false);
  };

  const beginQuantityEdit = (key: string, quantity: number) => {
    setEditingKey(key);
    setEditingQuantity(String(quantity));
  };

  const commitQuantityEdit = (key: string) => {
    const parsed = Number(editingQuantity);

    if (Number.isFinite(parsed)) {
      setGroceryQuantity(key, parsed);
    }

    setEditingKey(null);
    setEditingQuantity("");
  };

  const handleQuantityKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }

    if (event.key === "Escape") {
      setEditingKey(null);
      setEditingQuantity("");
    }
  };

  const collectedCount =
    groceries.filter((item) => item.collected).length +
    customItems.filter((item) => item.collected).length;

  return (
    <main className="space-y-6 p-4 pb-12">
      <section className="rounded-[32px] bg-gradient-to-br from-teal-200 via-cyan-100 to-sky-100 p-6 text-slate-900 shadow-panel dark:from-slate-800 dark:via-teal-900 dark:to-cyan-900 dark:text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.24em]">Grocery</div>
        <h1 className="mt-3 text-3xl font-bold">Shopping list</h1>
        <p className="mt-3 text-sm text-slate-800/80 dark:text-white/80">
          {groceries.length + customItems.length} items · {collectedCount} collected
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            + Add item
          </button>
          {collectedCount > 0 ? (
            <button
              type="button"
              onClick={clearCompletedGroceries}
              className="rounded-full border border-slate-900/20 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-white/20 dark:text-white"
            >
              Clear completed
            </button>
          ) : null}
        </div>
      </section>

      {showAddForm ? (
        <section className="rounded-[32px] border border-accent/40 bg-surface p-4">
          <h2 className="text-lg font-semibold text-text">Add custom item</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={newItem.name}
              onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleAddItem();
                }
              }}
              placeholder="Name"
              autoFocus
              className="rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <select
              value={newItem.category}
              onChange={(event) =>
                setNewItem((current) => ({
                  ...current,
                  category: event.target.value as IngredientCategory
                }))
              }
              className="rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
            >
              {sectionOrder.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={newItem.quantity}
              onChange={(event) => setNewItem((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="Quantity"
              className="rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              value={newItem.unit}
              onChange={(event) => setNewItem((current) => ({ ...current, unit: event.target.value }))}
              placeholder="Unit"
              className="rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!newItem.name.trim()}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewItem(defaultForm);
              }}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-muted"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {grouped.map(({ category, items }) => (
        <section key={category} className="rounded-[32px] border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold text-text">{CATEGORY_LABELS[category]}</h2>
          <div className="mt-4 space-y-3">
            {items.map((entry) =>
              entry.kind === "generated" ? (
                <div
                  key={entry.item.key}
                  className="flex items-center gap-3 rounded-3xl border border-border bg-canvas px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroceryCollected(entry.item.key)}
                    className={`flex-1 text-left ${
                      entry.item.collected ? "text-muted line-through" : "text-text"
                    }`}
                  >
                    <div className="font-medium">
                      {entry.item.isStaple ? "📌 " : ""}
                      {entry.item.name}
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    {editingKey === entry.item.key ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingQuantity}
                        onChange={(event) => setEditingQuantity(event.target.value)}
                        onBlur={() => commitQuantityEdit(entry.item.key)}
                        onKeyDown={handleQuantityKeyDown}
                        autoFocus
                        className="w-24 rounded-full border border-accent/40 bg-surface px-3 py-2 text-right text-sm text-text focus:border-accent focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => beginQuantityEdit(entry.item.key, entry.item.quantity)}
                        className="min-w-24 rounded-full px-3 py-2 text-right text-sm text-text transition hover:bg-surfaceAlt"
                      >
                        {entry.item.quantity} {entry.item.unit || "item"}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustGroceryQuantity(entry.item.key, -1)}
                      className="h-9 w-9 rounded-full bg-surfaceAlt text-lg text-text"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustGroceryQuantity(entry.item.key, 1)}
                      className="h-9 w-9 rounded-full bg-surfaceAlt text-lg text-text"
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={entry.item.id}
                  className="flex items-center gap-3 rounded-3xl border border-border bg-canvas px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleCustomItemCollected(entry.item.id)}
                    className={`flex-1 text-left font-medium ${
                      entry.item.collected ? "text-muted line-through" : "text-text"
                    }`}
                  >
                    {entry.item.name}
                  </button>
                  <div className="text-sm text-muted">
                    {entry.item.quantity} {entry.item.unit || "item"}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomItem(entry.item.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-surfaceAlt text-sm text-muted"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              )
            )}
          </div>
        </section>
      ))}
    </main>
  );
}
