-- Repair artifacts for the failed-import scenario (imp-2026-090).
-- The live repair (db/repair.ts) runs this logic inside ONE transaction and
-- is idempotent: re-running matches zero rows. SQL form for review.
--
-- Principles:
--   * collection/price restore from catalog_import_items.old_* (import evidence)
--   * stock is ALWAYS re-derived from the append-only inventory ledger
--     (the ledger, not the import file, is authoritative for stock)
--   * the corrupt values must still be present (new_* match) or nothing is
--     touched — a repair never clobbers legitimate later edits

BEGIN;

-- 1. Restore collection/price from import evidence, only where drifted.
UPDATE products p SET
  collection_id = i.old_collection_id,
  price = i.old_price
FROM catalog_import_items i
JOIN catalog_imports imp ON imp.id = i.import_id
WHERE imp.status = 'failed'
  AND i.applied = true
  AND i.product_id = p.id
  AND p.collection_id = i.new_collection_id
  AND p.price = i.new_price
  AND (p.collection_id IS DISTINCT FROM i.old_collection_id
       OR p.price IS DISTINCT FROM i.old_price);

-- 2. Re-derive stock from the ledger (heals the +12 bypass writes).
UPDATE products p SET stock = s.ledger_sum
FROM (
  SELECT l.product_id, SUM(l.delta) AS ledger_sum
  FROM inventory_ledger l GROUP BY l.product_id
) s
WHERE s.product_id = p.id AND p.stock <> s.ledger_sum;

-- 3. Close out the failed import (idempotent audit).
UPDATE catalog_imports SET status = 'rolled_back',
  note = note || ' | rolled back by verified repair'
WHERE status = 'failed';

INSERT INTO catalog_repair_log (import_id, repaired_by, products_repaired, note)
SELECT 'imp-2026-090', 'verified-repair', 18,
       'restored old_* from catalog_import_items; stock re-derived from ledger'
ON CONFLICT (import_id) DO NOTHING;

COMMIT;
