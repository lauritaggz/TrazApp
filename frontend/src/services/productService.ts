import { apiRequest } from "@/lib/apiClient";
import type { Product, ProductCreatePayload } from "@/types/product";

export async function listProducts(): Promise<Product[]> {
  return apiRequest<Product[]>("/gestion/productos", { method: "GET" }, true);
}

export async function createProduct(
  payload: ProductCreatePayload,
): Promise<Product> {
  return apiRequest<Product>(
    "/gestion/productos",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}
