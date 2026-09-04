-- Verification queries for the failed-import scenario.
-- The live verifier (db/verify.ts) runs these same checks; this file is the
-- reviewable SQL form. Every query returns zero rows on a healthy catalog.

-- Rule 1: failed_import_rollback — rows a failed import applied must match
-- the pre-import (old_*) evidence, not the corrupt new_* values.
SELECT i.product_id, i.old_collection_id, i.old_price, i.old_stock,
       p.collection_id, p.price, p.stock
FROM catalog_import_items i
JOIN catalog_imports imp ON imp.id = i.import_id
JOIN products p ON p.id = i.product_id
WHERE imp.status = 'failed' AND i.applied = true
  AND (p.collection_id <> i.old_collection_id
       OR p.price <> i.old_price
       OR p.stock <> i.old_stock);

-- Rule 2: ledger_consistency — products.stock must equal SUM(ledger.delta).
SELECT p.id, p.stock, COALESCE(SUM(l.delta), 0) AS ledger_sum
FROM products p LEFT JOIN inventory_ledger l ON l.product_id = p.id
GROUP BY p.id, p.stock
HAVING p.stock <> COALESCE(SUM(l.delta), 0);

-- Rule 3: snapshot_coherence — non-canonical snapshots must agree with the
-- import items' new_* values, and every applied item must have one.
SELECT i.product_id
FROM catalog_import_items i
JOIN catalog_imports imp ON imp.id = i.import_id
LEFT JOIN catalog_snapshots s ON s.import_id = i.import_id AND s.product_id = i.product_id
WHERE imp.status = 'failed' AND i.applied = true
  AND (s.id IS NULL OR s.collection_id <> i.new_collection_id
       OR s.price <> i.new_price OR s.stock <> i.new_stock);

-- Rule 4: referential_sanity — no dangling collections, no non-positive prices.
SELECT p.id FROM products p
LEFT JOIN collections c ON c.id = p.collection_id
WHERE c.id IS NULL OR p.price <= 0;
