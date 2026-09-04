import { describe, expect, it } from "vitest";
import {
  filterAndSortProducts,
  type Collection,
  type Product,
} from "@/data/products";

const collections: Collection[] = [
  { id: "c1", name: "Seating", slug: "seating", description: "", image: "" },
  { id: "c2", name: "Lighting", slug: "lighting", description: "", image: "" },
];

const make = (overrides: Partial<Product>): Product => ({
  id: "p0",
  name: "Item",
  slug: "item",
  collection: "c1",
  price: 100,
  description: "",
  longDescription: "",
  materials: "",
  images: [],
  stock: 5,
  rating: 4,
  reviewCount: 1,
  ...overrides,
});

const products: Product[] = [
  make({ id: "p1", name: "Beta Chair", price: 300, collection: "c1", featured: true }),
  make({ id: "p2", name: "alpha Lamp", price: 50, collection: "c2", new: true }),
  make({ id: "p3", name: "Gamma Sofa", price: 900, collection: "c1" }),
  make({ id: "p4", name: "Delta Bulb", price: 20, collection: "c2", new: true, featured: true }),
];

describe("filterAndSortProducts", () => {
  it("returns everything for the 'all' collection", () => {
    expect(filterAndSortProducts(products, collections, "all", "featured")).toHaveLength(4);
  });

  it("filters by collection slug", () => {
    const result = filterAndSortProducts(products, collections, "seating", "featured");
    expect(result.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("returns an empty list for an unknown slug instead of the whole catalog", () => {
    expect(filterAndSortProducts(products, collections, "does-not-exist", "featured")).toEqual([]);
  });

  it("returns an empty list when there are no products", () => {
    expect(filterAndSortProducts([], collections, "all", "price-asc")).toEqual([]);
  });

  it("sorts by price ascending and descending", () => {
    const asc = filterAndSortProducts(products, collections, "all", "price-asc").map((p) => p.price);
    expect(asc).toEqual([20, 50, 300, 900]);
    const desc = filterAndSortProducts(products, collections, "all", "price-desc").map((p) => p.price);
    expect(desc).toEqual([900, 300, 50, 20]);
  });

  it("sorts by name using locale-aware ordering", () => {
    const names = filterAndSortProducts(products, collections, "all", "name-asc").map((p) => p.name);
    expect(names).toHaveLength(4);
    for (let i = 1; i < names.length; i++) {
      expect(names[i - 1].localeCompare(names[i])).toBeLessThanOrEqual(0);
    }
  });

  it("puts featured products first for the featured sort", () => {
    const result = filterAndSortProducts(products, collections, "all", "featured");
    expect(result.slice(0, 2).map((p) => p.id).sort()).toEqual(["p1", "p4"]);
  });

  it("puts new products first for the newest sort", () => {
    const result = filterAndSortProducts(products, collections, "all", "newest");
    expect(result.slice(0, 2).map((p) => p.id).sort()).toEqual(["p2", "p4"]);
  });

  it("filters and sorts together", () => {
    const result = filterAndSortProducts(products, collections, "seating", "price-asc");
    expect(result.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("does not mutate the input array", () => {
    const input = [...products];
    filterAndSortProducts(input, collections, "all", "price-desc");
    expect(input.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });
});
