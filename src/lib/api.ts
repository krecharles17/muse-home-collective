// Browser-side API client for the catalog.
// Calls the server-side API only — the database URL/credentials never reach
// the browser because only this module talks to the API host.
import type { Collection, Product } from "@/data/products";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string;
  heroImage: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  collection: string;
  price: string | number;
  description: string | null;
  longDescription: string | null;
  materials: string | null;
  dimensions: string | null;
  images: string[] | null;
  stock: number | null;
  rating: string | number | null;
  reviewCount: number | null;
  featured: boolean | null;
  new: boolean | null;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

const mapCollection = (row: CollectionRow): Collection => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description ?? "",
  image: row.image ?? "",
  heroImage: row.heroImage ?? undefined,
});

const mapProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  collection: row.collection,
  price: Number(row.price),
  description: row.description ?? "",
  longDescription: row.longDescription ?? "",
  materials: row.materials ?? "",
  dimensions: row.dimensions ?? undefined,
  images: row.images ?? [],
  stock: row.stock ?? 0,
  rating: Number(row.rating ?? 0),
  reviewCount: row.reviewCount ?? 0,
  featured: row.featured ?? false,
  new: row.new ?? false,
});

export async function fetchCollections(): Promise<Collection[]> {
  const rows = await getJson<CollectionRow[]>("/api/collections");
  return rows.map(mapCollection);
}

export async function fetchProducts(): Promise<Product[]> {
  const rows = await getJson<ProductRow[]>("/api/products");
  return rows.map(mapProduct);
}
