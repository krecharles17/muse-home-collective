// Shared helpers for DB-backed tests.
// Isolation strategy: every test run creates a fresh Postgres SCHEMA with a
// unique name, applies db/schema.sql there, and drops it afterwards — so tests
// never touch tables outside their own sandbox, and can run against a shared
// Neon instance or a local Postgres alike. Skips cleanly without DATABASE_URL.
import postgres from "postgres";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DB_DIR = path.dirname(fileURLToPath(import.meta.url));

export const DATABASE_URL = process.env.DATABASE_URL ?? "";
export const hasDatabase = DATABASE_URL.length > 0;

export interface TestDatabase {
  sql: postgres.Sql;
  schemaName: string;
  cleanup: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
  const schemaName = `muse_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const admin = postgres(DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
  } finally {
    await admin.end({ timeout: 1 });
  }

  const sql = postgres(DATABASE_URL, {
    prepare: false,
    max: 1,
    onnotice: () => {},
    connection: { search_path: schemaName },
  });

  const schemaPath = path.join(DB_DIR, "..", "db", "schema.sql");
  await sql.unsafe(readFileSync(schemaPath, "utf8"));

  return {
    sql,
    schemaName,
    cleanup: async () => {
      await sql.end({ timeout: 1 });
      const drop = postgres(DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
      try {
        await drop.unsafe(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      } finally {
        await drop.end({ timeout: 1 });
      }
    },
  };
}

// Canonical fingerprint of user-visible state. Rows are hashed field-by-field
// so any mutation of unrelated rows is caught, not just row counts.
export interface CatalogFingerprint {
  collections: string;
  products: string;
  ledger: string;
  productIds: string[];
  productSlugs: string[];
  productCount: number;
}

function hashRows(rows: unknown[]): string {
  // FNV-1a over a stable JSON serialization — deterministic across runs.
  let h = 0x811c9dc5;
  const text = JSON.stringify(rows);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + ":" + text.length;
}

export async function fingerprintCatalog(sql: postgres.Sql): Promise<CatalogFingerprint> {
  const collections = await sql.unsafe(
    `SELECT * FROM collections ORDER BY id`
  );
  const products = await sql.unsafe(
    `SELECT id, slug, name, collection_id, price, stock, rating, review_count, featured, is_new, created_at, images, materials, dimensions, description, long_description FROM products ORDER BY id`
  );
  const ledger = await sql.unsafe(
    `SELECT product_id, delta, kind, reference FROM inventory_ledger ORDER BY id`
  );
  return {
    collections: hashRows(collections),
    products: hashRows(products),
    ledger: hashRows(ledger),
    productIds: products.map((r) => r.id),
    productSlugs: products.map((r) => r.slug),
    productCount: products.length,
  };
}
