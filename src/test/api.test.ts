import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCollections, fetchProducts } from "@/lib/api";

const mockFetch = (body: unknown, ok = true) => {
  const spy = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Server Error",
    json: async () => body,
  });
  vi.stubGlobal("fetch", spy);
  return spy;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catalog API client", () => {
  it("maps collection rows and fills in missing optional fields", async () => {
    mockFetch([
      { id: "c1", name: "Seating", slug: "seating", description: null, image: "a.jpg", heroImage: null },
    ]);
    const [collection] = await fetchCollections();
    expect(collection).toEqual({
      id: "c1",
      name: "Seating",
      slug: "seating",
      description: "",
      image: "a.jpg",
      heroImage: undefined,
    });
  });

  it("coerces numeric strings and null columns on products", async () => {
    mockFetch([
      {
        id: "p1",
        name: "Chair",
        slug: "chair",
        collection: "c1",
        price: "249.50",
        description: null,
        longDescription: null,
        materials: null,
        dimensions: null,
        images: null,
        stock: null,
        rating: "4.5",
        reviewCount: null,
        featured: null,
        new: null,
      },
    ]);
    const [product] = await fetchProducts();
    expect(product.price).toBe(249.5);
    expect(product.rating).toBe(4.5);
    expect(product.images).toEqual([]);
    expect(product.stock).toBe(0);
    expect(product.reviewCount).toBe(0);
    expect(product.featured).toBe(false);
    expect(product.new).toBe(false);
    expect(product.dimensions).toBeUndefined();
  });

  it("throws a descriptive error when the API fails", async () => {
    mockFetch([], false);
    await expect(fetchProducts()).rejects.toThrow(/\/api\/products failed: 500/);
  });
});
