export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_PRODUCT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function validateProductImage(file: File): string | undefined {
  if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_PRODUCT_IMAGE_TYPES)[number])) {
    return "Formato no permitido. Usa JPG, JPEG, PNG o WEBP.";
  }
  if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
    return "La imagen no puede superar 5 MB.";
  }
  return undefined;
}
