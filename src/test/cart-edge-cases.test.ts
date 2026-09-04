import { beforeEach, describe, expect, it } from "vitest";
import { useCart } from "@/hooks/useCart";
import type { Product } from "@/data/products";

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "p1",
  name: "Chair",
  slug: "chair",
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

beforeEach(() => {
  useCart.getState().clearCart();
});

describe("cart edge cases", () => {
  it("caps added quantity at stock", () => {
    useCart.getState().addItem(makeProduct({ stock: 3 }), 10);
    expect(useCart.getState().items[0].quantity).toBe(3);
  });

  it("caps added quantity at 10 even with plenty of stock", () => {
    useCart.getState().addItem(makeProduct({ stock: 100 }), 25);
    expect(useCart.getState().items[0].quantity).toBe(10);
  });

  it("never exceeds the limit when adding the same product repeatedly", () => {
    const product = makeProduct({ stock: 4 });
    useCart.getState().addItem(product, 3);
    useCart.getState().addItem(product, 3);
    useCart.getState().addItem(product, 3);
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0].quantity).toBe(4);
  });

  it("refuses to add an out-of-stock product", () => {
    useCart.getState().addItem(makeProduct({ stock: 0 }));
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("ignores non-positive quantities", () => {
    useCart.getState().addItem(makeProduct(), 0);
    useCart.getState().addItem(makeProduct(), -2);
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("updateQuantity below 1 removes the item", () => {
    useCart.getState().addItem(makeProduct(), 2);
    useCart.getState().updateQuantity("p1", 0);
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("updateQuantity clamps to stock", () => {
    useCart.getState().addItem(makeProduct({ stock: 2 }), 1);
    useCart.getState().updateQuantity("p1", 99);
    expect(useCart.getState().items[0].quantity).toBe(2);
  });

  it("updateQuantity on a missing product is a no-op", () => {
    useCart.getState().addItem(makeProduct(), 1);
    useCart.getState().updateQuantity("nope", 5);
    expect(useCart.getState().items[0].quantity).toBe(1);
  });

  it("removeItem on a missing product leaves the cart unchanged", () => {
    useCart.getState().addItem(makeProduct(), 1);
    useCart.getState().removeItem("nope");
    expect(useCart.getState().items).toHaveLength(1);
  });

  it("computes subtotal across multiple items with fractional prices", () => {
    useCart.getState().addItem(makeProduct({ id: "a", price: 19.99, stock: 10 }), 2);
    useCart.getState().addItem(makeProduct({ id: "b", price: 0.1, stock: 10 }), 3);
    expect(useCart.getState().getSubtotal()).toBeCloseTo(40.28, 2);
    expect(useCart.getState().getItemCount()).toBe(5);
  });

  it("clearCart empties everything", () => {
    useCart.getState().addItem(makeProduct({ id: "a" }), 1);
    useCart.getState().addItem(makeProduct({ id: "b" }), 1);
    useCart.getState().clearCart();
    expect(useCart.getState().items).toEqual([]);
    expect(useCart.getState().getSubtotal()).toBe(0);
  });
});
