# Muse Home Collective

Design-driven storefront for a boutique furniture brand (Vite + React + shadcn/ui),
backed by **Neon PostgreSQL** through a minimal server-side API.

The database layer ships with a deterministic synthetic catalog, a realistic
import-audit/inventory evidence model, and a **verified repair** workflow:
an intentionally corrupted "failed catalog import" scenario that a verifier
detects from audit evidence alone and a transactional repair fixes.

## Architecture

```
Browser (Vite + React)          Server (Node, server/index.ts)       Neon PostgreSQL
src/lib/api.ts  ──fetch──▶  /api/collections  /api/products  ──postgres.js──▶  collections
src/hooks/useCatalog.ts         (the ONLY process holding            products
                                DATABASE_URL; prepare:false for      inventory_ledger
                                Neon pooler compatibility)           catalog_imports / _items
                                                                     catalog_snapshots
                                                                     catalog_repair_log
```

- **Never expose DATABASE_URL to the browser.** It has no `VITE_` prefix, is
  read only in `server/index.ts` / `db/*`, and the frontend talks to
  `VITE_API_URL` (default `http://localhost:3001`), a plain HTTP surface with
  read-only catalog endpoints. Supabase (`@supabase/supabase-js`, RLS
  migration, `src/integrations/supabase/`) has been fully removed.
- Cart and wishlist remain client-side (zustand + localStorage) as before.

## Setup

```sh
npm install
cp .env.example .env          # then set DATABASE_URL (Neon or any Postgres)
```

Any Postgres-compatible server works — paste the pooled connection string from
the Neon dashboard, or any standard `postgres://` URL from a local Postgres.

## Run

```sh
npm run dev:all        # API on :3001 + Vite dev server on :8080
# or separately:
npm run server         # API only
npm run dev            # frontend only
```

## Database lifecycle

```sh
npm run db:schema      # create tables (idempotent)
npm run db:seed        # deterministic canonical seed (idempotent)
npm run db:corrupt     # apply the failed-import corruption scenario
npm run db:verify      # run the verifier (exit 1 if violations)
npm run db:repair      # evidence-driven transactional repair + re-verify
```

## Synthetic data (deterministic, seed 20260903)

| Dataset                        | Count       |
| ------------------------------ | ----------- |
| Collections                    | 12          |
| Products (25 per collection)   | 300         |
| Inventory ledger entries       | ~1,650      |
| Baseline import batches        | 3 (completed, 100 snapshot rows each) |
| Failed import `imp-2026-090`   | 18 corrupt rows + evidence |

Prices, stock, ratings, series names, and copy are generated with a fixed-rate
PRNG (`db/catalog-data.ts`): re-running the seeder always produces the exact
same rows, and every unit of stock is backed by an `inventory_ledger` entry.

## Scenario: the failed autumn refresh

`imp-2026-090` (`autumn-refresh.csv`) is a catalog import run by night ops
that crashed (worker OOM) after partially applying **18 of 240 rows**. It
leaves three fault classes, chosen deterministically and without overlap:

1. **Wrong collection assignments (8 products)** — the export's collection
   column was offset by one, so rows landed in the *next* collection in sort
   order.
2. **Stock mismatches (6 products)** — stock was written directly (`+12`),
   bypassing the inventory ledger, so `products.stock ≠ SUM(ledger.delta)`.
3. **Inflated prices (4 products)** — a currency bug multiplied prices ~1.9×.

The corruption is *inferable from evidence*, not guesswork:
`catalog_imports` records the failed run; `catalog_import_items` stores the
canonical `old_*` values next to the applied `new_*` values;
`catalog_snapshots` captures non-canonical (`is_canonical = false`) rows the
import actually wrote. The verifier (`db/verify.ts`, SQL form in
`db/sql/verify.sql`) proves catalog state against these two independent
evidence sources plus the ledger invariant. See `db/sql/corruption.sql` and
`db/sql/repair.sql` for reviewable SQL artifacts.

## Tests

```sh
npm test              # everything (DB integration tests skip if no DATABASE_URL)
npm run test:repair   # the VERIFIED REPAIR test
npm run test:db       # catalog/db integration tests
```

`test:repair` has two layers:

1. **SQL artifact contract** — always runs, fast and deterministic, no
   database: the reviewable SQL in `db/sql/` must stay in lockstep with the
   TypeScript implementations (`db/repair.ts`, `db/verify.ts`,
   `db/corrupt.ts`), the schema must define every evidence table, and
   browser code must be unable to reach the database (no `DATABASE_URL` /
   Supabase references in `src/`, no `import.meta.env` in `db/`, `server/`,
   `tests/`).
2. **Full integration flow** — runs when `DATABASE_URL` is set, against an
   isolated, throwaway Postgres schema (Neon or local alike): canonical seed →
   fingerprint → corruption → verifier fails → transactional repair from
   evidence → verifier passes → fingerprint proves unrelated rows, stable
   identifiers, and audit history are unchanged → second repair run is a
   no-op. Tests create and drop their own schema; nothing outside it is
   touched.

## Security notes

- `DATABASE_URL` is server-side only; there is no `VITE_DATABASE_URL` anywhere.
- The API exposes read-only catalog endpoints; no credentials cross the wire.
- `.env` is git-ignored (`.env.example` documents the shape).
- Historical note: an earlier `.env` containing Supabase keys was committed to
  git. If this repository is pushed anywhere public, rotate those keys.

## Lint / typecheck / build

```sh
npm run lint
npm run typecheck
npm run build
```
