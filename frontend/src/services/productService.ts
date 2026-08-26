import { apiRequest } from "@/lib/apiClient";
import type { Product } from "@/types/product";

export async function listProducts(): Promise<Product[]> {
  return apiRequest<Product[]>("/gestion/productos", { method: "GET" }, true);
}
