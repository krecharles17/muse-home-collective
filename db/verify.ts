// Catalog verifier. Reads ONLY evidence tables + current catalog state and
// reports every violation it can prove. No guessing: every rule is either
// checkable from data or it is not reported.

export interface Violation {
  rule: string;
  productId: string;
  detail: string;
}

export interface VerifyReport {
  ok: boolean;
  checkedAt: string;
  violations: Violation[];
  summary: Record<string, number>;
}

import type { SqlLike } from "./corrupt.js";

// Rule 1 — failed-import rollback: every row a failed import applied must have
// been restored to its old_* (pre-import) values.
async function ruleFailedImportRollback(sql: SqlLike): Promise<Violation[]> {
  const rows = await sql.unsafe(`
    SELECT i.product_id, i.old_collection_id, i.new_collection_id,
           i.old_price, i.new_price, i.old_stock, i.new_stock
    FROM catalog_import_items i
    JOIN catalog_imports imp ON imp.id = i.import_id
    WHERE imp.status = 'failed' AND i.applied = true
  `);
  const out: Violation[] = [];
  for (const r of rows) {
    const prod = (await sql.unsafe(
      `SELECT collection_id, price, stock FROM products WHERE id = $1`,
      [r.product_id]
    ))[0];
    if (!prod) continue;
    if (prod.collection_id !== r.old_collection_id) {
      out.push({ rule: "failed_import_rollback", productId: r.product_id,
        detail: `collection_id=${prod.collection_id}, evidence says ${r.old_collection_id} (import wrote ${r.new_collection_id})` });
    }
    if (Number(prod.price) !== Number(r.old_price)) {
      out.push({ rule: "failed_import_rollback", productId: r.product_id,
        detail: `price=${prod.price}, evidence says ${r.old_price} (import wrote ${r.new_price})` });
    }
    if (prod.stock !== r.old_stock) {
      out.push({ rule: "failed_import_rollback", productId: r.product_id,
        detail: `stock=${prod.stock}, evidence says ${r.old_stock} (import wrote ${r.new_stock})` });
    }
  }
  return out;
}

// Rule 2 — ledger consistency: products.stock must equal the sum of its
// ledger deltas. The ledger is append-only and authoritative.
async function ruleLedgerConsistency(sql: SqlLike): Promise<Violation[]> {
  const rows = await sql.unsafe(`
    SELECT p.id, p.stock, COALESCE(SUM(l.delta), 0) AS ledger_sum
    FROM products p LEFT JOIN inventory_ledger l ON l.product_id = p.id
    GROUP BY p.id, p.stock HAVING p.stock <> COALESCE(SUM(l.delta), 0)
  `);
  return rows.map((r) => ({
    rule: "ledger_consistency",
    productId: r.id,
    detail: `stock=${r.stock} but ledger sum=${r.ledger_sum}`,
  }));
}

// Rule 3 — evidence coherence: every non-canonical snapshot of a failed import
// must describe the same values the import actually wrote (two independent
// audit sources must agree), and every applied item must have such a snapshot.
async function ruleSnapshotCoherence(sql: SqlLike): Promise<Violation[]> {
  const mismatch = await sql.unsafe(`
    SELECT i.product_id, i.new_collection_id AS item_coll, s.collection_id AS snap_coll,
           i.new_price AS item_price, s.price AS snap_price,
           i.new_stock AS item_stock, s.stock AS snap_stock
    FROM catalog_import_items i
    JOIN catalog_imports imp ON imp.id = i.import_id
    LEFT JOIN catalog_snapshots s ON s.import_id = i.import_id AND s.product_id = i.product_id
    WHERE imp.status = 'failed' AND i.applied = true
      AND (s.id IS NULL OR s.collection_id <> i.new_collection_id
           OR s.price <> i.new_price OR s.stock <> i.new_stock)
  `);
  const out: Violation[] = mismatch.map((r) => ({
    rule: "snapshot_coherence",
    productId: r.product_id,
    detail: r.snap_coll === null
      ? "applied import item has no non-canonical snapshot"
      : `snapshot ${JSON.stringify([r.snap_coll, String(r.snap_price), String(r.snap_stock)])} != item new_* ${JSON.stringify([r.item_coll, String(r.item_price), String(r.item_stock)])}`,
  }));
  const stray = await sql.unsafe(`
    SELECT s.product_id FROM catalog_snapshots s
    LEFT JOIN catalog_import_items i ON i.import_id = s.import_id AND i.product_id = s.product_id
    WHERE s.is_canonical = false AND (i.id IS NULL OR i.applied = false)
  `);
  for (const r of stray) {
    out.push({ rule: "snapshot_coherence", productId: r.product_id,
      detail: "non-canonical snapshot without a matching applied import item" });
  }
  return out;
}

// Rule 4 — referential sanity: every product must point at an existing
// collection, and prices must be plausible (> 0).
async function ruleReferentialSanity(sql: SqlLike): Promise<Violation[]> {
  const bad = await sql.unsafe(`
    SELECT p.id, p.collection_id, p.price FROM products p
    LEFT JOIN collections c ON c.id = p.collection_id
    WHERE c.id IS NULL OR p.price <= 0
  `);
  return bad.map((r) => ({
    rule: "referential_sanity",
    productId: r.id,
    detail: r.collection_id ? `non-positive price ${r.price}` : `dangling collection_id ${r.collection_id}`,
  }));
}

export async function verifyCatalog(sql: SqlLike): Promise<VerifyReport> {
  const violations = [
    ...(await ruleFailedImportRollback(sql)),
    ...(await ruleLedgerConsistency(sql)),
    ...(await ruleSnapshotCoherence(sql)),
    ...(await ruleReferentialSanity(sql)),
  ];
  const summary: Record<string, number> = {};
  for (const v of violations) summary[v.rule] = (summary[v.rule] ?? 0) + 1;
  return {
    ok: violations.length === 0,
    checkedAt: new Date().toISOString(),
    violations,
    summary,
  };
}



