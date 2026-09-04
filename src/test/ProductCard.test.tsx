import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { useWishlist } from "@/hooks/useWishlist";
import type { Product } from "@/data/products";

vi.mock("@/hooks/useCatalog", () => ({
  useCollections: () => ({
    collections: [{ id: "seating", name: "Seating", slug: "seating", description: "", image: "" }],
    isLoading: false,
  }),
}));

const product: Product = {
  id: "chair",
  name: "Nordic Chair",
  slug: "nordic-chair",
  collection: "seating",
  price: 1250,
  description: "A quiet seat",
  longDescription: "",
  materials: "Oak, linen",
  images: ["front.jpg", "back.jpg"],
  stock: 4,
  rating: 5,
  reviewCount: 12,
  new: true,
};

const renderCard = (overrides: Partial<Product> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ProductCard product={{ ...product, ...overrides }} />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("ProductCard", () => {
  beforeEach(() => {
    useWishlist.setState({ items: [] });
  });

  it("shows the name, price, collection and links to the product page", () => {
    renderCard();
    expect(screen.getByText("Nordic Chair")).toBeInTheDocument();
    expect(screen.getByText("$1,250")).toBeInTheDocument();
    expect(screen.getByText("Seating")).toBeInTheDocument();
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/product/nordic-chair");
  });

  it("shows the New badge only for new products", () => {
    const { unmount } = renderCard();
    expect(screen.getByText("New")).toBeInTheDocument();
    unmount();
    renderCard({ new: false });
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("toggles the product in and out of the wishlist", () => {
    renderCard();
    fireEvent.click(screen.getByLabelText("Add Nordic Chair to wishlist"));
    expect(useWishlist.getState().isInWishlist("chair")).toBe(true);

    fireEvent.click(screen.getByLabelText("Remove Nordic Chair from wishlist"));
    expect(useWishlist.getState().isInWishlist("chair")).toBe(false);
  });
});
