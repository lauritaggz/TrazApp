import type { LoteInsumo } from "@/types/elaboracion";
import type { ElaboracionRelacionada, OtrasSinLote, ResumenLote } from "@/types/relacionadas";
import { formatFecha } from "@/lib/elaboracionUtils";

export const RUTA_RASTREAR = "/elaboraciones/rastrear";

export interface Seleccion {
  insumo: number | null;
  lote: number | null;
}

function entero(valor: string | null): number | null {
  if (valor === null || !/^\d+$/.test(valor)) return null;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

/** `?insumo=3&lote=5` → ids. A lot without a supply, or anything that is not a positive integer, is ignored. */
export function leerSeleccion(params: URLSearchParams): Seleccion {
  const insumo = entero(params.get("insumo"));
  return { insumo, lote: insumo === null ? null : entero(params.get("lote")) };
}

/** The address of the tracing view for a supply (and a lot). */
export function rutaRastrear(insumo: number, lote?: number | null): string {
  const query = new URLSearchParams({ insumo: String(insumo) });
  if (lote) query.set("lote", String(lote));
  return `${RUTA_RASTREAR}?${query.toString()}`;
}

export interface Cifras {
  finalizadas: number;
  borradores: number;
  deProductosPublicados: number;
  ocultas: number;
  visiblesAlPublico: number;
}

/**
 * The five numbers of the panel. Finalizadas, borradores and «visibles al público» are the API's summary;
 * «de productos publicados» and «ocultas» are counted over the list, which is complete (there is no paging).
 * «Visible al público» is NOT «de producto publicado»: it also needs a finalizada that is not hidden.
 */
export function cifrasDelResultado(
  resumen: ResumenLote,
  elaboraciones: ElaboracionRelacionada[],
): Cifras {
  return {
    finalizadas: resumen.finalizadas,
    borradores: resumen.borradores,
    deProductosPublicados: elaboraciones.filter((e) => e.producto.publicado).length,
    ocultas: elaboraciones.filter((e) => e.oculta).length,
    visiblesAlPublico: resumen.visibles_publicamente,
  };
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Notice of the query by supply: how many registered it without lot (CA6). Empty when there is none. */
export function avisoSinLoteDelInsumo(n: number): string {
  if (n <= 0) return "";
  return n === 1
    ? "1 elaboración registra este insumo sin lote."
    : `${n} elaboraciones registran este insumo sin lote.`;
}

/** Notice of the query by lot (D3): the elaboraciones that are not in the list but cannot be ruled out. */
export function avisoOtrasSinLote({ sin_lote: sinLote, lote_pendiente: pendiente }: OtrasSinLote): string {
  const cierre = "No se puede descartar que usaran este lote.";
  if (sinLote > 0 && pendiente > 0) {
    return `Hay ${plural(sinLote, "elaboración", "elaboraciones")} con este insumo sin lote registrado y ${plural(pendiente, "borrador", "borradores")} con el lote pendiente. ${cierre}`;
  }
  if (sinLote > 0) {
    return `Hay ${plural(sinLote, "elaboración", "elaboraciones")} con este insumo sin lote registrado. ${cierre}`;
  }
  if (pendiente > 0) {
    return `Hay ${plural(pendiente, "borrador", "borradores")} con el lote de este insumo pendiente de definir. ${cierre}`;
  }
  return "";
}

/** The lots of the supply, newest first, as the selector shows them: the code and the expiry date. */
export function opcionesDeLotes(lotes: LoteInsumo[]): { id: number; codigo: string; etiqueta: string }[] {
  return [...lotes]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
    .map((lote) => ({
      id: lote.id,
      codigo: lote.codigo,
      etiqueta: `${lote.codigo} · ${lote.fecha_vencimiento ? `vence ${formatFecha(lote.fecha_vencimiento)}` : "sin fecha de vencimiento"}`,
    }));
}

/** «L-42 · vence 01-12-2026» / «L-42» for the lot of a use. */
export function textoDelLote(lote: { codigo: string | null; fecha_vencimiento: string | null }): string {
  const codigo = lote.codigo ?? "Lote sin código conservado";
  return lote.fecha_vencimiento ? `${codigo} · vence ${formatFecha(lote.fecha_vencimiento)}` : codigo;
}
