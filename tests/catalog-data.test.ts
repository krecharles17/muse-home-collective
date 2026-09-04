// Pure unit tests for the deterministic catalog generator. No DB required.
import { describe, it, expect } from "vitest";
import {
  generateCatalog,
  COLLECTIONS,
  PRODUCTS_PER_COLLECTION,
} from "../db/catalog-data";
import { computeDrift, CORRUPTION_PLAN } from "../db/corrupt";

describe("catalog generator", () => {
  const catalog = generateCatalog();

  it("is deterministic for a fixed seed", () => {
    const a = generateCatalog();
    const b = generateCatalog();
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("produces 12 collections and 25 coherent products per collection", () => {
    expect(catalog.collections).toHaveLength(12);
    expect(catalog.products).toHaveLength(12 * PRODUCTS_PER_COLLECTION);
    for (const col of catalog.collections) {
      const products = catalog.products.filter((p) => p.collectionId === col.id);
      expect(products).toHaveLength(PRODUCTS_PER_COLLECTION);
    }
  });

  it("uses unique product ids and globally unique slugs", () => {
    const ids = catalog.products.map((p) => p.id);
    const slugs = catalog.products.map((p) => p.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps every product referencing an existing collection", () => {
    const collectionIds = new Set(catalog.collections.map((c) => c.id));
    for (const p of catalog.products) {
      expect(collectionIds.has(p.collectionId)).toBe(true);
      expect(p.price).toBeGreaterThan(0);
      expect(p.rating).toBeGreaterThanOrEqual(0);
      expect(p.rating).toBeLessThanOrEqual(5);
      expect(p.images.length).toBeGreaterThan(0);
      expect(p.stock).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps stock equal to the sum of its ledger entries", () => {
    for (const p of catalog.products) {
      const sum = p.ledger.reduce((s, e) => s + e.delta, 0);
      expect(sum).toBe(p.stock);
    }
  });

  it("has homepage-ready featured/new coverage", () => {
    expect(catalog.products.filter((p) => p.featured).length).toBeGreaterThanOrEqual(10);
    expect(catalog.products.filter((p) => p.isNew).length).toBeGreaterThan(0);
  });
});

describe("corruption plan", () => {
  const catalog = generateCatalog();

  it("targets exactly 18 disjoint products across three fault classes", () => {
    expect(CORRUPTION_PLAN.wrongCollection).toHaveLength(8);
    expect(CORRUPTION_PLAN.stockMismatch).toHaveLength(6);
    expect(CORRUPTION_PLAN.inflatedPrice).toHaveLength(4);
    const all = [
      ...CORRUPTION_PLAN.wrongCollection,
      ...CORRUPTION_PLAN.stockMismatch,
      ...CORRUPTION_PLAN.inflatedPrice,
    ];
    expect(new Set(all).size).toBe(18);
  });

  it("computes drift rows that differ from canonical values", () => {
    const drift = computeDrift(
      catalog.products.map((p) => ({
        id: p.id, collectionId: p.collectionId, price: p.price, stock: p.stock,
      })),
      catalog.collections.map((c) => c.id)
    );
    expect(drift).toHaveLength(18);
    for (const d of drift) {
      if (d.kind === "collection") expect(d.newCollection).not.toBe(d.oldCollection);
      if (d.kind === "stock") expect(d.newStock).toBe(d.oldStock + 12);
      if (d.kind === "price") expect(d.newPrice).toBeGreaterThan(d.oldPrice * 1.5);
    }
  });
});

