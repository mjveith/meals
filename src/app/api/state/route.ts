import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { CATEGORY_LABELS, DEFAULT_PREFERENCES, DEFAULT_SECTION_ORDER } from "@/lib/constants";
import { CustomGroceryItem, CustomStaple, GroceryItem, IngredientCategory, SharedAppState } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stateFilePath = path.join(process.cwd(), "meals-state.json");

const defaultState: SharedAppState = {
  preferences: {
    selectedProteins: DEFAULT_PREFERENCES.selectedProteins,
    favoriteProteins: DEFAULT_PREFERENCES.favoriteProteins,
    favoriteRecipeIds: DEFAULT_PREFERENCES.favoriteRecipeIds,
    adults: DEFAULT_PREFERENCES.adults,
    children: DEFAULT_PREFERENCES.children,
    customStaples: [],
    sectionOrder: DEFAULT_PREFERENCES.sectionOrder
  },
  mealPlan: null,
  groceryOverrides: {},
  customGroceryItems: [],
  customRecipes: [],
  savedWeeks: []
};

let writeQueue: Promise<unknown> = Promise.resolve();

function isCategory(value: unknown): value is IngredientCategory {
  return typeof value === "string" && value in CATEGORY_LABELS;
}

function normalizeCategory(value: unknown): IngredientCategory {
  if (value === "staples") {
    return "other";
  }

  return isCategory(value) ? value : "other";
}

function normalizeSectionOrder(value: unknown): IngredientCategory[] {
  if (!Array.isArray(value)) {
    return DEFAULT_SECTION_ORDER;
  }

  const validSet = new Set(DEFAULT_SECTION_ORDER);
  const seen = new Set<IngredientCategory>();
  const ordered: IngredientCategory[] = [];

  // Preserve user's order for valid categories
  for (const item of value) {
    const normalized = normalizeCategory(item);
    if (validSet.has(normalized) && !seen.has(normalized)) {
      ordered.push(normalized);
      seen.add(normalized);
    }
  }

  // Append any missing categories at the end
  for (const category of DEFAULT_SECTION_ORDER) {
    if (!seen.has(category)) {
      ordered.push(category);
    }
  }

  return ordered;
}

function normalizeCustomStaple(value: unknown): CustomStaple | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const staple = value as Partial<CustomStaple>;
  const name = staple.name?.trim();
  const quantity = Number(staple.quantity);

  if (!name || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return {
    name,
    quantity,
    unit: staple.unit?.trim() ?? "",
    category: normalizeCategory(staple.category)
  };
}

function normalizeCustomGroceryItem(value: unknown): CustomGroceryItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<CustomGroceryItem>;
  const name = item.name?.trim();
  const quantity = Number(item.quantity);

  if (!item.id || !name || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return {
    id: item.id,
    name,
    quantity,
    unit: item.unit?.trim() ?? "",
    category: normalizeCategory(item.category),
    collected: Boolean(item.collected)
  };
}

function normalizeSavedGroceryItem(item: GroceryItem): GroceryItem {
  return {
    ...item,
    category: normalizeCategory(item.category)
  };
}

function createEtag(value: string) {
  return `"${createHash("sha1").update(value).digest("hex")}"`;
}

function sanitizeState(value: Partial<SharedAppState> | null | undefined): SharedAppState {
  return {
    preferences: {
      ...defaultState.preferences,
      ...(value?.preferences ?? {}),
      customStaples: (value?.preferences?.customStaples ?? [])
        .map(normalizeCustomStaple)
        .filter((item): item is CustomStaple => Boolean(item)),
      sectionOrder: normalizeSectionOrder(value?.preferences?.sectionOrder)
    },
    mealPlan: value?.mealPlan ?? null,
    groceryOverrides: value?.groceryOverrides ?? {},
    customGroceryItems: (value?.customGroceryItems ?? [])
      .map(normalizeCustomGroceryItem)
      .filter((item): item is CustomGroceryItem => Boolean(item)),
    customRecipes: value?.customRecipes ?? [],
    savedWeeks: (value?.savedWeeks ?? []).map((week) => ({
      ...week,
      groceryList: (week.groceryList ?? []).map(normalizeSavedGroceryItem),
      customGroceryItems: (week.customGroceryItems ?? [])
        .map(normalizeCustomGroceryItem)
        .filter((item): item is CustomGroceryItem => Boolean(item))
    }))
  };
}

async function ensureStateFile() {
  try {
    await fs.access(stateFilePath);
  } catch {
    await fs.writeFile(stateFilePath, `${JSON.stringify(defaultState, null, 2)}\n`, "utf8");
  }
}

async function readStateRecord() {
  await ensureStateFile();
  const raw = await fs.readFile(stateFilePath, "utf8");
  const parsed = sanitizeState(JSON.parse(raw) as Partial<SharedAppState>);
  const stats = await fs.stat(stateFilePath);

  return {
    raw: JSON.stringify(parsed),
    state: parsed,
    version: Math.trunc(stats.mtimeMs)
  };
}

async function writeStateRecord(nextState: SharedAppState) {
  const formatted = `${JSON.stringify(nextState, null, 2)}\n`;
  await fs.writeFile(stateFilePath, formatted, "utf8");
  const stats = await fs.stat(stateFilePath);

  return {
    raw: JSON.stringify(nextState),
    state: nextState,
    version: Math.trunc(stats.mtimeMs)
  };
}

function createResponseBody(record: Awaited<ReturnType<typeof readStateRecord>>) {
  return {
    version: record.version,
    ...record.state
  };
}

function jsonResponse(record: Awaited<ReturnType<typeof readStateRecord>>) {
  return NextResponse.json(createResponseBody(record), {
    headers: {
      ETag: createEtag(record.raw),
      "Cache-Control": "no-store"
    }
  });
}

export async function GET(request: NextRequest) {
  const record = await readStateRecord();
  const etag = createEtag(record.raw);

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "no-store"
      }
    });
  }

  return jsonResponse(record);
}

export async function PUT(request: NextRequest) {
  const patch = (await request.json()) as Partial<SharedAppState>;

  const recordPromise = writeQueue.catch(() => undefined).then(async () => {
    const current = await readStateRecord();
    const nextState = sanitizeState({
      ...current.state,
      ...patch
    });
    return writeStateRecord(nextState);
  });

  writeQueue = recordPromise;
  const record = await recordPromise;
  return jsonResponse(record);
}
