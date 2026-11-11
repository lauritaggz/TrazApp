const FORMATO_FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "18 mar 2026" from "2026-03-18", with no time-zone shift (the date has no time of day). */
export function formatearFecha(fechaIso: string): string {
  const partes = FORMATO_FECHA_ISO.exec(fechaIso);
  if (!partes) return fechaIso;
  const [, anio, mes, dia] = partes;
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  if (Number.isNaN(fecha.getTime())) return fechaIso;
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(fecha)
    .replace(/\./g, "");
}

/** "250 g" from "250.000" + "g"; null when there is no net content. */
export function formatearContenidoNeto(
  contenido: string | null,
  unidad: string | null,
): string | null {
  if (contenido === null || contenido.trim() === "") return null;
  const numero = Number(contenido);
  if (!Number.isFinite(numero)) return null;
  const cantidad = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(numero);
  if (!unidad) return cantidad;
  const nombreUnidad = unidad === "unidad" ? (numero === 1 ? "unidad" : "unidades") : unidad;
  return `${cantidad} ${nombreUnidad}`;
}

/** "Conservas · 350 g", skipping what is missing. */
export function lineaDeProducto(categorias: string[], contenidoFormateado: string | null): string {
  return [...categorias.slice(0, 2), ...(contenidoFormateado ? [contenidoFormateado] : [])].join(" · ");
}
