-- Muse Home Collective — Neon PostgreSQL schema (furniture commerce catalog + repair evidence)
-- Idempotent: safe to run repeatedly (npm run db:schema).

CREATE TABLE IF NOT EXISTS collections (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  image       TEXT NOT NULL DEFAULT '',
  hero_image  TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  collection_id   TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  price           NUMERIC(10,2) NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  materials       TEXT NOT NULL DEFAULT '',
  dimensions      TEXT,
  images          TEXT[] NOT NULL DEFAULT '{}',
  stock           INTEGER NOT NULL DEFAULT 0,
  rating          NUMERIC(2,1) NOT NULL DEFAULT 0,
  review_count    INTEGER NOT NULL DEFAULT 0,
  featured        BOOLEAN NOT NULL DEFAULT false,
  is_new          BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_is_new ON products(is_new);

-- Authoritative stock movement ledger. The catalog invariant is:
--   products.stock = SUM(inventory_ledger.delta) for that product (all kinds).
-- Every stock change MUST go through the ledger; a stock value that has no
-- matching ledger history is evidence of a direct, unaudited write.
CREATE TABLE IF NOT EXISTS inventory_ledger (
  id         BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('initial', 'restock', 'sale', 'adjustment')),
  reference  TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_product ON inventory_ledger(product_id);

-- Catalog import audit. One row per import attempt; 'failed' imports may have
-- partially applied rows (catalog_import_items.applied = true).
CREATE TABLE IF NOT EXISTS catalog_imports (
  id               TEXT PRIMARY KEY,
  source_file      TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'rolled_back')),
  imported_by      TEXT NOT NULL DEFAULT '',
  started_at       TIMESTAMPTZ NOT NULL,
  finished_at      TIMESTAMPTZ,
  products_total   INTEGER NOT NULL DEFAULT 0,
  products_changed INTEGER NOT NULL DEFAULT 0,
  note             TEXT NOT NULL DEFAULT ''
);

-- Per-row audit of an import: what the importer intended (new_*) and what the
-- catalog looked like before it ran (old_*). Rows with applied = true were
-- written to products before the import aborted.
CREATE TABLE IF NOT EXISTS catalog_import_items (
  id                BIGSERIAL PRIMARY KEY,
  import_id         TEXT NOT NULL REFERENCES catalog_imports(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_collection_id TEXT NOT NULL,
  new_collection_id TEXT NOT NULL,
  old_price         NUMERIC(10,2) NOT NULL,
  new_price         NUMERIC(10,2) NOT NULL,
  old_stock         INTEGER NOT NULL,
  new_stock         INTEGER NOT NULL,
  applied           BOOLEAN NOT NULL DEFAULT false,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_import_items_import ON catalog_import_items(import_id);

-- Point-in-time catalog state. is_canonical = true rows are trusted baseline
-- values taken at import time; is_canonical = false rows capture what a
-- (possibly corrupt) import actually wrote, for diffing and forensics.
CREATE TABLE IF NOT EXISTS catalog_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  import_id     TEXT NOT NULL REFERENCES catalog_imports(id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL,
  price         NUMERIC(10,2) NOT NULL,
  stock         INTEGER NOT NULL,
  is_canonical  BOOLEAN NOT NULL DEFAULT true,
  taken_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_product ON catalog_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_canonical ON catalog_snapshots(is_canonical);

-- Audit trail of applied repairs. One row per import (idempotency key).
CREATE TABLE IF NOT EXISTS catalog_repair_log (
  id                BIGSERIAL PRIMARY KEY,
  import_id         TEXT NOT NULL UNIQUE REFERENCES catalog_imports(id) ON DELETE CASCADE,
  repaired_by       TEXT NOT NULL,
  repaired_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  products_repaired INTEGER NOT NULL DEFAULT 0,
  note              TEXT NOT NULL DEFAULT ''
);
