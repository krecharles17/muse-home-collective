// Deterministic seeding for the Neon/Postgres catalog.
// Idempotent: wipes and rewrites the catalog tables in one transaction, so
// re-running `npm run db:seed` always lands on the same canonical state.

import postgres from "postgres";
import { generateCatalog, CATALOG_SEED } from "./catalog-data.js";

export const SEED_MARKER = `seed-${CATALOG_SEED}`;

export interface SeedResult {
  collections: number;
  products: number;
  ledgerEntries: number;
  imports: number;
  snapshotRows: number;
}

export async function seedDatabase(sql: postgres.Sql): Promise<SeedResult> {
  const catalog = generateCatalog();

  await sql.begin(async (tx) => {
    // Seed is authoritative: clear everything first (order matters for FKs).
    await tx`TRUNCATE catalog_repair_log, catalog_snapshots, catalog_import_items, catalog_imports, inventory_ledger, products, collections RESTART IDENTITY CASCADE`;

    const collections = catalog.collections.map((c) => ({
      id: c.id, name: c.name, slug: c.slug, description: c.description, image: c.image,
      hero_image: c.heroImage, sort_order: c.sortOrder, created_at: c.createdAt,
    }));
    await tx`INSERT INTO collections ${tx(collections)}`;

    const products = catalog.products.map((p) => ({
      id: p.id, name: p.name, slug: p.slug, collection_id: p.collectionId, price: p.price,
      description: p.description, long_description: p.longDescription, materials: p.materials,
      dimensions: p.dimensions, images: p.images, stock: p.stock, rating: p.rating,
      review_count: p.reviewCount, featured: p.featured, is_new: p.isNew, created_at: p.createdAt,
    }));
    await tx`INSERT INTO products ${tx(products)}`;

    const ledger = catalog.products.flatMap((p) => p.ledger.map((entry) => ({
      product_id: p.id, delta: entry.delta, kind: entry.kind,
      reference: entry.reference, note: entry.note,
    })));
    await tx`INSERT INTO inventory_ledger ${tx(ledger)}`;

    const imports = catalog.imports.map((imp) => ({
      id: imp.id, source_file: imp.sourceFile, status: imp.status, imported_by: imp.importedBy,
      started_at: imp.startedAt, finished_at: imp.finishedAt, products_total: imp.productIds.length,
      products_changed: imp.productIds.length, note: `Baseline ${imp.sourceFile}`,
    }));
    await tx`INSERT INTO catalog_imports ${tx(imports)}`;

    const productsById = new Map(catalog.products.map((p) => [p.id, p]));
    const snapshots = catalog.imports.flatMap((imp) => imp.productIds.map((productId) => {
      const p = productsById.get(productId);
      if (!p) throw new Error(`seed: import ${imp.id} references unknown product ${productId}`);
      return {
        import_id: imp.id, product_id: p.id, collection_id: p.collectionId,
        price: p.price, stock: p.stock, is_canonical: true,
      };
    }));
    await tx`INSERT INTO catalog_snapshots ${tx(snapshots)}`;
  });

  return {
    collections: catalog.collections.length,
    products: catalog.products.length,
    ledgerEntries: catalog.products.reduce((n, p) => n + p.ledger.length, 0),
    imports: catalog.imports.length,
    snapshotRows: catalog.imports.reduce((n, i) => n + i.productIds.length, 0),
  };
}
