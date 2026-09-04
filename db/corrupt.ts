// The intentionally corrupted scenario.
//
// Narrative: a night-shift operator ran the "autumn refresh" catalog import
// (imp-2026-090, autumn-refresh.csv) against production. The importer crashed
// (worker OOM) after partially applying 18 of its 240 rows. The catalog is now
// wrong in three ways, each recoverable from the evidence tables:
//
//   1. WRONG COLLECTION (8 products) — the file's collection column was
//      offset by one during export, so rows landed in a sibling collection.
//   2. STOCK MISMATCH (6 products) — the importer wrote stock directly,
//      bypassing the inventory ledger, so products.stock no longer equals
//      SUM(inventory_ledger.delta).
//   3. INFLATED PRICE (4 products) — a currency-conversion bug multiplied
//      some prices by ~1.9x.
//
// Evidence written (exactly what a real crashed importer would leave behind):
//   - catalog_imports row: status 'failed', finished_at NULL, note with cause
//   - catalog_import_items rows: old_* (canonical) vs new_* (applied), applied = true
//   - catalog_snapshots rows: is_canonical = false capturing the applied values

import { CORRUPTION_TARGET_INDICES } from "./catalog-data.js";

export const FAILED_IMPORT_ID = "imp-2026-090";
export const FAILED_IMPORT_FILE = "autumn-refresh.csv";

export const CORRUPTION_PLAN = (() => {
  const indices = CORRUPTION_TARGET_INDICES;
  if (indices.length < 18) throw new Error("catalog too small for corruption plan");
  return {
    wrongCollection: indices.slice(0, 8),
    stockMismatch: indices.slice(8, 14),
    inflatedPrice: indices.slice(14, 18),
  };
})();

export interface CorruptionApplied {
  importId: string;
  wrongCollection: string[];
  stockMismatch: string[];
  inflatedPrice: string[];
}

export interface DriftRow {
  productId: string;
  kind: "collection" | "stock" | "price";
  oldCollection: string;
  newCollection: string;
  oldPrice: number;
  newPrice: number;
  oldStock: number;
  newStock: number;
}

export interface SqlLike {
  unsafe: (query: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

// Computes the 18 drift rows deterministically from the seeded catalog.
// The collection offset mirrors a real importer bug: rows land in the NEXT
// collection in sort order (wrapping), never in a random one.
export function computeDrift(
  products: { id: string; collectionId: string; price: number; stock: number }[],
  collectionIds: string[]
): DriftRow[] {
  const rows: DriftRow[] = [];
  const push = (index: number, kind: DriftRow["kind"]) => {
    const p = products[index];
    const colIdx = collectionIds.indexOf(p.collectionId);
    if (colIdx < 0) throw new Error(`unknown collection for ${p.id}`);
    const nextCollection = collectionIds[(colIdx + 1) % collectionIds.length];
    rows.push({
      productId: p.id,
      kind,
      oldCollection: p.collectionId,
      newCollection: kind === "collection" ? nextCollection : p.collectionId,
      oldPrice: p.price,
      newPrice: kind === "price" ? Math.round(p.price * 1.9 * 100) / 100 : p.price,
      oldStock: p.stock,
      newStock: kind === "stock" ? p.stock + 12 : p.stock,
    });
  };
  for (const i of CORRUPTION_PLAN.wrongCollection) push(i, "collection");
  for (const i of CORRUPTION_PLAN.stockMismatch) push(i, "stock");
  for (const i of CORRUPTION_PLAN.inflatedPrice) push(i, "price");
  return rows;
}

// Applies the corruption in one transaction: updates products, then writes the
// audit evidence (failed import, applied items, non-canonical snapshots).
export async function applyCorruption(
  sql: SqlLike,
  drift: DriftRow[],
  opts: { importId?: string } = {}
): Promise<CorruptionApplied> {
  const importId = opts.importId ?? FAILED_IMPORT_ID;

  await sql.unsafe("BEGIN");
  try {
    for (const d of drift) {
      await sql.unsafe(
        `UPDATE products SET collection_id = $2, price = $3, stock = $4 WHERE id = $1`,
        [d.productId, d.newCollection, d.newPrice, d.newStock]
      );
    }

    await sql.unsafe(
      `INSERT INTO catalog_imports (id, source_file, status, imported_by, started_at, products_total, products_changed, note)
       VALUES ($1, $2, 'failed', 'night-ops@staging', now() - interval '2 hours', 240, 18, $3)`,
      [importId, FAILED_IMPORT_FILE, "Worker OOM after applying 18/240 rows; process killed before commit completion"]
    );

    for (const d of drift) {
      await sql.unsafe(
        `INSERT INTO catalog_import_items (import_id, product_id, old_collection_id, new_collection_id, old_price, new_price, old_stock, new_stock, applied)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        [importId, d.productId, d.oldCollection, d.newCollection, d.oldPrice, d.newPrice, d.oldStock, d.newStock]
      );
      await sql.unsafe(
        `INSERT INTO catalog_snapshots (import_id, product_id, collection_id, price, stock, is_canonical)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [importId, d.productId, d.newCollection, d.newPrice, d.newStock]
      );
    }

    await sql.unsafe("COMMIT");
  } catch (err) {
    await sql.unsafe("ROLLBACK");
    throw err;
  }

  return {
    importId,
    wrongCollection: drift.filter((d) => d.kind === "collection").map((d) => d.productId),
    stockMismatch: drift.filter((d) => d.kind === "stock").map((d) => d.productId),
    inflatedPrice: drift.filter((d) => d.kind === "price").map((d) => d.productId),
  };
}




