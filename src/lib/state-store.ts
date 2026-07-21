import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_PREFERENCES, DEFAULT_SECTION_ORDER } from "@/lib/constants";
import { normalizeExcludedIngredients } from "@/lib/allergens";
import { countHouseholdMembers, normalizeHouseholdMembers } from "@/lib/household";
import { dedupeCustomStaples, normalizeIngredientCategory } from "@/lib/custom-staples";
import { normalizeBucketPlan, reconcileBucketPlanSafety } from "@/lib/meal-buckets";
import { normalizeMealProfileId } from "@/lib/meal-profiles";
import { normalizeSavedArchiveRecord } from "@/lib/saved-week";
import {
  CustomRecipe,
  BucketMealPlan,
  CustomGroceryItem,
  GroceryOverride,
  GroceryItem,
  Ingredient,
  IngredientCategory,
  MealType,
  ProteinType,
  SharedAppState,
  SharedPreferences,
  SharedStatePatch,
  SavedWeek
} from "@/types";

export const maxHistorySnapshots = 200;
export const maxPutBodyBytes = 1024 * 1024;
const mealTypes = ["breakfast", "brunch", "lunch", "dinner"] as const;
const proteinTypes = ["chicken", "pork", "fish", "red-meat"] as const;

export const defaultState: SharedAppState = {
  preferences: {
    selectedProteins: DEFAULT_PREFERENCES.selectedProteins,
    favoriteProteins: DEFAULT_PREFERENCES.favoriteProteins,
    favoriteRecipeIds: DEFAULT_PREFERENCES.favoriteRecipeIds,
    adults: DEFAULT_PREFERENCES.adults,
    children: DEFAULT_PREFERENCES.children,
    householdMembers: DEFAULT_PREFERENCES.householdMembers,
    customStaples: [],
    sectionOrder: DEFAULT_PREFERENCES.sectionOrder,
    brunchMode: DEFAULT_PREFERENCES.brunchMode,
    excludedIngredients: DEFAULT_PREFERENCES.excludedIngredients,
    mealProfileId: DEFAULT_PREFERENCES.mealProfileId
  },
  mealPlan: null,
  groceryOverrides: {},
  customGroceryItems: [],
  customRecipes: [],
  savedWeeks: []
};

type StoredState = SharedAppState & { stateVersion?: number };

export interface StateRecord {
  raw: string;
  state: SharedAppState;
  version: number;
}

function normalizeCategory(value: unknown): IngredientCategory {
  return normalizeIngredientCategory(value);
}

function normalizeSectionOrder(value: unknown): IngredientCategory[] {
  if (!Array.isArray(value)) return DEFAULT_SECTION_ORDER;
  const validSet = new Set(DEFAULT_SECTION_ORDER);
  const seen = new Set<IngredientCategory>();
  const ordered: IngredientCategory[] = [];
  for (const item of value) {
    const normalized = normalizeCategory(item);
    if (validSet.has(normalized) && !seen.has(normalized)) {
      ordered.push(normalized);
      seen.add(normalized);
    }
  }
  for (const category of DEFAULT_SECTION_ORDER) {
    if (!seen.has(category)) ordered.push(category);
  }
  return ordered;
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
  return Array.isArray(value) ? value.map(normalizeString).filter((item) => item.length > 0) : [];
}

function normalizeMealTypes(value: unknown): MealType[] {
  if (!Array.isArray(value)) return [];
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
  if (!Array.isArray(value)) return [];
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
  if (!isRecord(value)) return null;
  const name = normalizeString(value.name);
  const quantity = normalizeFiniteNumber(value.quantity, Number.NaN);
  if (!name || !Number.isFinite(quantity) || quantity <= 0) return null;
  return { name, quantity, unit: normalizeString(value.unit), category: normalizeCategory(value.category) };
}

function normalizeCustomRecipe(value: unknown): CustomRecipe | null {
  if (!isRecord(value)) return null;
  const id = normalizeString(value.id);
  const name = normalizeString(value.name);
  const mealType = normalizeMealTypes(value.mealType);
  if (!id.startsWith("custom-") || !name || mealType.length === 0) return null;
  const ingredients = Array.isArray(value.ingredients)
    ? value.ingredients.map(normalizeRecipeIngredient).filter((ingredient): ingredient is Ingredient => Boolean(ingredient))
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
  return Array.isArray(value) ? value.map(normalizeCustomRecipe).filter((recipe): recipe is CustomRecipe => Boolean(recipe)) : [];
}

function normalizeCustomGroceryItem(value: unknown): CustomGroceryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CustomGroceryItem>;
  const name = item.name?.trim();
  const quantity = Number(item.quantity);
  if (!item.id || !name || !Number.isFinite(quantity) || quantity <= 0) return null;
  return { id: item.id, name, quantity, unit: item.unit?.trim() ?? "", category: normalizeCategory(item.category), collected: Boolean(item.collected) };
}

function normalizeGroceryOverrides(value: unknown): Record<string, GroceryOverride> {
  if (!isRecord(value)) return {};
  const overrides: Record<string, GroceryOverride> = {};
  for (const [key, override] of Object.entries(value)) {
    if (!key || !isRecord(override)) continue;
    const hasAdjustment = typeof override.adjustment === "number" && Number.isFinite(override.adjustment);
    const hasCollected = typeof override.collected === "boolean";
    if (!hasAdjustment && !hasCollected) continue;
    overrides[key] = { adjustment: hasAdjustment ? Number(override.adjustment) : 0, collected: hasCollected ? Boolean(override.collected) : false };
  }
  return overrides;
}

export function normalizeSharedStatePatch(value: unknown): SharedStatePatch {
  if (!isRecord(value)) return {};
  const patch = value as Partial<SharedStatePatch>;
  const normalized: SharedStatePatch = { ...patch };
  if (Object.hasOwn(value, "customRecipes")) normalized.customRecipes = normalizeCustomRecipes(value.customRecipes);
  if (Object.hasOwn(value, "groceryOverrides")) normalized.groceryOverrides = normalizeGroceryOverrides(value.groceryOverrides);
  if (Object.hasOwn(value, "mealPlan")) {
    if (value.mealPlan === null) {
      normalized.mealPlan = null;
    } else {
      const preferences = normalizePreferences(patch.preferences);
      const recipes = normalized.customRecipes ?? [];
      const plan = normalizeBucketPlan(value.mealPlan, { ...preferences, theme: "system" });
      normalized.mealPlan = plan ? reconcileBucketPlanSafety(plan, { ...preferences, theme: "system" }, recipes) : null;
      if (isRecord(value.mealPlan) && value.mealPlan.schemaVersion !== 2 && plan) normalized.legacyMealPlanPatch = true;
    }
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

function normalizeSavedGroceryItem(value: unknown): GroceryItem | null {
  if (!isRecord(value)) return null;
  const key = normalizeString(value.key);
  const name = normalizeString(value.name);
  const quantity = normalizeFiniteNumber(value.quantity, Number.NaN);
  if (!key || !name || !Number.isFinite(quantity) || quantity < 0) return null;
  return {
    key,
    name,
    quantity,
    unit: normalizeString(value.unit),
    category: normalizeCategory(value.category),
    isStaple: Boolean(value.isStaple),
    collected: Boolean(value.collected),
    ...(value.isCustom === true ? { isCustom: true } : {})
  };
}

function normalizePreferences(value: unknown): SharedPreferences {
  const raw = isRecord(value) ? value : {};
  const mergedPreferences = { ...defaultState.preferences, ...raw } satisfies SharedPreferences;
  const householdMembers = normalizeHouseholdMembers(mergedPreferences.householdMembers, Number(mergedPreferences.adults), Number(mergedPreferences.children));
  const householdCounts = countHouseholdMembers(householdMembers);
  const selectedProteins = normalizeProteinTypes(mergedPreferences.selectedProteins);
  const favoriteProteins = normalizeProteinTypes(mergedPreferences.favoriteProteins);
  return {
    ...mergedPreferences,
    selectedProteins: selectedProteins.length > 0 ? selectedProteins : defaultState.preferences.selectedProteins,
    favoriteProteins,
    favoriteRecipeIds: normalizeStringList(mergedPreferences.favoriteRecipeIds),
    brunchMode: Boolean(mergedPreferences.brunchMode),
    adults: householdCounts.adults,
    children: householdCounts.children,
    householdMembers,
    customStaples: dedupeCustomStaples(Array.isArray(raw.customStaples) ? raw.customStaples : []),
    sectionOrder: normalizeSectionOrder(raw.sectionOrder),
    excludedIngredients: normalizeExcludedIngredients(raw.excludedIngredients),
    mealProfileId: normalizeMealProfileId(raw.mealProfileId)
  };
}

function normalizeSavedArchive(value: unknown): SharedAppState["savedWeeks"][number] | null {
  if (!isRecord(value)) return null;
  const id = normalizeString(value.id);
  const savedAt = normalizeString(value.savedAt);
  const label = normalizeString(value.label);
  if (!id || !savedAt || !label || !isRecord(value.mealPlan)) return null;
  const groceryList = Array.isArray(value.groceryList) ? value.groceryList.map(normalizeSavedGroceryItem).filter((item): item is GroceryItem => Boolean(item)) : [];
  const customGroceryItems = Array.isArray(value.customGroceryItems) ? value.customGroceryItems.map(normalizeCustomGroceryItem).filter((item): item is CustomGroceryItem => Boolean(item)) : [];
  if (value.kind === "bucket-plan") {
    const mealPlan = normalizeBucketPlan(value.mealPlan, { ...defaultState.preferences, theme: "system" });
    if (!mealPlan) return null;
    return normalizeSavedArchiveRecord({ kind: "bucket-plan", schemaVersion: 1, id, savedAt, label, mealPlan, groceryList, customGroceryItems });
  }
  const weekOf = normalizeString(value.weekOf);
  if (!weekOf || !Array.isArray(value.mealPlan.days)) return null;
  return normalizeSavedArchiveRecord({ id, savedAt, weekOf, label, mealPlan: value.mealPlan as unknown as SavedWeek["mealPlan"], groceryList, customGroceryItems });
}

export function sanitizeState(value: unknown): SharedAppState {
  const raw = isRecord(value) ? value : {};
  const preferences = normalizePreferences(raw.preferences);
  const customRecipes = normalizeCustomRecipes(raw.customRecipes);
  const normalizedPlan = normalizeBucketPlan(raw.mealPlan, { ...preferences, theme: "system" });
  const mealPlan: BucketMealPlan | null = normalizedPlan ? reconcileBucketPlanSafety(normalizedPlan, { ...preferences, theme: "system" }, customRecipes) : null;
  return {
    preferences,
    mealPlan,
    groceryOverrides: normalizeGroceryOverrides(raw.groceryOverrides),
    customGroceryItems: Array.isArray(raw.customGroceryItems) ? raw.customGroceryItems.map(normalizeCustomGroceryItem).filter((item): item is CustomGroceryItem => Boolean(item)) : [],
    customRecipes,
    savedWeeks: Array.isArray(raw.savedWeeks) ? raw.savedWeeks.map(normalizeSavedArchive).filter((week): week is SharedAppState["savedWeeks"][number] => Boolean(week)) : []
  };
}

export function normalizeStateVersion(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function serializeStoredState(state: SharedAppState, stateVersion: number, space?: number): string {
  return JSON.stringify({ ...state, stateVersion } satisfies StoredState, null, space);
}

function mergeSavedWeeks(current: SharedAppState["savedWeeks"], incoming: SharedAppState["savedWeeks"], deletedIds: string[] = []) {
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
  let mergedPreferences: SharedPreferences = patch.preferences ? { ...current.preferences, ...patch.preferences } : current.preferences;
  if (patch.preferences?.customStaples && patch.preferences.customStaples.length === 0 && current.preferences.customStaples.length > 0 && !patch.customStaplesReplace) {
    mergedPreferences = { ...mergedPreferences, customStaples: current.preferences.customStaples };
  }
  const merged: Partial<SharedAppState> = { ...patch, preferences: mergedPreferences };
  delete (merged as SharedStatePatch).customStaplesReplace;
  delete (merged as SharedStatePatch).savedWeekDeletedIds;
  delete (merged as SharedStatePatch).mealPlanReplace;
  delete (merged as SharedStatePatch).legacyMealPlanPatch;
  if (current.mealPlan?.schemaVersion === 2 && Object.hasOwn(patch, "mealPlan") && !patch.mealPlanReplace) {
    const incoming = patch.mealPlan;
    if (incoming === null || patch.legacyMealPlanPatch || incoming?.schemaVersion !== 2) merged.mealPlan = current.mealPlan;
  }
  if (patch.savedWeeks && (patch.savedWeeks.length < current.savedWeeks.length || patch.savedWeekDeletedIds)) {
    merged.savedWeeks = mergeSavedWeeks(current.savedWeeks, patch.savedWeeks, patch.savedWeekDeletedIds);
  }
  return merged;
}

export function createStateStore(dataRoot: string) {
  const stateFilePath = path.join(dataRoot, "meals-state.json");
  const backupStateFilePath = path.join(dataRoot, "meals-state.backup.json");
  const historyDirectoryPath = path.join(dataRoot, "meals-state-history");
  const tempStateFilePath = path.join(dataRoot, "meals-state.json.tmp");
  let writeQueue: Promise<unknown> = Promise.resolve();

  async function ensureStateFile() {
    try {
      await fs.access(stateFilePath);
    } catch {
      await fs.mkdir(dataRoot, { recursive: true });
      await fs.writeFile(stateFilePath, `${serializeStoredState(defaultState, 0, 2)}\n`, "utf8");
    }
  }

  async function readStateRecord(): Promise<StateRecord> {
    await ensureStateFile();
    const raw = await fs.readFile(stateFilePath, "utf8");
    const stored = JSON.parse(raw) as Partial<StoredState>;
    const parsed = sanitizeState(stored);
    const version = normalizeStateVersion(stored.stateVersion);
    return {
      // The ETag hashes the sanitized client state plus the server-only counter so
      // every successful write changes validators even when visible state repeats.
      raw: serializeStoredState(parsed, version),
      state: parsed,
      version
    };
  }

  async function writeHistorySnapshot() {
    try {
      await fs.mkdir(historyDirectoryPath, { recursive: true });
      const stamp = new Date().toISOString().replace(/[.:]/g, "-");
      const historyPath = path.join(historyDirectoryPath, `meals-state-${stamp}-${process.hrtime.bigint()}.json`);
      await fs.copyFile(stateFilePath, historyPath);
      const entries = await fs.readdir(historyDirectoryPath);
      const snapshots = await Promise.all(entries.filter((entry) => entry.endsWith(".json")).map(async (entry) => {
        const snapshotPath = path.join(historyDirectoryPath, entry);
        const stats = await fs.stat(snapshotPath);
        return { snapshotPath, mtimeMs: stats.mtimeMs };
      }));
      await Promise.all(snapshots.sort((left, right) => right.mtimeMs - left.mtimeMs).slice(maxHistorySnapshots).map(({ snapshotPath }) => fs.unlink(snapshotPath).catch(() => undefined)));
    } catch {
      // History snapshots are best effort and must not block state writes.
    }
  }

  async function writeStateRecord(nextState: SharedAppState, currentVersion: number): Promise<StateRecord> {
    const nextVersion = currentVersion + 1;
    const formatted = `${serializeStoredState(nextState, nextVersion, 2)}\n`;
    try {
      await fs.copyFile(stateFilePath, backupStateFilePath);
      await writeHistorySnapshot();
    } catch {
      // First write or missing source file, nothing to back up yet.
    }
    await fs.writeFile(tempStateFilePath, formatted, "utf8");
    await fs.rename(tempStateFilePath, stateFilePath);
    return { raw: serializeStoredState(nextState, nextVersion), state: nextState, version: nextVersion };
  }

  function withStateLock<T>(fn: () => Promise<T>): Promise<T> {
    // This in-process writeQueue serializes writes only within one server instance,
    // which matches the single-home-server deployment model.
    const run = writeQueue.catch(() => undefined).then(fn);
    writeQueue = run;
    return run;
  }

  return {
    paths: { stateFilePath, backupStateFilePath, historyDirectoryPath, tempStateFilePath },
    readStateRecord,
    writeStateRecord,
    withStateLock
  };
}
