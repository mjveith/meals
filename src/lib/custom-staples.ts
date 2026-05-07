import { CATEGORY_LABELS } from "@/lib/constants";
import {
  CustomStaple,
  IngredientCategory,
  SharedAppState,
  SharedStateResponse
} from "@/types";

export const LEGACY_PREFERENCES_STORAGE_KEY = "meals.preferences";
export const LEGACY_CUSTOM_STAPLES_MIGRATION_KEY = "meals.legacy-custom-staples-migrated.v1";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return Math.round(quantity * 100) / 100;
}

export function isIngredientCategory(value: unknown): value is IngredientCategory {
  return typeof value === "string" && value in CATEGORY_LABELS;
}

export function normalizeIngredientCategory(value: unknown): IngredientCategory {
  if (value === "staples") {
    return "other";
  }

  return isIngredientCategory(value) ? value : "other";
}

export function normalizeCustomStaple(value: unknown): CustomStaple | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const staple = value as Partial<CustomStaple>;
  const name = normalizeText(staple.name);
  const quantity = normalizeQuantity(staple.quantity);

  if (!name || quantity === null) {
    return null;
  }

  return {
    name,
    quantity,
    unit: normalizeText(staple.unit),
    category: normalizeIngredientCategory(staple.category)
  };
}

export function getCustomStapleKey(staple: Pick<CustomStaple, "name" | "unit" | "category">) {
  return [
    normalizeIngredientCategory(staple.category),
    normalizeText(staple.name).toLowerCase(),
    normalizeText(staple.unit).toLowerCase()
  ].join("::");
}

export function dedupeCustomStaples(values: unknown[]): CustomStaple[] {
  const deduped = new Map<string, CustomStaple>();

  values.forEach((value) => {
    const staple = normalizeCustomStaple(value);

    if (!staple) {
      return;
    }

    const key = getCustomStapleKey(staple);

    if (!deduped.has(key)) {
      deduped.set(key, staple);
    }
  });

  return [...deduped.values()];
}

export function mergeCustomStaples(current: unknown[], incoming: unknown[]) {
  return dedupeCustomStaples([...current, ...incoming]);
}

export function customStapleListsEqual(left: unknown[], right: unknown[]) {
  const normalizedLeft = dedupeCustomStaples(left);
  const normalizedRight = dedupeCustomStaples(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  const rightByKey = new Map(
    normalizedRight.map((staple) => [getCustomStapleKey(staple), staple])
  );

  return normalizedLeft.every((staple) => {
    const other = rightByKey.get(getCustomStapleKey(staple));

    return other !== undefined
      && staple.name === other.name
      && staple.quantity === other.quantity
      && staple.unit === other.unit
      && staple.category === other.category;
  });
}

function extractCustomStaplesArray(value: unknown): unknown[] {
  const record = asObject(value);

  if (!record) {
    return [];
  }

  if (Array.isArray(record.customStaples)) {
    return record.customStaples;
  }

  const nestedSources = [record.preferences, record.state, record.appState, record.data];

  for (const source of nestedSources) {
    const nested = extractCustomStaplesArray(source);

    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

export function extractLegacyCustomStaples(value: unknown) {
  return dedupeCustomStaples(extractCustomStaplesArray(value));
}

export function collectLegacyCustomStaples(values: unknown[]) {
  return dedupeCustomStaples(
    values.flatMap((value) => extractCustomStaplesArray(value))
  );
}

export interface LegacyCustomStaplesMigrationResult {
  state: SharedAppState;
  version: number;
  etag: string | null;
  syncError: string | null;
}

export interface LegacyCustomStaplesMigrationDependencies {
  hasMigrationCompleted: () => boolean;
  loadLegacyCustomStaples: () => CustomStaple[];
  markMigrationComplete: () => void;
  pushSharedState: (patch: Partial<SharedAppState>) => Promise<{
    state: SharedStateResponse;
    etag: string | null;
  }>;
}

export async function migrateLegacyCustomStaplesToSharedState(
  state: SharedStateResponse,
  etag: string | null,
  dependencies: LegacyCustomStaplesMigrationDependencies
): Promise<LegacyCustomStaplesMigrationResult> {
  if (dependencies.hasMigrationCompleted()) {
    return { state, version: state.version, etag, syncError: null };
  }

  const legacyCustomStaples = dependencies.loadLegacyCustomStaples();

  if (legacyCustomStaples.length === 0) {
    dependencies.markMigrationComplete();
    return { state, version: state.version, etag, syncError: null };
  }

  const mergedCustomStaples = mergeCustomStaples(
    state.preferences.customStaples,
    legacyCustomStaples
  );

  if (customStapleListsEqual(mergedCustomStaples, state.preferences.customStaples)) {
    dependencies.markMigrationComplete();
    return {
      state: {
        ...state,
        preferences: {
          ...state.preferences,
          customStaples: mergedCustomStaples
        }
      },
      version: state.version,
      etag,
      syncError: null
    };
  }

  try {
    const response = await dependencies.pushSharedState({
      preferences: {
        ...state.preferences,
        customStaples: mergedCustomStaples
      }
    });

    dependencies.markMigrationComplete();

    return {
      state: response.state,
      version: response.state.version,
      etag: response.etag,
      syncError: null
    };
  } catch (error) {
    return {
      state,
      version: state.version,
      etag,
      syncError: error instanceof Error ? error.message : "Unable to migrate legacy custom staples"
    };
  }
}
