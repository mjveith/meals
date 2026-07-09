import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_PREFERENCES, DEFAULT_SECTION_ORDER } from "@/lib/constants";
import { countHouseholdMembers, normalizeHouseholdMembers } from "@/lib/household";
import { dedupeCustomStaples, normalizeIngredientCategory } from "@/lib/custom-staples";
import { normalizePlan } from "@/lib/meal-generator";
import { normalizeArchivedSavedWeek } from "@/lib/saved-week";
import {
  CustomRecipe,
  CustomGroceryItem,
  GroceryOverride,
  GroceryItem,
  Ingredient,
  IngredientCategory,
  MealType,
  ProteinType,
  SharedAppState,
  SharedPreferences,
  SharedStatePatch
} from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dataRoot = process.env.MEALS_DATA_DIR ?? process.cwd();
const stateFilePath = path.join(dataRoot, "meals-state.json");
const backupStateFilePath = path.join(dataRoot, "meals-state.backup.json");
const historyDirectoryPath = path.join(dataRoot, "meals-state-history");
const tempStateFilePath = path.join(dataRoot, "meals-state.json.tmp");
const maxHistorySnapshots = 200;
export const maxPutBodyBytes = 1024 * 1024;
const mealTypes = ["breakfast", "brunch", "lunch", "dinner"] as const;
const proteinTypes = ["chicken", "pork", "fish", "red-meat"] as const;

const defaultState: SharedAppState = {
  preferences: {
    selectedProteins: DEFAULT_PREFERENCES.selectedProteins,
    favoriteProteins: DEFAULT_PREFERENCES.favoriteProteins,
    favoriteRecipeIds: DEFAULT_PREFERENCES.favoriteRecipeIds,
    adults: DEFAULT_PREFERENCES.adults,
    children: DEFAULT_PREFERENCES.children,
    householdMembers: DEFAULT_PREFERENCES.householdMembers,
    customStaples: [],
    sectionOrder: DEFAULT_PREFERENCES.sectionOrder,
    brunchMode: DEFAULT_PREFERENCES.brunchMode
  },
  mealPlan: null,
  groceryOverrides: {},
  customGroceryItems: [],
  customRecipes: [],
  savedWeeks: []
};

let writeQueue: Promise<unknown> = Promise.resolve();

function normalizeCategory(value: unknown): IngredientCategory {
  return normalizeIngredientCategory(value);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFiniteNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeString).filter((item) => item.length > 0);
}

function normalizeMealTypes(value: unknown): MealType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validMealTypes = new Set<string>(mealTypes);
  const seen = new Set<MealType>();
  const normalized: MealType[] = [];

  for (const item of value) {
    if (typeof item === "string" && validMealTypes.has(item) && !seen.has(item as MealType)) {
      normalized.push(item as MealType);
      seen.add(item as MealType);
    }
  }

  return normalized;
}

function normalizeProteinTypes(value: unknown): ProteinType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validProteinTypes = new Set<string>(proteinTypes);
  const seen = new Set<ProteinType>();
  const normalized: ProteinType[] = [];

  for (const item of value) {
    if (typeof item === "string" && validProteinTypes.has(item) && !seen.has(item as ProteinType)) {
      normalized.push(item as ProteinType);
      seen.add(item as ProteinType);
    }
  }

  return normalized;
}

function normalizeRecipeIngredient(value: unknown): Ingredient | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = normalizeString(value.name);
  const quantity = normalizeFiniteNumber(value.quantity, Number.NaN);

  if (!name || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return {
    name,
    quantity,
    unit: normalizeString(value.unit),
    category: normalizeCategory(value.category)
  };
}

function normalizeCustomRecipe(value: unknown): CustomRecipe | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeString(value.id);
  const name = normalizeString(value.name);
  const mealType = normalizeMealTypes(value.mealType);

  if (!id.startsWith("custom-") || !name || mealType.length === 0) {
    return null;
  }

  const ingredients = Array.isArray(value.ingredients)
    ? value.ingredients
        .map(normalizeRecipeIngredient)
        .filter((ingredient): ingredient is Ingredient => Boolean(ingredient))
    : [];

  return {
    id: id as CustomRecipe["id"],
    isCustom: true,
    name,
    description: normalizeString(value.description),
    mealType,
    proteins: normalizeProteinTypes(value.proteins),
    cuisine: normalizeString(value.cuisine),
    prepTime: Math.max(0, normalizeFiniteNumber(value.prepTime)),
    cookTime: Math.max(0, normalizeFiniteNumber(value.cookTime)),
    servings: Math.max(1, normalizeFiniteNumber(value.servings, 1)),
    difficulty: value.difficulty === "medium" ? "medium" : "easy",
    ingredients,
    instructions: normalizeStringList(value.instructions)
  };
}

function normalizeCustomRecipes(value: unknown): CustomRecipe[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeCustomRecipe).filter((recipe): recipe is CustomRecipe => Boolean(recipe));
}

function normalizeGroceryOverrides(value: unknown): Record<string, GroceryOverride> {
  if (!isRecord(value)) {
    return {};
  }

  const overrides: Record<string, GroceryOverride> = {};

  for (const [key, override] of Object.entries(value)) {
    if (!key || !isRecord(override)) {
      continue;
    }

    const hasAdjustment = typeof override.adjustment === "number" && Number.isFinite(override.adjustment);
    const hasCollected = typeof override.collected === "boolean";

    if (!hasAdjustment && !hasCollected) {
      continue;
    }

    overrides[key] = {
      adjustment: hasAdjustment ? Number(override.adjustment) : 0,
      collected: hasCollected ? Boolean(override.collected) : false
    };
  }

  return overrides;
}

export function normalizeSharedStatePatch(value: unknown): SharedStatePatch {
  if (!isRecord(value)) {
    return {};
  }

  const patch = value as Partial<SharedStatePatch>;
  const normalized: SharedStatePatch = { ...patch };

  if (Object.hasOwn(value, "customRecipes")) {
    normalized.customRecipes = normalizeCustomRecipes(value.customRecipes);
  }

  if (Object.hasOwn(value, "groceryOverrides")) {
    normalized.groceryOverrides = normalizeGroceryOverrides(value.groceryOverrides);
  }

  if (Object.hasOwn(value, "mealPlan")) {
    normalized.mealPlan = normalizePlan(
      patch.mealPlan ?? null,
      { ...defaultState.preferences, ...(patch.preferences ?? {}), theme: "system" }
    );
  }

  return normalized;
}

export async function parsePutStateRequest(request: Request): Promise<
  | { ok: true; patch: SharedStatePatch }
  | { ok: false; status: 400 | 413; body: { error: string } }
> {
  const contentLength = request.headers.get("content-length");
  const parsedContentLength = contentLength ? Number(contentLength) : null;

  if (parsedContentLength !== null && Number.isFinite(parsedContentLength) && parsedContentLength > maxPutBodyBytes) {
    return { ok: false, status: 413, body: { error: "request body too large" } };
  }

  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > maxPutBodyBytes) {
    return { ok: false, status: 413, body: { error: "request body too large" } };
  }

  try {
    return { ok: true, patch: normalizeSharedStatePatch(JSON.parse(rawBody) as unknown) };
  } catch {
    return { ok: false, status: 400, body: { error: "invalid JSON" } };
  }
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
  const mergedPreferences = {
    ...defaultState.preferences,
    ...(value?.preferences ?? {})
  } satisfies SharedPreferences;
  const householdMembers = normalizeHouseholdMembers(
    mergedPreferences.householdMembers,
    Number(mergedPreferences.adults),
    Number(mergedPreferences.children)
  );
  const householdCounts = countHouseholdMembers(householdMembers);

  return {
    preferences: {
      ...mergedPreferences,
      adults: householdCounts.adults,
      children: householdCounts.children,
      householdMembers,
      customStaples: dedupeCustomStaples(value?.preferences?.customStaples ?? []),
      sectionOrder: normalizeSectionOrder(value?.preferences?.sectionOrder)
    },
    mealPlan: normalizePlan(value?.mealPlan ?? null, { ...mergedPreferences, theme: "system" }),
    groceryOverrides: normalizeGroceryOverrides(value?.groceryOverrides),
    customGroceryItems: (value?.customGroceryItems ?? [])
      .map(normalizeCustomGroceryItem)
      .filter((item): item is CustomGroceryItem => Boolean(item)),
    customRecipes: normalizeCustomRecipes(value?.customRecipes),
    savedWeeks: (value?.savedWeeks ?? []).map((week) => normalizeArchivedSavedWeek({
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

async function writeHistorySnapshot() {
  try {
    await fs.mkdir(historyDirectoryPath, { recursive: true });
    const stamp = new Date().toISOString().replace(/[.:]/g, "-");
    const historyPath = path.join(historyDirectoryPath, `meals-state-${stamp}.json`);
    await fs.copyFile(stateFilePath, historyPath);

    const entries = await fs.readdir(historyDirectoryPath);
    const snapshots = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => {
          const snapshotPath = path.join(historyDirectoryPath, entry);
          const stats = await fs.stat(snapshotPath);
          return { snapshotPath, mtimeMs: stats.mtimeMs };
        })
    );

    await Promise.all(
      snapshots
        .sort((left, right) => right.mtimeMs - left.mtimeMs)
        .slice(maxHistorySnapshots)
        .map(({ snapshotPath }) => fs.unlink(snapshotPath).catch(() => undefined))
    );
  } catch {
    // History snapshots are best effort and must not block state writes.
  }
}

async function writeStateRecord(nextState: SharedAppState) {
  const formatted = `${JSON.stringify(nextState, null, 2)}\n`;

  try {
    await fs.copyFile(stateFilePath, backupStateFilePath);
    await writeHistorySnapshot();
  } catch {
    // First write or missing source file, nothing to back up yet.
  }

  await fs.writeFile(tempStateFilePath, formatted, "utf8");
  await fs.rename(tempStateFilePath, stateFilePath);
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

function mergeSavedWeeks(
  current: SharedAppState["savedWeeks"],
  incoming: SharedAppState["savedWeeks"],
  deletedIds: string[] = []
) {
  const deletedIdSet = new Set(deletedIds);
  const merged = incoming.filter((week) => !deletedIdSet.has(week.id));
  const seen = new Set(merged.map((week) => week.id));

  for (const week of current) {
    if (!seen.has(week.id) && !deletedIdSet.has(week.id)) {
      merged.push(week);
      seen.add(week.id);
    }
  }

  return merged;
}

export function mergeStatePatch(current: SharedAppState, patch: SharedStatePatch): Partial<SharedAppState> {
  let mergedPreferences: SharedPreferences = patch.preferences
    ? {
        ...current.preferences,
        ...patch.preferences
      }
    : current.preferences;

  // Never let an older/stale client or lane sync silently purge user-managed staples.
  // Explicit single-item edits still work; only a full non-empty -> empty wipe is protected.
  if (
    patch.preferences?.customStaples &&
    patch.preferences.customStaples.length === 0 &&
    current.preferences.customStaples.length > 0 &&
    !patch.customStaplesReplace
  ) {
    mergedPreferences = {
      ...mergedPreferences,
      customStaples: current.preferences.customStaples
    };
  }

  const merged: Partial<SharedAppState> = {
    ...patch,
    preferences: mergedPreferences
  };
  delete (merged as SharedStatePatch).customStaplesReplace;
  delete (merged as SharedStatePatch).savedWeekDeletedIds;

  // Saved archives are durable records. If a stale client sends a shorter archive list,
  // merge instead of deleting live history.
  if (patch.savedWeeks && (patch.savedWeeks.length < current.savedWeeks.length || patch.savedWeekDeletedIds)) {
    merged.savedWeeks = mergeSavedWeeks(current.savedWeeks, patch.savedWeeks, patch.savedWeekDeletedIds);
  }

  return merged;
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
  const parsedRequest = await parsePutStateRequest(request);

  if (!parsedRequest.ok) {
    return NextResponse.json(parsedRequest.body, { status: parsedRequest.status });
  }

  const patch = parsedRequest.patch;
  const ifMatch = request.headers.get("if-match");

  const recordPromise = writeQueue.catch(() => undefined).then(async () => {
    const current = await readStateRecord();
    const currentEtag = createEtag(current.raw);

    // Safari may convert strong etags to weak (W/"..."), so strip the prefix
    const normalizedIfMatch = ifMatch?.replace(/^W\//, "") ?? null;
    if (normalizedIfMatch && normalizedIfMatch !== currentEtag) {
      return { conflict: true as const, record: current };
    }

    const guardedPatch = mergeStatePatch(current.state, patch);
    const nextState = sanitizeState({
      ...current.state,
      ...guardedPatch
    });
    return { conflict: false as const, record: await writeStateRecord(nextState) };
  });

  writeQueue = recordPromise;
  const result = await recordPromise;

  if (result.conflict) {
    return NextResponse.json(createResponseBody(result.record), {
      status: 412,
      headers: {
        ETag: createEtag(result.record.raw),
        "Cache-Control": "no-store"
      }
    });
  }

  return jsonResponse(result.record);
}
