# Meals — Remediation Plan

Source: a code review of this repo (the "Fable review"), converted into self-contained,
priority-ordered implementation prompts. Each item is the source of requirements for a
corresponding PR; PRs reference these `P-#` identifiers.

**Execution model:** dev work implemented by delegated coding agents (GPT-5.5), each on its
own branch → PR. CI (`.github/workflows/ci.yml`: tsc + lint + test on Node 22) gates every PR;
an Opus reviewer approves + merges. No PR merges without green CI + review.

**App shape:** Next.js 14 (App Router) PWA, file-backed shared state (`meals-state.json` +
ETag optimistic concurrency), Tailwind, node:test. Port 3113. No native deps (any Node works;
CI pins Node 22 for parity with fitness). State dir controlled by `MEALS_DATA_DIR`.

**Status legend:** ⬜ not started · 🟡 in progress · ✅ merged

---

## Sequencing

`CI foundation → P0-1 → P0-2 → P0-3 → P0-4 → P1-1 → P1-3 → P1-2 → P2-1 → P2-2`

- **P0-3, P0-4, P1-1, P1-3 all touch `src/app/api/state/route.ts`** — land them in that order,
  rebasing each on the previous, to avoid conflicts.
- **P1-2** (client god-context split) is independent of the route work but depends on **P0-3**'s
  new patch fields for its mutation call sites.

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| CI | CI workflow + README + ESLint | infra (first) | ✅ (#1) |
| P0-1 | Remove committed personal data (meals-state.json); fix start.sh paths | P0 | ⬜ |
| P0-2 | Fix grocery-list unit aggregation bugs | P0 | ⬜ |
| P0-3 | Make deleting the last custom staple / last saved week possible | P0 | ⬜ |
| P0-4 | Validate PUT /api/state bodies | P0 | ⬜ |
| P1-1 | Replace mtime-based state version with a monotonic counter | P1 | ⬜ |
| P1-2 | Break up the 1,039-line app-state god context | P1 | ⬜ |
| P1-3 | Extract state-file persistence from the route and test it | P1 | ⬜ |
| P2-1 | Service worker cache hygiene | P2 | ⬜ |
| P2-2 | Add README, ESLint config, and CI | P2 (CI done first) | ⬜ |

---

## CI foundation (done first, ahead of Fable ordering)
Add `.github/workflows/ci.yml` (Node 22: `npm ci` → `tsc --noEmit` → `npm run lint` → `npm test`), `.eslintrc.json` (`next/core-web-vitals`, non-interactive), and `README.md`. This is the merge gate for every subsequent PR. Covers most of Fable's P2-2; the `sharp` devDep audit stays with P2-2.

## P0-1: Remove committed personal data (meals-state.json)
`meals-state.json` (live runtime state: member names, staples, meal history) is tracked at repo root. `.gitignore` lists it but git doesn't untrack already-committed files. `start.sh` hardcodes `/Users/koda/...` paths and `HOME=/Users/koda`.
**Tasks:** `git rm --cached meals-state.json` + commit; verify app self-creates state on boot via the state route's `ensureStateFile()`; optionally add `meals-state.example.json` (sanitized, matching `defaultState`); rewrite `start.sh` to derive `APP_DIR` from `$(dirname "$0")` and `DATA_DIR` from `${MEALS_DATA_DIR:-...}`, drop hardcoded HOME/PATH; REPORT (do not run) the `git filter-repo` history-purge command as a manual follow-up (needs force-push).
**Acceptance:** fresh clone has no household data; `npm run dev` boots and self-creates state; start.sh has no hardcoded user paths.

## P0-2: Fix grocery-list unit aggregation bugs
`src/lib/grocery-builder.ts`: (1) `UNIT_CONVERSIONS` canonicalizes pint/quart/gallon→cup but is MISSING plain `cup`/`cups` (and singular/plural pint/quart/gallon), so "2 cups milk" and "1 quart milk" never merge. (2) Staple merge does `existing.quantity += staple.quantity` adding the staple's quantity in the STAPLE's unit to a CANONICAL-unit item (1 gallon staple adds 1, not 16), and matches `nameToKeys[0]` regardless of unit/category.
**Tasks:** extend `UNIT_CONVERSIONS` with cup/cups + plurals; audit `src/data/recipes.json` for unit spellings (add an assertion test that every unit canonicalizes or is intentionally unit-less like clove/bunch); fix the staple merge to convert through `canonicalizeUnit` before adding and only name-merge when canonical units match (else add as its own line); preserve `isStaple` behavior. Add tests: cups+quart merge, gallon staple onto cup item, mismatched-unit staple NOT merging into wrong unit.
**Acceptance:** new tests pass; existing 28 pass; "2 cups milk" + "1 gallon milk" staple → one milk line, correct canonical qty.

## P0-3: Make deleting the last custom staple / last saved week possible
`src/app/api/state/route.ts` `mergeStatePatch()`: if `patch.preferences.customStaples` is `[]` while current is non-empty → patch IGNORED (anti-wipe guard); if `patch.savedWeeks` shorter than current → union-merge keeps all. Side effect: deleting the LAST staple sends `[]` and is silently blocked; deleting saved weeks is resurrected by `mergeSavedWeeks`.
**Tasks:** replace implicit heuristics with explicit intent — extend PUT patch shape with tombstones `{ customStaplesReplace?: true, savedWeekDeletedIds?: string[] }`. When `customStaplesReplace` true, accept the provided list verbatim (incl. empty); else keep wipe protection. `mergeSavedWeeks`: union as today EXCEPT ids in `savedWeekDeletedIds` are removed. State file format unchanged. Update `src/lib/sync.ts`/`app-state.tsx` mutation sites (removeCustomStaple sends the flag; deleteSavedWeek sends the ids). Keep back-compat for plain patches. Add tests.
**Acceptance:** last staple deletes and stays deleted across the 3s poll; saved-week deletion survives a concurrent stale-client PUT; existing tests pass. **Touches route.ts — land before P0-4/P1-1/P1-3.**

## P0-4: Validate PUT /api/state bodies
`src/app/api/state/route.ts` PUT: `await request.json()` uncaught (malformed → 500); patch cast `as Partial<SharedAppState>` with no validation; `customRecipes` passed through raw; `mealPlan`/`groceryOverrides` unchecked. A buggy/malicious LAN client can persist arbitrary JSON every client then hydrates.
**Tasks:** try/catch `request.json()` → 400 `{error:"invalid JSON"}`; add validation (zod OR hand-rolled matching `normalizeCustomGroceryItem` style) for CustomRecipe (id, trimmed non-empty name, known mealType values, ingredients with name/qty/unit/category via `normalizeIngredientCategory`, drop invalid entries), mealPlan (delegate to `normalizePlan` in meal-generator if server-safe — verify no client-only imports — else structural check), groceryOverrides (values `{adjustment?: finite number, collected?: boolean}`, strip else); enforce max body size (>1MB → 413). Add normalizer tests.
**Acceptance:** malformed JSON → 400; garbage customRecipes entry → only valid persist; oversized → 413; existing tests pass. **Land after P0-3.**

## P1-1: Replace mtime-based state version with a monotonic counter
Route uses `Math.trunc(stats.mtimeMs)` as state "version"; clients compare it to decide whether to apply remote state. mtime is weak (granularity collapses writes, backup restore rewinds, clock changes, copyFile surprises).
**Tasks:** store integer `stateVersion` INSIDE the state file (increment every successful write in `writeStateRecord`, default 0 when absent); return it as `version` (response shape unchanged); derive ETag from content INCLUDING the counter (document choice inline); ensure `stateVersion` survives read→sanitize→write (server-side wrapper type, don't widen `SharedAppState` for clients); add a test for increments + migration from a file without the field.
**Acceptance:** two consecutive PUTs yield strictly increasing versions even within the same ms; restoring a backup doesn't confuse clients; tests pass. **Touches route.ts — after P0-4.**

## P1-2: Break up the 1,039-line app-state god context
`src/lib/app-state.tsx` is one context providing ~40 values (sync engine, preferences, meal plan, grocery, household, saved weeks, theme). Every consumer re-renders on ANY change; hard to review.
**Tasks (refactor, no behavior change):** extract transport/sync into `src/lib/use-shared-state-sync.ts` (owns refs, hydration, poll, ETag/412 retry, mutation queue; exposes `{state, hydrated, hasLoadedSharedState, syncError, mutate}`); split provider into PreferencesContext / MealPlanContext / GroceryContext with stable memoized values; keep a compat `useAppState()` composing them; PAUSE polling when tab hidden (visibilitychange → clear interval; resume+refresh on visible; refresh on focus) — real battery/server-load fix; no new deps. Verify with `tsc --noEmit` + tests + manual (hydration, staple add, regenerate, grocery check-off, conflict retry).
**Acceptance:** tsc clean; tests pass; each successor file < 400 lines, one responsibility; polling stops while hidden, recovers on focus. **Depends on P0-3's new patch fields for mutation call sites.**

## P1-3: Extract state-file persistence from the route and test it
`route.ts` mixes HTTP with a small database (default state, sanitize, atomic writes, backups, history rotation, merge heuristics, ETags, module-level writeQueue). None unit-tested.
**Tasks:** create `src/lib/state-store.ts` exporting `defaultState`, `sanitizeState`, `mergeStatePatch`, `readStateRecord`, `writeStateRecord`, and a `withStateLock(fn)` wrapper — parameterized by `dataRoot` via `createStateStore(dataRoot)` (not process.env at module scope). route.ts becomes parse/validate → store calls → HTTP mapping (ETag/304/412 stays in route). Add `tests/state-store.test.cjs` (temp dir): default-file creation, atomic write + backup + history rotation cap, sanitize of malformed input, mergeStatePatch guards (coordinate with P0-3 tombstones), serialized concurrent writes via Promise.all. Comment that the in-process writeQueue only serializes within one instance.
**Acceptance:** route.ts < 120 lines; new store tests pass alongside existing 28; API behavior unchanged. **Touches route.ts — last of the route series.**

## P2-1: Service worker cache hygiene
`public/sw.js` is network-first-with-cache-fallback for ALL GETs into a single unversioned cache (`meals-v1`): grows unboundedly (hashed `/_next/static` assets never evicted since name never changes); `/api/state` cached too (serves stale household state offline silently).
**Tasks:** version the cache name (bump per release or inject build id) and delete old caches in `activate` (the delete loop exists but never fires because the name is static); split caches — `meals-static-<v>` for static assets, `meals-api-<v>` for `/api/state` with maxEntries=1 (normalize URL as key); add a size guard for the static cache (~100 entries, trim oldest); keep registration + network-first strategy.
**Acceptance:** after a new build, previous build's assets evicted on activate; offline reload still renders shell + last-known state.

## P2-2: README, ESLint config, and CI (+ sharp audit)
Most of this ships in the CI-foundation PR (README, ESLint, CI workflow). Remaining for P2-2: audit `sharp` devDep — if `grep -r sharp src scripts` + next.config.mjs confirm no usage, remove it.
**Acceptance:** CI green; README accurate; npm ci footprint reduced if sharp removed.
