import { apiRequest } from "@/lib/apiClient";
import type {
  Categoria,
  Product,
  ProductCreatePayload,
  ProductUpdatePayload,
} from "@/types/product";
import type { Vecinos } from "@/types/vecinos";

export async function listCategories(): Promise<Categoria[]> {
  return apiRequest<Categoria[]>("/gestion/categorias", { method: "GET" }, true);
}

export async function listProducts(): Promise<Product[]> {
  return apiRequest<Product[]>("/gestion/productos", { method: "GET" }, true);
}

export async function getProduct(id: number): Promise<Product> {
  return apiRequest<Product>(`/gestion/productos/${id}`, { method: "GET" }, true);
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

export async function updateProduct(
  id: number,
  payload: ProductUpdatePayload,
): Promise<Product> {
  return apiRequest<Product>(
    `/gestion/productos/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function deleteProduct(id: number): Promise<void> {
  return apiRequest<void>(
    `/gestion/productos/${id}`,
    { method: "DELETE" },
    true,
  );
}

export { uploadProductImage } from "@/lib/productImageUpload";

/** HT08: previous and next product in the default order of the list (read-only). */
export async function getProductNeighbors(id: number): Promise<Vecinos> {
  return apiRequest<Vecinos>(`/gestion/productos/${id}/vecinos`, { method: "GET" }, true);
}
