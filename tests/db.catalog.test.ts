// @vitest-environment node
// DB-backed catalog tests. Skips without DATABASE_URL; runs against any
// Postgres-compatible URL (Neon or local) in an isolated schema.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDatabase, hasDatabase, type TestDatabase } from "./helpers";
import { seedDatabase } from "../db/seed";
import { verifyCatalog } from "../db/verify";

describe.skipIf(!hasDatabase)("seeded catalog (database)", () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    db = await createTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await db.cleanup();
  }, 30_000);

  it("seeds 12 collections and 300 products with full evidence coverage", async () => {
    const result = await seedDatabase(db.sql);
    expect(result.collections).toBe(12);
    expect(result.products).toBe(300);
    expect(result.imports).toBe(3);
    expect(result.snapshotRows).toBe(300);

    const counts = await db.sql.unsafe(`
      SELECT
        (SELECT COUNT(*) FROM collections) AS collections,
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM inventory_ledger) AS ledger,
        (SELECT COUNT(*) FROM catalog_imports) AS imports,
        (SELECT COUNT(*) FROM catalog_snapshots) AS snapshots
    `);
    expect(Number(counts[0].collections)).toBe(12);
    expect(Number(counts[0].products)).toBe(300);
    expect(Number(counts[0].ledger)).toBe(result.ledgerEntries);
    expect(Number(counts[0].snapshots)).toBe(300);
  }, 60_000);

  it("is relationally valid: every product has a live collection", async () => {
    await seedDatabase(db.sql);
    const orphan = await db.sql.unsafe(`
      SELECT p.id FROM products p
      LEFT JOIN collections c ON c.id = p.collection_id
      WHERE c.id IS NULL
    `);
    expect(orphan).toHaveLength(0);
  }, 60_000);

  it("verifies clean on a freshly seeded catalog", async () => {
    await seedDatabase(db.sql);
    const report = await verifyCatalog(db.sql);
    expect(report.violations).toEqual([]);
    expect(report.ok).toBe(true);
  }, 60_000);
});
