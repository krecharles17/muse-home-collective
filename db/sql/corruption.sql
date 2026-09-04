-- Corruption artifacts for the failed-import scenario (imp-2026-090).
-- The TypeScript corruption in db/corrupt.ts applies exactly this logic;
-- this file documents the SQL shape for review and manual reproduction.
--
-- Story: autumn-refresh.csv claimed 240 rows; the importer crashed (OOM)
-- after applying 18. Three fault classes, deterministically chosen by
-- db/corrupt.ts (CORRUPTION_PLAN): 8 wrong collections, 6 ledger-bypassing
-- stock writes (+12), 4 prices inflated ~1.9x.

BEGIN;

-- 1. Products drift from canonical state (NO ledger entry for stock: that is
--    the point — stock drift must be detectable against the ledger).
-- UPDATE products SET
--   collection_id = <next collection in sort order>,  -- fault class 1 (8 rows)
--   stock = stock + 12,                               -- fault class 2 (6 rows)
--   price = ROUND(price * 1.9, 2)                     -- fault class 2 (4 rows)
-- WHERE id = <one of 18 deterministic targets>;

-- 2. Evidence: the import attempt itself.
INSERT INTO catalog_imports (id, source_file, status, imported_by, started_at, products_total, products_changed, note)
VALUES ('imp-2026-090', 'autumn-refresh.csv', 'failed', 'night-ops@staging', now() - interval '2 hours', 240, 18,
        'Worker OOM after applying 18/240 rows; process killed before commit completion')
ON CONFLICT (id) DO NOTHING;

-- 3. Evidence: per-row audit — old_* is canonical, new_* is what was applied.
-- INSERT INTO catalog_import_items (import_id, product_id, old_collection_id, new_collection_id,
--                                   old_price, new_price, old_stock, new_stock, applied)
-- VALUES ('imp-2026-090', <product>, <canonical collection>, <corrupt collection>,
--         <canonical price>, <corrupt price>, <canonical stock>, <corrupt stock>, true);  -- 18 rows

-- 4. Evidence: non-canonical snapshot capturing what the import actually wrote.
-- INSERT INTO catalog_snapshots (import_id, product_id, collection_id, price, stock, is_canonical)
-- VALUES ('imp-2026-090', <product>, <corrupt collection>, <corrupt price>, <corrupt stock>, false);  -- 18 rows

COMMIT;
