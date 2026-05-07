import {
  collectLegacyCustomStaples,
  LEGACY_CUSTOM_STAPLES_MIGRATION_KEY,
  LEGACY_PREFERENCES_STORAGE_KEY
} from "@/lib/custom-staples";

const keys = {
  theme: "meals.theme",
  legacyPreferences: LEGACY_PREFERENCES_STORAGE_KEY,
  legacyCustomStaplesMigration: LEGACY_CUSTOM_STAPLES_MIGRATION_KEY
};

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function readLegacyPayloads() {
  if (typeof window === "undefined") {
    return [];
  }

  const payloadKeys = new Set<string>([keys.legacyPreferences]);

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key?.startsWith("meals.")) {
      continue;
    }

    if (key === keys.theme || key === keys.legacyCustomStaplesMigration) {
      continue;
    }

    payloadKeys.add(key);
  }

  return [...payloadKeys]
    .map((key) => safeRead<unknown>(key))
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object");
}

export const storage = {
  loadTheme: () => safeRead<string>(keys.theme),
  saveTheme: (value: string) => safeWrite(keys.theme, value),
  loadLegacyCustomStaples: () => collectLegacyCustomStaples(readLegacyPayloads()),
  hasLegacyCustomStaplesMigration: () =>
    safeRead<boolean>(keys.legacyCustomStaplesMigration) === true,
  markLegacyCustomStaplesMigrationComplete: () =>
    safeWrite(keys.legacyCustomStaplesMigration, true)
};
