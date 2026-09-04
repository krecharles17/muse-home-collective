import { useQuery } from "@tanstack/react-query";
import { fetchCollections, fetchProducts } from "@/lib/api";

export const useCollections = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
    staleTime: 5 * 60 * 1000,
  });

  return { collections: data ?? [], isLoading };
};

export const useProducts = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000,
  });

  return { products: data ?? [], isLoading };
};

export const useCatalog = () => {
  const { collections, isLoading: loadingCollections } = useCollections();
  const { products, isLoading: loadingProducts } = useProducts();
  return { collections, products, isLoading: loadingCollections || loadingProducts };
};
