// @vitest-environment node
// VERIFIED REPAIR — npm run test:repair
//
// Layer 1 — SQL artifact contract (always runs; fast + deterministic):
//   the reviewable SQL artifacts in db/sql/ must stay in lockstep with the
//   TypeScript implementations they document, the schema must define every
//   evidence table the verifier/repairer rely on, and browser code must be
//   physically unable to reach the database. No database, no network.
//
// Layer 2 — full integration flow (skips without DATABASE_URL):
//   isolated schema -> canonical seed -> fingerprint -> corruption ->
//   verifier FAILS -> evidence-driven repair -> verifier passes ->
//   fingerprint proves unrelated rows + stable identifiers unchanged ->
//   idempotency (repair twice, verifier still green).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTestDatabase, fingerprintCatalog, hasDatabase } from "./helpers";
import { seedDatabase } from "../db/seed";
import { generateCatalog } from "../db/catalog-data";
import { computeDrift, applyCorruption, CORRUPTION_PLAN, FAILED_IMPORT_ID, FAILED_IMPORT_FILE } from "../db/corrupt";
import { verifyCatalog } from "../db/verify";
import { repairCatalog } from "../db/repair";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const sqlArtifact = (name: string) => readFileSync(path.join(ROOT, "db", "sql", name), "utf8");
const tsSource = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// Normalize SQL for fragment comparison: drop comments and collapse whitespace.
const normalizeSql = (text: string) =>
  text
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Whitespace-only normalization for TypeScript sources (keeps `--` intact —
// e.g. SQL operators inside template literals must survive).
const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

// BEGIN/COMMIT (or the comment-only artifacts) must stay balanced.
const txBalanced = (text: string) => {
  const begins = (text.match(/\bBEGIN\b/g) ?? []).length;
  const commits = (text.match(/\bCOMMIT\b/g) ?? []).length;
  const rollbacks = (text.match(/\bROLLBACK\b/g) ?? []).length;
  return begins === commits && rollbacks === 0;
};

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

describe("verified repair: SQL artifact contract (no database required)", () => {
  const corruptionSql = sqlArtifact("corruption.sql");
  const repairSql = sqlArtifact("repair.sql");
  const verifySql = sqlArtifact("verify.sql");
  const schemaSql = readFileSync(path.join(ROOT, "db", "schema.sql"), "utf8");

  const repairTs = tsSource("db/repair.ts");
  const verifyTs = tsSource("db/verify.ts");
  const corruptTs = tsSource("db/corrupt.ts");

  it("scenario constants agree between code and artifacts", () => {
    expect(FAILED_IMPORT_ID).toBe("imp-2026-090");
    expect(FAILED_IMPORT_FILE).toBe("autumn-refresh.csv");
    expect(corruptionSql).toContain(FAILED_IMPORT_ID);
    expect(corruptionSql).toContain(FAILED_IMPORT_FILE);
    // Fault-class magnitudes are the same in code and in the artifact story.
    expect(corruptionSql).toContain("18/240");
    expect(corruptTs).toContain("18/240");
    expect(corruptionSql).toContain("stock + 12");
    expect(corruptTs).toContain("p.stock + 12");
    expect(corruptionSql).toContain("price * 1.9");
    expect(corruptTs).toContain("p.price * 1.9");
  });

  it("corruption plan targets 18 disjoint products in three fault classes", () => {
    const all = [
      ...CORRUPTION_PLAN.wrongCollection,
      ...CORRUPTION_PLAN.stockMismatch,
      ...CORRUPTION_PLAN.inflatedPrice,
    ];
    expect(CORRUPTION_PLAN.wrongCollection).toHaveLength(8);
    expect(CORRUPTION_PLAN.stockMismatch).toHaveLength(6);
    expect(CORRUPTION_PLAN.inflatedPrice).toHaveLength(4);
    expect(new Set(all).size).toBe(18);
  });

  it("corruption writes exactly the evidence a crashed importer leaves", () => {
    const c = normalizeSql(corruptionSql);
    expect(c).toContain("INSERT INTO catalog_imports");
    expect(c).toContain("'failed'");
    expect(corruptTs).toContain("INSERT INTO catalog_import_items");
    expect(corruptTs).toContain("applied)");
    expect(corruptTs).toContain("INSERT INTO catalog_snapshots");
    // applied = true items + non-canonical (is_canonical = false) snapshots.
    expect(corruptTs).toContain(", true)");
    expect(corruptTs).toContain(", false)");
    expect(c).toContain("ON CONFLICT (id) DO NOTHING");
  });

  it("repair SQL and TypeScript are in lockstep (evidence-driven, ledger-authoritative)", () => {
    const fragments = [
      "UPDATE products p SET collection_id = i.old_collection_id, price = i.old_price",
      "WHERE imp.status = 'failed' AND i.applied = true",
      "p.collection_id = i.new_collection_id AND p.price = i.new_price",
      "IS DISTINCT FROM i.old_collection_id OR p.price IS DISTINCT FROM i.old_price",
      "UPDATE products p SET stock = s.ledger_sum",
      "FROM inventory_ledger l GROUP BY l.product_id",
      "p.stock <> s.ledger_sum",
      "UPDATE catalog_imports SET status = 'rolled_back'",
      "INSERT INTO catalog_repair_log (import_id, repaired_by, products_repaired, note)",
      "ON CONFLICT (import_id) DO NOTHING",
    ];
    const r = normalizeSql(repairSql);
    const t = collapse(repairTs);
    for (const f of fragments) {
      expect(r).toContain(f);
      expect(t).toContain(f);
    }
    // The repair restores old_* values; it must never reference hard-coded
    // product identities — the evidence tables drive everything.
    expect(r).not.toMatch(/nordic-ash-|reclaimed-oak-/);
  });

  it("verifier rules cover the same checks in SQL and TypeScript", () => {
    const rules = ["failed_import_rollback", "ledger_consistency", "snapshot_coherence", "referential_sanity"];
    for (const rule of rules) {
      expect(verifyTs).toContain(rule);
      expect(verifySql).toContain(rule);
    }
    const fragments = [
      "imp.status = 'failed' AND i.applied = true",
      "HAVING p.stock <> COALESCE(SUM(l.delta), 0)",
      "s.collection_id <> i.new_collection_id OR s.price <> i.new_price OR s.stock <> i.new_stock",
      "WHERE c.id IS NULL OR p.price <= 0",
    ];
    const v = normalizeSql(verifySql);
    const t = collapse(verifyTs);
    for (const f of fragments) {
      expect(v).toContain(f);
      expect(t).toContain(f);
    }
  });

  it("repair reports the contract the integration test asserts", () => {
    const iface = repairTs.match(/export interface RepairResult \{([\s\S]*?)\}/)?.[1] ?? "";
    for (const key of ["importIdsRepaired", "productsRestored", "stockReDerived", "repairLogInserted", "ranAt"]) {
      expect(iface).toContain(key);
    }
  });

  it("schema defines every table the scenario depends on", () => {
    for (const table of [
      "collections",
      "products",
      "inventory_ledger",
      "catalog_imports",
      "catalog_import_items",
      "catalog_snapshots",
      "catalog_repair_log",
    ]) {
      expect(schemaSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    // Import lifecycle statuses the verifier and repairer key on.
    expect(schemaSql).toContain("'failed'");
    expect(schemaSql).toContain("'rolled_back'");
    // Ledger kinds the seeder writes.
    for (const kind of ["initial", "restock", "sale", "adjustment"]) {
      expect(schemaSql).toContain(`'${kind}'`);
    }
  });

  it("artifacts are transactionally scoped", () => {
    expect(txBalanced(corruptionSql)).toBe(true);
    expect(txBalanced(repairSql)).toBe(true);
  });

  it("keeps the database out of the browser bundle (isolation contract)", () => {
    const srcFiles = listFiles(path.join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f));
    for (const file of srcFiles) {
      const text = readFileSync(file, "utf8");
      expect(text, `${path.relative(ROOT, file)} must not reference Supabase`).not.toMatch(/supabase/i);
      expect(text, `${path.relative(ROOT, file)} must not read DATABASE_URL`).not.toContain("DATABASE_URL");
    }
    // Built by concatenation so this test file does not trip over itself.
    const envAccess = ["import.meta", ".env"].join("");
    for (const dir of ["db", "server", "tests"]) {
      for (const file of listFiles(path.join(ROOT, dir)).filter((f) => f.endsWith(".ts"))) {
        const text = readFileSync(file, "utf8");
        expect(text, `${path.relative(ROOT, file)} must not access browser env`).not.toContain(envAccess);
      }
    }
  });
});

describe.skipIf(!hasDatabase)("verified repair: failed catalog import (integration)", () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let beforeCorruption: Awaited<ReturnType<typeof fingerprintCatalog>>;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedDatabase(db.sql);
    beforeCorruption = await fingerprintCatalog(db.sql);
  }, 60_000);

  afterAll(async () => {
    await db.cleanup();
  }, 30_000);

  it("verifies clean on canonical state, then fails after corruption", async () => {
    // Baseline: the verifier must pass on the pristine seed...
    const clean = await verifyCatalog(db.sql);
    expect(clean.ok).toBe(true);

    // Apply the deterministic corruption (18 products, three fault classes).
    const catalog = generateCatalog();
    const products = await db.sql.unsafe(
      `SELECT id, collection_id, price, stock FROM products ORDER BY created_at, id`
    );
    const drift = computeDrift(
      products.map((r) => ({
        id: r.id, collectionId: r.collection_id, price: Number(r.price), stock: r.stock,
      })),
      catalog.collections.map((c) => c.id)
    );
    const applied = await applyCorruption(db.sql, drift);
    expect(applied.wrongCollection).toHaveLength(8);
    expect(applied.stockMismatch).toHaveLength(6);
    expect(applied.inflatedPrice).toHaveLength(4);

    // ...and the verifier must now FAIL, naming every broken row.
    const report = await verifyCatalog(db.sql);
    expect(report.ok).toBe(false);
    expect(report.violations.length).toBeGreaterThanOrEqual(18);

    const byRule = report.summary;
    expect(byRule["failed_import_rollback"]).toBeGreaterThanOrEqual(18);
    expect(byRule["ledger_consistency"]).toBe(6);
    // Evidence tables must identify the exact fault classes.
    const rollbackProducts = report.violations
      .filter((v) => v.rule === "failed_import_rollback")
      .map((v) => v.productId);
    for (const id of applied.wrongCollection) expect(rollbackProducts).toContain(id);
    for (const id of applied.stockMismatch) expect(rollbackProducts).toContain(id);
    for (const id of applied.inflatedPrice) expect(rollbackProducts).toContain(id);
  }, 120_000);

  it("repairs transactionally from evidence and passes verification", async () => {
    const result = await repairCatalog(db.sql, { operator: "vitest" });
    expect(result.productsRestored).toBe(12);
    expect(result.stockReDerived).toBe(6);
    expect(result.importIdsRepaired).toEqual(["imp-2026-090"]);
    expect(result.repairLogInserted).toBe(true);

    const report = await verifyCatalog(db.sql);
    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
  }, 120_000);

  it("leaves unrelated rows, stable identifiers, and audit history unchanged", async () => {
    const after = await fingerprintCatalog(db.sql);

    // Stable identifiers survived end to end.
    expect(after.productIds).toEqual(beforeCorruption.productIds);
    expect(after.productSlugs).toEqual(beforeCorruption.productSlugs);
    expect(after.productCount).toBe(beforeCorruption.productCount);
    expect(after.collections).toBe(beforeCorruption.collections);

    // Row-level fingerprint: the repair restored EXACTLY the canonical values,
    // so the full user-visible state must equal the pre-corruption fingerprint.
    expect(after.products).toBe(beforeCorruption.products);
    expect(after.ledger).toBe(beforeCorruption.ledger);

    // Audit history is preserved (not wiped) and now records the repair.
    const audit = await db.sql.unsafe(`
      SELECT
        (SELECT COUNT(*) FROM catalog_import_items) AS items,
        (SELECT COUNT(*) FROM catalog_repair_log) AS repairs,
        (SELECT status FROM catalog_imports WHERE id = 'imp-2026-090') AS failed_import_status
    `);
    expect(Number(audit[0].items)).toBe(18);
    expect(Number(audit[0].repairs)).toBe(1);
    expect(audit[0].failed_import_status).toBe("rolled_back");
  }, 60_000);

  it("is idempotent: repairing again changes nothing and stays green", async () => {
    const before = await fingerprintCatalog(db.sql);
    const second = await repairCatalog(db.sql, { operator: "vitest-rerun" });
    expect(second.productsRestored).toBe(0);
    expect(second.repairLogInserted).toBe(false);

    const after = await fingerprintCatalog(db.sql);
    expect(after.products).toBe(before.products);
    expect(after.ledger).toBe(before.ledger);

    const report = await verifyCatalog(db.sql);
    expect(report.ok).toBe(true);
  }, 60_000);
});