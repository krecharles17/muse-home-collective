import { describe, expect, it } from "vitest";
import {
  getCollectionBySlug,
  getFeaturedProducts,
  getNewProducts,
  getProductBySlug,
  getProductsByCollection,
  getRelatedProducts,
  filterAndSortProducts,
  type Collection,
  type Product,
} from "@/data/products";

const collections: Collection[] = [
  { id: "seating", name: "Seating", slug: "seating", description: "", image: "" },
  { id: "tables", name: "Tables", slug: "tables", description: "", image: "" },
];

const product = (id: string, overrides: Partial<Product> = {}): Product => ({
  id,
  name: id,
  slug: id,
  collection: "seating",
  price: 100,
  description: "",
  longDescription: "",
  materials: "",
  images: [],
  stock: 5,
  rating: 5,
  reviewCount: 0,
  ...overrides,
});

const products = [
  product("chair", { name: "Chair", price: 200, featured: true }),
  product("bench", { name: "Bench", price: 100, new: true }),
  product("stool", { name: "Stool", price: 50 }),
  product("table", { name: "Table", collection: "tables", price: 300, featured: true, new: true }),
];

describe("catalog lookup helpers", () => {
  it("finds products and collections by slug, and undefined when missing", () => {
    expect(getProductBySlug(products, "bench")?.id).toBe("bench");
    expect(getProductBySlug(products, "nope")).toBeUndefined();
    expect(getCollectionBySlug(collections, "tables")?.id).toBe("tables");
    expect(getCollectionBySlug(collections, "nope")).toBeUndefined();
  });

  it("groups products by collection id", () => {
    expect(getProductsByCollection(products, "seating").map((p) => p.id)).toEqual([
      "chair",
      "bench",
      "stool",
    ]);
    expect(getProductsByCollection(products, "unknown")).toEqual([]);
  });

  it("selects featured and new products", () => {
    expect(getFeaturedProducts(products).map((p) => p.id)).toEqual(["chair", "table"]);
    expect(getNewProducts(products).map((p) => p.id)).toEqual(["bench", "table"]);
  });
});

describe("related products", () => {
  it("returns same-collection products excluding the product itself", () => {
    expect(getRelatedProducts(products, "chair").map((p) => p.id)).toEqual(["bench", "stool"]);
  });

  it("respects the limit", () => {
    expect(getRelatedProducts(products, "chair", 1).map((p) => p.id)).toEqual(["bench"]);
  });

  it("returns nothing for an unknown product", () => {
    expect(getRelatedProducts(products, "ghost")).toEqual([]);
  });
});

describe("sorting", () => {
  it("sorts by price ascending and descending", () => {
    expect(filterAndSortProducts(products, collections, "all", "price-asc").map((p) => p.price)).toEqual([
      50, 100, 200, 300,
    ]);
    expect(filterAndSortProducts(products, collections, "all", "price-desc").map((p) => p.price)).toEqual([
      300, 200, 100, 50,
    ]);
  });

  it("sorts alphabetically by name", () => {
    expect(filterAndSortProducts(products, collections, "all", "name-asc").map((p) => p.name)).toEqual([
      "Bench",
      "Chair",
      "Stool",
      "Table",
    ]);
  });

  it("keeps every product when filtering by a known collection", () => {
    const result = filterAndSortProducts(products, collections, "tables", "featured");
    expect(result.map((p) => p.id)).toEqual(["table"]);
  });
});
