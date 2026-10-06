import type {
  Elaboracion,
  LineaRegistro,
  LotePayload,
  MotivoProblema,
  RegistroEncabezado,
  UsoPayload,
} from "@/types/elaboracion";

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
};

export function describirLote(codigo: string, vencimiento: string | null): string {
  return vencimiento ? `${codigo} · vence ${formatFecha(vencimiento)}` : codigo;
}
