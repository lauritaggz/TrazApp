import { apiRequest } from "@/lib/apiClient";
import type {
  Categoria,
  Product,
  ProductCreatePayload,
  ProductUpdatePayload,
} from "@/types/product";

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

export { uploadProductImage } from "@/lib/productImageUpload";
