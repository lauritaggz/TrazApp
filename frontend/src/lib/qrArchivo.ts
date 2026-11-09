export type FormatoQr = "png" | "svg";

/**
 * The file name of a `Content-Disposition: attachment; filename="qr-GAL-001.png"` header, or null.
 * The browser only lets the page read that header when the API exposes it (CORS).
 */
export function nombreDeContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const coincidencia = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  const nombre = coincidencia?.[1]?.trim();
  return nombre ? nombre : null;
}

/**
 * The same name the API would send: `qr-{code}.{ext}` with the code reduced to safe characters and
 * the product id when nothing is left. It is the fallback when the header cannot be read.
 */
export function nombreArchivoQr(codigo: string | null | undefined, productoId: number, formato: FormatoQr): string {
  const limpio = (codigo ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-._]+|[-._]+$/g, "");
  return `qr-${limpio || productoId}.${formato}`;
}
