import { beforeEach, describe, expect, it } from "vitest";
import { useWishlist } from "@/hooks/useWishlist";
import type { Product } from "@/data/products";

const product = (id: string): Product => ({
  id,
  name: id,
  slug: id,
  collection: "seating",
  price: 120,
  description: "",
  longDescription: "",
  materials: "",
  images: [],
  stock: 3,
  rating: 5,
  reviewCount: 0,
});

describe("wishlist", () => {
  beforeEach(() => {
    useWishlist.setState({ items: [] });
  });

  it("adds a product once, never duplicating it", () => {
    useWishlist.getState().addItem(product("chair"));
    useWishlist.getState().addItem(product("chair"));
    expect(useWishlist.getState().items).toHaveLength(1);
  });

  it("reports membership", () => {
    useWishlist.getState().addItem(product("chair"));
    expect(useWishlist.getState().isInWishlist("chair")).toBe(true);
    expect(useWishlist.getState().isInWishlist("bench")).toBe(false);
  });

  it("removes a single product and clears everything", () => {
    useWishlist.getState().addItem(product("chair"));
    useWishlist.getState().addItem(product("bench"));
    useWishlist.getState().removeItem("chair");
    expect(useWishlist.getState().items.map((i) => i.id)).toEqual(["bench"]);
    useWishlist.getState().clearWishlist();
    expect(useWishlist.getState().items).toEqual([]);
  });
});
