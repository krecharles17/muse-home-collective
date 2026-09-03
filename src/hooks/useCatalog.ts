import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Collection, Product } from "@/data/products";

const mapCollection = (row: any): Collection => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description ?? "",
  image: row.image ?? "",
  heroImage: row.hero_image ?? undefined,
});

const mapProduct = (row: any): Product => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  collection: row.collection_id,
  price: Number(row.price),
  description: row.description ?? "",
  longDescription: row.long_description ?? "",
  materials: row.materials ?? "",
  dimensions: row.dimensions ?? undefined,
  images: row.images ?? [],
  stock: row.stock ?? 0,
  rating: Number(row.rating ?? 0),
  reviewCount: row.review_count ?? 0,
  featured: row.featured ?? false,
  new: row.is_new ?? false,
});

export const useCollections = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data.map(mapCollection);
    },
    staleTime: 5 * 60 * 1000,
  });

  return { collections: data ?? [], isLoading };
};

export const useProducts = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map(mapProduct);
    },
    staleTime: 5 * 60 * 1000,
  });

  return { products: data ?? [], isLoading };
};

export const useCatalog = () => {
  const { collections, isLoading: loadingCollections } = useCollections();
  const { products, isLoading: loadingProducts } = useProducts();
  return { collections, products, isLoading: loadingCollections || loadingProducts };
};
