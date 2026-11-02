import type { ListElaboracionesParams } from "@/services/elaboracionService";
import type { EstadoElaboracion } from "@/types/elaboracion";

/** The history shows this many elaboraciones per page (the API default). */
export const TAMANO_PAGINA = 20;

/** The filters of the history as the URL carries them: `?producto=&estado=&desde=&hasta=&codigo=&pagina=`. */
export interface FiltrosHistorial {
  producto: number | null;
  estado: EstadoElaboracion | null;
  /** yyyy-mm-dd, inclusive. */
  desde: string | null;
  hasta: string | null;
  codigo: string;
  /** From 1. */
  pagina: number;
}

export const FILTROS_VACIOS: FiltrosHistorial = {
  producto: null,
  estado: null,
  desde: null,
  hasta: null,
  codigo: "",
  pagina: 1,
};

function esFechaValida(texto: string | null): texto is string {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

/** Reads the filters from the URL; whatever is not valid is ignored. */
export function leerFiltros(params: URLSearchParams): FiltrosHistorial {
  const producto = Number(params.get("producto"));
  const estado = params.get("estado");
  const pagina = Number(params.get("pagina"));
  return {
    producto: Number.isInteger(producto) && producto > 0 ? producto : null,
    estado: estado === "borrador" || estado === "finalizada" ? estado : null,
    desde: esFechaValida(params.get("desde")) ? params.get("desde") : null,
    hasta: esFechaValida(params.get("hasta")) ? params.get("hasta") : null,
    codigo: (params.get("codigo") ?? "").trim(),
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  };
}

/** The URL of some filters: only what is set, and `pagina` only from the second page. */
export function aParams(filtros: FiltrosHistorial): URLSearchParams {
  const params = new URLSearchParams();
  if (filtros.producto !== null) params.set("producto", String(filtros.producto));
  if (filtros.estado !== null) params.set("estado", filtros.estado);
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.codigo.trim()) params.set("codigo", filtros.codigo.trim());
  if (filtros.pagina > 1) params.set("pagina", String(filtros.pagina));
  return params;
}

/** Whether any filter (not the page) is set. */
export function hayFiltros(filtros: FiltrosHistorial): boolean {
  return (
    filtros.producto !== null ||
    filtros.estado !== null ||
    Boolean(filtros.desde) ||
    Boolean(filtros.hasta) ||
    filtros.codigo.trim() !== ""
  );
}

/** «desde» after «hasta»: the server would answer 422, so it is not even asked. */
export function rangoInvalido(filtros: FiltrosHistorial): boolean {
  return Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);
}

/** What the service is asked for a page of the history. */
export function parametrosDeLaPagina(filtros: FiltrosHistorial): ListElaboracionesParams {
  const params: ListElaboracionesParams = {
    limit: TAMANO_PAGINA,
    offset: (filtros.pagina - 1) * TAMANO_PAGINA,
  };
  if (filtros.producto !== null) params.productoId = filtros.producto;
  if (filtros.estado !== null) params.estado = filtros.estado;
  if (filtros.desde) params.fechaDesde = filtros.desde;
  if (filtros.hasta) params.fechaHasta = filtros.hasta;
  if (filtros.codigo.trim()) params.codigo = filtros.codigo.trim();
  return params;
}

/** The last page that has something, from 1 (an empty list has page 1). */
export function ultimaPagina(total: number): number {
  return Math.max(1, Math.ceil(total / TAMANO_PAGINA));
}

/** «x–y de z» of a page: from the first to the last elaboración shown. */
export function rangoDePagina(pagina: number, cantidad: number, total: number): string {
  if (total === 0 || cantidad === 0) return `0 de ${total}`;
  const desde = (pagina - 1) * TAMANO_PAGINA + 1;
  return `${desde}–${desde + cantidad - 1} de ${total}`;
}
