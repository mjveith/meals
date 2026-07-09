# Meals

Meals is a household meal-planning PWA built with Next.js. It keeps shared household meal-planning state in a file-backed JSON store exposed through `/api/state`, using ETag-based optimistic concurrency so clients can safely merge updates. The client polls for remote state every 3 seconds to keep household devices in sync.

## Stack

- Next.js 14 App Router
- React 18 and TypeScript
- Tailwind CSS
- `node:test` for unit tests (`.cjs` test files)

## Development

Install dependencies:

```bash
npm ci
```

Run the app on port 3113 with shared local state next to the repo:

```bash
npm run dev
```

`npm run dev` sets `MEALS_DATA_DIR=../shared-state`, so runtime state files are written in a sibling `shared-state` directory.

For an isolated sandbox state directory inside this repo, run:

```bash
npm run dev:sandbox
```

`npm run dev:sandbox` sets `MEALS_DATA_DIR=./dev-data`, so state files are written under `dev-data/`.

If `MEALS_DATA_DIR` is not set, the state API falls back to the current working directory. The primary state file is `meals-state.json`; the API may also create backup/history files in the same data directory.

## Quality checks

```bash
npx tsc --noEmit
npm run lint
npm test
```

## Deployment

The app is served on port 3113. `npm start` runs `next start -p 3113` with `MEALS_DATA_DIR=../shared-state`. The repository also includes `start.sh`, which builds the app before launching `next start`; it honors `PORT` with a default of 3113 and sets `MEALS_DATA_DIR` for the launched process.
