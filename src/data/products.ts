export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  heroImage?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  collection: string;
  price: number;
  description: string;
  longDescription: string;
  materials: string;
  dimensions?: string;
  images: string[];
  stock: number;
  rating: number;
  reviewCount: number;
  featured?: boolean;
  new?: boolean;
}

export type ProductSort = "featured" | "newest" | "price-asc" | "price-desc" | "name-asc";

export const filterAndSortProducts = (
  products: Product[],
  collections: Collection[],
  collectionSlug: string,
  sort: ProductSort,
): Product[] => {
  let result = [...products];
  if (collectionSlug !== "all") {
    const collection = collections.find((candidate) => candidate.slug === collectionSlug);
    result = collection ? result.filter((product) => product.collection === collection.id) : result;
  }

  switch (sort) {
    case "newest":
      return result.filter((product) => product.new).concat(result.filter((product) => !product.new));
    case "price-asc":
      return result.sort((a, b) => a.price - b.price);
    case "price-desc":
      return result.sort((a, b) => b.price - a.price);
    case "name-asc":
      return result.sort((a, b) => a.name.localeCompare(b.name));
    case "featured":
      return result.filter((product) => product.featured).concat(result.filter((product) => !product.featured));
  }
};

export const getProductsByCollection = (products: Product[], collectionId: string): Product[] =>
  products.filter((product) => product.collection === collectionId);

export const getFeaturedProducts = (products: Product[]): Product[] =>
  products.filter((product) => product.featured);

export const getNewProducts = (products: Product[]): Product[] =>
  products.filter((product) => product.new);

export const getProductBySlug = (products: Product[], slug: string): Product | undefined =>
  products.find((product) => product.slug === slug);

export const getCollectionBySlug = (
  collections: Collection[],
  slug: string
): Collection | undefined => collections.find((collection) => collection.slug === slug);

export const getRelatedProducts = (
  products: Product[],
  productId: string,
  limit = 4
): Product[] => {
  const product = products.find((p) => p.id === productId);
  if (!product) return [];
  return products
    .filter((p) => p.collection === product.collection && p.id !== productId)
    .slice(0, limit);
};
