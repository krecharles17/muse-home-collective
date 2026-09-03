// Evidence-driven repair for the failed-import scenario.
//
// One transaction, idempotent by construction:
//   1. Every product touched by a failed import is restored to the old_*
//      (pre-import) values recorded in catalog_import_items — but ONLY where
//      current values still match what the import wrote (new_*), so a repair
//      run never clobbers legitimate later edits.
//   2. Stock is re-derived from the append-only inventory ledger, which heals
//      any ledger/stock drift (including the importer's direct stock writes).
//   3. The failed import is marked rolled_back and a catalog_repair_log row is
//      written ON CONFLICT DO NOTHING, so running repair twice is a no-op.

export interface RepairResult {
  importIdsRepaired: string[];
  productsRestored: number;
  stockReDerived: number;
  repairLogInserted: boolean;
  ranAt: string;
}

import type { SqlLike } from "./corrupt.js";

export async function repairCatalog(
  sql: SqlLike,
  opts: { operator?: string } = {}
): Promise<RepairResult> {
  const operator = opts.operator ?? "verified-repair-test";
  await sql.unsafe("BEGIN");
  try {
    // 1. Restore pre-import collection/price where the corrupt values are
    //    still present (idempotence guard: never clobbers later legit edits).
    const restored = await sql.unsafe(`
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
             OR p.price IS DISTINCT FROM i.old_price)
      RETURNING p.id
    `);

    // 2. Re-derive stock from the ledger for anything still drifted.
    const resummed = await sql.unsafe(`
      UPDATE products p SET stock = s.ledger_sum
      FROM (
        SELECT l.product_id, SUM(l.delta) AS ledger_sum
        FROM inventory_ledger l GROUP BY l.product_id
      ) s
      WHERE s.product_id = p.id AND p.stock <> s.ledger_sum
      RETURNING p.id
    `);

    // 3. Mark failed imports rolled back + write the idempotent audit row.
    const failed = await sql.unsafe(`
      UPDATE catalog_imports SET status = 'rolled_back',
        note = note || ' | rolled back by verified repair'
      WHERE status = 'failed' RETURNING id
    `);
    let repairLogInserted = false;
    for (const row of failed) {
      const inserted = await sql.unsafe(`
        INSERT INTO catalog_repair_log (import_id, repaired_by, products_repaired, note)
        VALUES ($1, $2, $3, 'restored old_* from catalog_import_items; stock re-derived from ledger')
        ON CONFLICT (import_id) DO NOTHING RETURNING id
      `, [row.id, operator, restored.length]);
      if (inserted.length > 0) repairLogInserted = true;
    }

    await sql.unsafe("COMMIT");
    return {
      importIdsRepaired: failed.map((r) => String(r.id)),
      productsRestored: restored.length,
      stockReDerived: resummed.length,
      repairLogInserted,
      ranAt: new Date().toISOString(),
    };
  } catch (err) {
    await sql.unsafe("ROLLBACK");
    throw err;
  }
}

