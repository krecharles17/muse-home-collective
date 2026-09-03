import { describe, expect, it } from "vitest";
import { filterAndSortProducts, type Collection, type Product } from "@/data/products";

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

describe("catalog filtering and sorting", () => {
  const products = [
    product("chair", { name: "Chair", price: 200, featured: true }),
    product("bench", { name: "Bench", price: 100, new: true }),
    product("table", { name: "Table", collection: "tables", price: 300 }),
  ];

  it("filters by the collection slug and does not mutate input", () => {
    const result = filterAndSortProducts(products, collections, "seating", "price-asc");
    expect(result.map(({ id }) => id)).toEqual(["bench", "chair"]);
    expect(products.map(({ id }) => id)).toEqual(["chair", "bench", "table"]);
  });

  it("puts featured and new products first without dropping other products", () => {
    expect(filterAndSortProducts(products, collections, "all", "featured").map(({ id }) => id)).toEqual([
      "chair", "bench", "table",
    ]);
    expect(filterAndSortProducts(products, collections, "all", "newest").map(({ id }) => id)).toEqual([
      "bench", "chair", "table",
    ]);
  });

  it("returns no products for an unknown collection instead of showing the full catalog", () => {
    expect(filterAndSortProducts(products, collections, "missing", "featured")).toEqual([]);
  });
});
