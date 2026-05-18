import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_PREFERENCES, DEFAULT_SECTION_ORDER } from "@/lib/constants";
import { normalizeExcludedIngredients } from "@/lib/allergens";
import { countHouseholdMembers, normalizeHouseholdMembers } from "@/lib/household";
import { dedupeCustomStaples, normalizeIngredientCategory } from "@/lib/custom-staples";
import { normalizeArchivedSavedWeek } from "@/lib/saved-week";
import {
  CustomGroceryItem,
  GroceryItem,
  IngredientCategory,
  SharedAppState,
  SharedPreferences
} from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dataRoot = process.env.MEALS_DATA_DIR ?? process.cwd();
const stateFilePath = path.join(dataRoot, "meals-state.json");
const backupStateFilePath = path.join(dataRoot, "meals-state.backup.json");
const historyDirectoryPath = path.join(dataRoot, "meals-state-history");
const tempStateFilePath = path.join(dataRoot, "meals-state.json.tmp");
const maxHistorySnapshots = 200;

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
    brunchMode: DEFAULT_PREFERENCES.brunchMode,
    excludedIngredients: DEFAULT_PREFERENCES.excludedIngredients
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
      sectionOrder: normalizeSectionOrder(value?.preferences?.sectionOrder),
      excludedIngredients: normalizeExcludedIngredients(value?.preferences?.excludedIngredients)
    },
    mealPlan: value?.mealPlan ?? null,
    groceryOverrides: value?.groceryOverrides ?? {},
    customGroceryItems: (value?.customGroceryItems ?? [])
      .map(normalizeCustomGroceryItem)
      .filter((item): item is CustomGroceryItem => Boolean(item)),
    customRecipes: value?.customRecipes ?? [],
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

function mergeSavedWeeks(current: SharedAppState["savedWeeks"], incoming: SharedAppState["savedWeeks"]) {
  const merged = [...incoming];
  const seen = new Set(merged.map((week) => week.id));

  for (const week of current) {
    if (!seen.has(week.id)) {
      merged.push(week);
      seen.add(week.id);
    }
  }

  return merged;
}

function mergeStatePatch(current: SharedAppState, patch: Partial<SharedAppState>): Partial<SharedAppState> {
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
    current.preferences.customStaples.length > 0
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

  // Saved archives are durable records. If a stale client sends a shorter archive list,
  // merge instead of deleting live history.
  if (patch.savedWeeks && patch.savedWeeks.length < current.savedWeeks.length) {
    merged.savedWeeks = mergeSavedWeeks(current.savedWeeks, patch.savedWeeks);
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
  const patch = (await request.json()) as Partial<SharedAppState>;
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
