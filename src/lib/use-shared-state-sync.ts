import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PREFERENCES } from "@/lib/constants";
import { normalizeExcludedIngredients } from "@/lib/allergens";
import { migrateLegacyCustomStaplesToSharedState } from "@/lib/custom-staples";
import { normalizeBucketPlan, reconcileBucketPlanSafety } from "@/lib/meal-buckets";
import { normalizeMealProfileId } from "@/lib/meal-profiles";
import { storage } from "@/lib/storage";
import { SharedStateSyncError, fetchSharedState, pushSharedState } from "@/lib/sync";
import { countHouseholdMembers, normalizeHouseholdMembers } from "@/lib/household";
import { normalizeSavedArchiveRecord } from "@/lib/saved-week";
import {
  SharedAppState,
  SharedPreferences,
  SharedStatePatch,
  ThemePreference,
  UserPreferences
} from "@/types";

export const DEFAULT_SHARED_PREFERENCES: SharedPreferences = {
  selectedProteins: DEFAULT_PREFERENCES.selectedProteins,
  favoriteProteins: DEFAULT_PREFERENCES.favoriteProteins,
  favoriteRecipeIds: DEFAULT_PREFERENCES.favoriteRecipeIds,
  adults: DEFAULT_PREFERENCES.adults,
  children: DEFAULT_PREFERENCES.children,
  householdMembers: DEFAULT_PREFERENCES.householdMembers,
  customStaples: DEFAULT_PREFERENCES.customStaples,
  sectionOrder: DEFAULT_PREFERENCES.sectionOrder,
  brunchMode: DEFAULT_PREFERENCES.brunchMode,
  excludedIngredients: DEFAULT_PREFERENCES.excludedIngredients,
  mealProfileId: DEFAULT_PREFERENCES.mealProfileId
};

const EMPTY_SHARED_STATE: SharedAppState = {
  preferences: DEFAULT_SHARED_PREFERENCES,
  mealPlan: null,
  groceryOverrides: {},
  customGroceryItems: [],
  customRecipes: [],
  savedWeeks: []
};

export type SharedStateMutator = (
  updater: (current: SharedAppState, currentPreferences: UserPreferences) => SharedStatePatch | null
) => Promise<boolean>;

export function mergePreferences(
  sharedPreferences: SharedPreferences,
  theme: ThemePreference
): UserPreferences {
  const householdMembers = normalizeHouseholdMembers(
    sharedPreferences.householdMembers,
    sharedPreferences.adults ?? DEFAULT_SHARED_PREFERENCES.adults,
    sharedPreferences.children ?? DEFAULT_SHARED_PREFERENCES.children
  );
  const householdCounts = countHouseholdMembers(householdMembers);

  return {
    ...DEFAULT_PREFERENCES,
    ...sharedPreferences,
    adults: householdCounts.adults,
    children: householdCounts.children,
    householdMembers,
    selectedProteins: Array.from(
      new Set([
        ...(sharedPreferences.selectedProteins ?? DEFAULT_SHARED_PREFERENCES.selectedProteins),
        ...(sharedPreferences.favoriteProteins ?? DEFAULT_SHARED_PREFERENCES.favoriteProteins)
      ])
    ),
    excludedIngredients: normalizeExcludedIngredients(sharedPreferences.excludedIngredients),
    mealProfileId: normalizeMealProfileId(sharedPreferences.mealProfileId),
    theme
  };
}

function normalizeSharedState(state: SharedAppState, theme: ThemePreference): SharedAppState {
  const preferences = mergePreferences(state.preferences, theme);

  return {
    preferences: {
      selectedProteins: preferences.selectedProteins,
      favoriteProteins: preferences.favoriteProteins,
      favoriteRecipeIds: preferences.favoriteRecipeIds,
      adults: preferences.adults,
      children: preferences.children,
      householdMembers: preferences.householdMembers,
      customStaples: preferences.customStaples,
      sectionOrder: preferences.sectionOrder,
      brunchMode: preferences.brunchMode,
      excludedIngredients: preferences.excludedIngredients,
      mealProfileId: preferences.mealProfileId
    },
    mealPlan: (() => {
      const plan = normalizeBucketPlan(state.mealPlan, preferences);
      return plan ? reconcileBucketPlanSafety(plan, preferences, state.customRecipes ?? []) : null;
    })(),
    groceryOverrides: state.groceryOverrides ?? {},
    customGroceryItems: state.customGroceryItems ?? [],
    customRecipes: state.customRecipes ?? [],
    savedWeeks: [...(state.savedWeeks ?? [])]
      .map(normalizeSavedArchiveRecord)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  };
}

export function useSharedStateSync(theme: ThemePreference) {
  const [state, setState] = useState<SharedAppState>(EMPTY_SHARED_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [hasLoadedSharedState, setHasLoadedSharedState] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const etagRef = useRef<string | null>(null);
  const versionRef = useRef<number>(0);
  const isMutatingRef = useRef(false);
  const sharedStateRef = useRef<SharedAppState>(EMPTY_SHARED_STATE);
  const themeRef = useRef<ThemePreference>(theme);
  const mutationQueueRef = useRef<Promise<boolean>>(Promise.resolve(false));

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const applyRemoteState = useCallback((nextState: SharedAppState, nextVersion: number, nextEtag: string | null) => {
    const normalized = normalizeSharedState(nextState, themeRef.current);
    sharedStateRef.current = normalized;
    versionRef.current = nextVersion;
    etagRef.current = nextEtag;
    setState(normalized);
  }, []);

  const refresh = useCallback(async (etag?: string) => {
    if (isMutatingRef.current) {
      return;
    }

    try {
      const response = await fetchSharedState(etag);

      if (response.notModified || !response.state) {
        return;
      }

      if (response.state.version === versionRef.current) {
        etagRef.current = response.etag;
        return;
      }

      applyRemoteState(response.state, response.state.version, response.etag);
      setSyncError(null);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Unable to refresh shared state");
    }
  }, [applyRemoteState]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const response = await fetchSharedState();

        if (cancelled || !response.state) {
          return;
        }

        const migrated = await migrateLegacyCustomStaplesToSharedState(
          response.state,
          response.etag,
          {
            hasMigrationCompleted: storage.hasLegacyCustomStaplesMigration,
            loadLegacyCustomStaples: storage.loadLegacyCustomStaples,
            markMigrationComplete: storage.markLegacyCustomStaplesMigrationComplete,
            pushSharedState
          }
        );

        if (cancelled) {
          return;
        }

        applyRemoteState(migrated.state, migrated.version, migrated.etag);
        setHasLoadedSharedState(true);
        setSyncError(migrated.syncError);
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : "Unable to load shared state");
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [applyRemoteState]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let interval: number | null = null;

    const stopPolling = () => {
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
    };

    const startPolling = () => {
      if (document.visibilityState === "hidden" || interval !== null) {
        return;
      }

      interval = window.setInterval(() => {
        void refresh(etagRef.current ?? undefined);
      }, 3000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
        return;
      }

      startPolling();
      void refresh(etagRef.current ?? undefined);
    };

    const handleFocus = () => {
      if (document.visibilityState !== "hidden") {
        void refresh(etagRef.current ?? undefined);
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [hydrated, refresh]);

  const mutate = useCallback<SharedStateMutator>((updater) => {
    mutationQueueRef.current = mutationQueueRef.current.then(async () => {
      if (!hydrated) {
        return false;
      }

      if (!hasLoadedSharedState) {
        setSyncError("Shared state is not loaded yet. Retry once Meals reconnects.");
        return false;
      }

      const tryMutation = async (current: SharedAppState, etag?: string) => {
        const currentPreferences = mergePreferences(current.preferences, themeRef.current);
        const patch = updater(current, currentPreferences);

        if (!patch) {
          return { status: "noop" as const };
        }

        const response = await pushSharedState(patch, etag);
        applyRemoteState(response.state, response.state.version, response.etag);
        setSyncError(null);
        return { status: "applied" as const };
      };

      isMutatingRef.current = true;

      try {
        try {
          const result = await tryMutation(sharedStateRef.current, etagRef.current ?? undefined);
          return result.status === "applied";
        } catch (error) {
          if (error instanceof SharedStateSyncError && error.status === 412) {
            try {
              const latest = await fetchSharedState();

              if (latest.state) {
                applyRemoteState(latest.state, latest.state.version, latest.etag);
                const retryResult = await tryMutation(latest.state, latest.etag ?? undefined);
                return retryResult.status === "applied";
              }
            } catch (retryError) {
              if (retryError instanceof SharedStateSyncError && retryError.status === 412) {
                setSyncError("Meals changed again before this update could finish. Please try that action once more.");
                return false;
              }

              setSyncError(retryError instanceof Error ? retryError.message : "Unable to save shared state");
              return false;
            }

            setSyncError("Meals was updated elsewhere before this save finished. Latest state is loaded, please retry.");
            return false;
          }

          setSyncError(error instanceof Error ? error.message : "Unable to save shared state");
          return false;
        }
      } finally {
        isMutatingRef.current = false;
      }
    });

    return mutationQueueRef.current;
  }, [applyRemoteState, hasLoadedSharedState, hydrated]);

  return {
    state,
    hydrated,
    hasLoadedSharedState,
    syncError,
    mutate
  };
}
