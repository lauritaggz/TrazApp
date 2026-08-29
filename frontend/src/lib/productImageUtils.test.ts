import { describe, expect, it } from "vitest";
import { validateProductImage } from "@/lib/productImageUtils";

describe("validateProductImage", () => {
  it("acepta formatos permitidos", () => {
    const file = new File(["png"], "galleta.png", { type: "image/png" });
    expect(validateProductImage(file)).toBeUndefined();
  });

  it("rechaza formato inválido", () => {
    const file = new File(["txt"], "nota.txt", { type: "text/plain" });
    expect(validateProductImage(file)).toBe(
      "Formato no permitido. Usa JPG, JPEG, PNG o WEBP.",
    );
  });

  it("rechaza imágenes mayores a 5 MB", () => {
    const file = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "grande.png",
      { type: "image/png" },
    );
    expect(validateProductImage(file)).toBe(
      "La imagen no puede superar 5 MB.",
    );
  });
});
