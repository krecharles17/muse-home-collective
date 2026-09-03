// CLI: npm run db:schema|db:seed|db:corrupt|db:verify|db:repair
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { seedDatabase } from "./seed.js";
import { computeDrift, applyCorruption } from "./corrupt.js";
import { verifyCatalog } from "./verify.js";
import { repairCatalog } from "./repair.js";
import { generateCatalog } from "./catalog-data.js";

export function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required (server-side only — never use a VITE_ prefix).");
    process.exit(2);
  }
  return url;
}

export function connect(): postgres.Sql {
  return postgres(resolveDatabaseUrl(), {
    prepare: false, // required for Neon pooler compatibility
    max: 1,
    onnotice: () => {},
  });
}

export async function applySchema(sql: postgres.Sql): Promise<void> {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "schema.sql");
  await sql.unsafe(await readSchema(schemaPath));
}

import { readFile } from "node:fs/promises";
async function readSchema(schemaPath: string): Promise<string> {
  return readFile(schemaPath, "utf8");
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command || command === "help") {
    console.log("usage: npm run db:<schema|seed|corrupt|verify|repair>");
    return;
  }
  const sql = connect();
  try {
    switch (command) {
      case "schema": {
        await applySchema(sql);
        console.log("schema applied");
        break;
      }
      case "seed": {
        await applySchema(sql);
        const result = await seedDatabase(sql);
        console.log(`seeded: ${JSON.stringify(result)}`);
        break;
      }
      case "corrupt": {
        const catalog = generateCatalog();
        const collectionIds = catalog.collections.map((c) => c.id);
        const products = await sql.unsafe(
          `SELECT id, collection_id, price, stock FROM products ORDER BY created_at, id`
        );
        if (products.length === 0) throw new Error("catalog is empty — run db:seed first");
        const drift = computeDrift(
          products.map((r) => ({
            id: r.id, collectionId: r.collection_id, price: Number(r.price), stock: r.stock,
          })),
          collectionIds
        );
        const applied = await applyCorruption(sql, drift);
        console.log(`corruption applied: ${JSON.stringify(applied)}`);
        break;
      }
      case "verify": {
        const report = await verifyCatalog(sql);
        console.log(JSON.stringify(report, null, 2));
        process.exitCode = report.ok ? 0 : 1;
        break;
      }
      case "repair": {
        const result = await repairCatalog(sql);
        console.log(`repair result: ${JSON.stringify(result)}`);
        const report = await verifyCatalog(sql);
        console.log(`post-repair verify: ${report.ok ? "OK" : "VIOLATIONS REMAIN"}`);
        if (!report.ok) process.exitCode = 1;
        break;
      }
      default:
        console.error(`unknown command: ${command}`);
        process.exitCode = 2;
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

