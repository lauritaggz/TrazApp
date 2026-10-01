import type { Product } from "@/types/product";

export type ProductGap = "imagen" | "categorias" | "precio";

export const PRODUCT_GAP_LABELS: Record<ProductGap, string> = {
  imagen: "Sin imagen",
  categorias: "Sin categorías",
  precio: "Sin precio de venta",
};

/** Información comercial que el productor aún no ha completado en un producto. */
export function getProductGaps(product: Product): ProductGap[] {
  const gaps: ProductGap[] = [];
  if (!product.imagen_url?.trim()) gaps.push("imagen");
  if (product.categorias.length === 0) gaps.push("categorias");
  if (!product.precio_venta?.trim()) gaps.push("precio");
  return gaps;
}

export interface ProductWithGaps {
  product: Product;
  gaps: ProductGap[];
}

export function productsWithGaps(products: Product[]): ProductWithGaps[] {
  return products
    .map((product) => ({ product, gaps: getProductGaps(product) }))
    .filter((entry) => entry.gaps.length > 0)
    .sort((a, b) => b.gaps.length - a.gaps.length || a.product.id - b.product.id);
}
