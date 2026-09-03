import { beforeEach, describe, expect, it } from "vitest";
import { useCart } from "@/hooks/useCart";
import type { Product } from "@/data/products";

const product = (stock: number): Product => ({
  id: "chair",
  name: "Chair",
  slug: "chair",
  collection: "seating",
  price: 125,
  description: "",
  longDescription: "",
  materials: "Oak",
  images: [],
  stock,
  rating: 5,
  reviewCount: 0,
});

describe("cart inventory invariants", () => {
  beforeEach(() => {
    useCart.setState({ items: [] });
  });

  it("never adds more units than are in stock", () => {
    useCart.getState().addItem(product(3), 2);
    useCart.getState().addItem(product(3), 4);
    expect(useCart.getState().items[0].quantity).toBe(3);
  });

  it("does not add unavailable products", () => {
    useCart.getState().addItem(product(0));
    expect(useCart.getState().items).toEqual([]);
  });

  it("removes an item when its quantity is reduced below one", () => {
    useCart.getState().addItem(product(5), 2);
    useCart.getState().updateQuantity("chair", 0);
    expect(useCart.getState().items).toEqual([]);
  });

  it("calculates subtotal and item count from the stored quantities", () => {
    useCart.getState().addItem(product(5), 2);
    expect(useCart.getState().getSubtotal()).toBe(250);
    expect(useCart.getState().getItemCount()).toBe(2);
  });
});
