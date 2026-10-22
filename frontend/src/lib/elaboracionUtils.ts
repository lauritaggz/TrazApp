import type {
  Elaboracion,
  LineaRegistro,
  LotePayload,
  MotivoProblema,
  RegistroEncabezado,
  UsoPayload,
} from "@/types/elaboracion";
import type { Insumo } from "@/types/insumo";

export const MAX_CODIGO_ELABORACION = 100;

/** Confirmation shown before finalizing (CA10). */
export const TEXTO_CONFIRMAR_FINALIZACION =
  "Al finalizar, la información de los insumos utilizados quedará registrada de forma permanente y la elaboración no podrá modificarse ni eliminarse.";

/** Today in Chile as YYYY-MM-DD: the date input cannot go beyond it. */
export function hoyChile(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

/** YYYY-MM-DD to DD-MM-YYYY (Chilean style); anything else is returned as is. */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : iso;
}

/** The date of an ISO timestamp as DD-MM-YYYY, in America/Santiago ("—" when it is missing or invalid). */
export function formatFechaDeMomento(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const partes = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("day")}-${valor("month")}-${valor("year")}`;
}

/** 24-hour date and time in America/Santiago. */
export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Información conservada al finalizar el DD-MM-AAAA a las HH:MM" (24 h, America/Santiago). */
export function textoInformacionConservada(finalizadaAt: string | null | undefined): string | null {
  if (!finalizadaAt) return null;
  const date = new Date(finalizadaAt);
  if (Number.isNaN(date.getTime())) return null;
  const partes = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hourCycle: "h23",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `Información conservada al finalizar el ${valor("day")}-${valor("month")}-${valor("year")} a las ${valor("hour")}:${valor("minute")}`;
}

export function encabezadoDesdeElaboracion(elaboracion: Elaboracion): RegistroEncabezado {
  return { codigo: elaboracion.codigo, fecha: elaboracion.fecha };
}

export function lineasDesdeElaboracion(elaboracion: Elaboracion): LineaRegistro[] {
  return elaboracion.usos.map((uso) => ({
    ingrediente_id: uso.ingrediente_id,
    ingrediente_nombre: uso.ingrediente_nombre,
    orden: uso.orden,
    cantidad: uso.cantidad,
    unidad: uso.unidad,
    insumoId: uso.insumo ? String(uso.insumo.id) : "",
    loteModo: uso.lote ? "existente" : uso.sin_lote ? "sin_lote" : "",
    loteCodigo: "",
    loteVence: "",
    loteId: uso.lote ? String(uso.lote.id) : "",
    ingredienteDesactivado: uso.ingrediente_desactivado,
  }));
}

/** A line is pending while it lacks its supply or a complete choice of lot. */
export function lineaPendiente(linea: LineaRegistro): boolean {
  if (!linea.insumoId) return true;
  switch (linea.loteModo) {
    case "sin_lote":
      return false;
    case "nuevo":
      return linea.loteCodigo.trim() === "";
    case "existente":
      return linea.loteId === "";
    default:
      return true;
  }
}

/** What a line of the registro still lacks (HT07). A line with allergens to review is NOT ready. */
export type EstadoLinea = "lista" | "falta_insumo" | "falta_lote" | "falta_alergenos";

export const ETIQUETA_ESTADO_LINEA: Record<EstadoLinea, string> = {
  lista: "Lista",
  falta_insumo: "Falta el insumo",
  falta_lote: "Falta el lote",
  falta_alergenos: "Falta revisar alérgenos",
};

/** The selected supply has its allergens unreviewed, or the server said so when finalizing. */
export function alergenosSinRevisarDe(
  insumoSeleccionado: Insumo | null,
  problemas: readonly string[] | undefined,
): boolean {
  return (
    insumoSeleccionado !== null &&
    (!insumoSeleccionado.alergenos_revisados || Boolean(problemas?.includes("alergenos_sin_revisar")))
  );
}

/**
 * `insumoSeleccionado` is the assigned supply when it is one of the active options; an assigned supply that
 * is no longer an option (deactivated) counts as «falta el insumo», because another one has to be chosen.
 */
export function estadoDeLinea(
  linea: LineaRegistro,
  insumoSeleccionado: Insumo | null,
  problemas?: readonly string[],
): EstadoLinea {
  if (!linea.insumoId || insumoSeleccionado === null) return "falta_insumo";
  if (lineaPendiente(linea)) return "falta_lote";
  if (alergenosSinRevisarDe(insumoSeleccionado, problemas)) return "falta_alergenos";
  return "lista";
}

/** «Faltan 3 de 5 ingredientes» / «Todos los ingredientes están listos». */
export function textoProgreso(faltan: number, total: number): string {
  if (faltan === 0) return "Todos los ingredientes están listos";
  return `${faltan === 1 ? "Falta" : "Faltan"} ${faltan} de ${total} ingredientes`;
}

export interface EncabezadoErrors {
  codigo?: string;
  fecha?: string;
}

export function validarEncabezado(
  encabezado: RegistroEncabezado,
  hoy: string = hoyChile(),
): EncabezadoErrors {
  const errors: EncabezadoErrors = {};
  const codigo = encabezado.codigo.trim();
  if (!codigo) errors.codigo = "El código de la elaboración es obligatorio.";
  else if (codigo.length > MAX_CODIGO_ELABORACION) {
    errors.codigo = `Máximo ${MAX_CODIGO_ELABORACION} caracteres.`;
  }
  if (!encabezado.fecha) errors.fecha = "La fecha es obligatoria.";
  else if (encabezado.fecha > hoy) errors.fecha = "La fecha no puede ser futura.";
  return errors;
}

/** Errors by ingredient id: only what cannot be sent (a started lot choice left incomplete). */
export function validarLineas(lineas: LineaRegistro[]): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const linea of lineas) {
    if (!linea.insumoId) continue;
    if (linea.loteModo === "nuevo" && linea.loteCodigo.trim() === "") {
      errors[linea.ingrediente_id] = "Ingresa el código del lote.";
    } else if (linea.loteModo === "existente" && linea.loteId === "") {
      errors[linea.ingrediente_id] = "Elige un lote existente.";
    }
  }
  return errors;
}

function lotePayload(linea: LineaRegistro): LotePayload | undefined {
  switch (linea.loteModo) {
    case "sin_lote":
      return { tipo: "sin_lote" };
    case "nuevo":
      return {
        tipo: "nuevo",
        codigo: linea.loteCodigo.trim(),
        fecha_vencimiento: linea.loteVence || null,
      };
    case "existente":
      return { tipo: "existente", lote_id: Number(linea.loteId) };
    default:
      return undefined;
  }
}

/** PUT /usos body: one entry per ingredient; a lot only travels with its supply. */
export function usosPayload(lineas: LineaRegistro[]): UsoPayload[] {
  return lineas.map((linea) => {
    if (!linea.insumoId) return { ingrediente_id: linea.ingrediente_id, insumo_id: null };
    const lote = lotePayload(linea);
    const uso: UsoPayload = {
      ingrediente_id: linea.ingrediente_id,
      insumo_id: Number(linea.insumoId),
    };
    if (lote) uso.lote = lote;
    return uso;
  });
}

function normalizada(linea: LineaRegistro) {
  return {
    ingrediente_id: linea.ingrediente_id,
    insumoId: linea.insumoId,
    loteModo: linea.insumoId ? linea.loteModo : "",
    loteCodigo: linea.loteModo === "nuevo" ? linea.loteCodigo.trim() : "",
    loteVence: linea.loteModo === "nuevo" ? linea.loteVence : "",
    loteId: linea.loteModo === "existente" ? linea.loteId : "",
  };
}

export function lineasCambiaron(base: LineaRegistro[], actuales: LineaRegistro[]): boolean {
  return (
    JSON.stringify(base.map(normalizada)) !== JSON.stringify(actuales.map(normalizada))
  );
}

export function encabezadoCambio(
  base: RegistroEncabezado,
  actual: RegistroEncabezado,
): boolean {
  return base.codigo.trim() !== actual.codigo.trim() || base.fecha !== actual.fecha;
}

export const MOTIVOS_PROBLEMA: Record<MotivoProblema, string> = {
  insumo: "Falta elegir el insumo.",
  lote: "Falta indicar el lote o marcar «Sin lote».",
  insumo_desactivado: "El insumo asignado está desactivado. Elige otro insumo.",
  ingrediente_desactivado:
    "El ingrediente está desactivado. Corrige la formulación del producto.",
  alergenos_sin_revisar: "Alérgenos del insumo sin revisar.",
};

const MOTIVO_DESCONOCIDO = "Esta línea no se puede finalizar. Revísala e inténtalo nuevamente.";

/** Text for a reason the server sent; one this version does not know never breaks the screen. */
export function describirMotivo(motivo: string): string {
  return (MOTIVOS_PROBLEMA as Record<string, string | undefined>)[motivo] ?? MOTIVO_DESCONOCIDO;
}

export function describirLote(codigo: string, vencimiento: string | null): string {
  return vencimiento ? `${codigo} · vence ${formatFecha(vencimiento)}` : codigo;
}

/** Text of the button that takes the lot suggested from the last finalized elaboración (HT06-04). */
export function textoUsarLote(codigo: string, vencimiento: string | null): string {
  return vencimiento
    ? `Usar lote ${codigo} (vence ${formatFecha(vencimiento)})`
    : `Usar lote ${codigo}`;
}

function plural(cantidad: number, singular: string, pluralTexto: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}

/** Result of «Usar los mismos lotes», for a live region. */
export function anuncioLotesAsignados(asignados: number, sinSugerencia: number): string {
  const primera = `${asignados === 1 ? "Se asignó" : "Se asignaron"} ${plural(asignados, "lote", "lotes")}.`;
  if (sinSugerencia === 0) return primera;
  const segunda =
    sinSugerencia === 1
      ? "1 línea no tiene lote sugerido."
      : `${sinSugerencia} líneas no tienen lote sugerido.`;
  return `${primera} ${segunda}`;
}
