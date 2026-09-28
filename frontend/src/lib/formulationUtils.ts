import type {
  FormulacionDraftLine,
  FormulacionLineaPayload,
  FormulacionReemplazoPayload,
  FormulacionVersion,
  ResultadoGuardadoFormulacion,
} from "@/types/formulation";
import type { UnidadMedida } from "@/types/product";

// Mirrors the backend column Numeric(12, 3).
const CANTIDAD_PATTERN = /^\d{1,9}([.,]\d{1,3})?$/;

export function formatFormulacionCantidad(
  cantidad: string | null,
  unidad: UnidadMedida | null,
): string | null {
  if (!cantidad || !unidad) return null;
  const value = Number(cantidad);
  if (Number.isNaN(value)) return `${cantidad} ${unidad}`;
  return `${value.toLocaleString("es-CL", { maximumFractionDigits: 3 })} ${unidad}`;
}

export function toDraftLines(version: FormulacionVersion | null): FormulacionDraftLine[] {
  if (!version) return [];
  return version.lineas.map((linea) => ({
    ingrediente_id: linea.ingrediente_id,
    nombre: linea.ingrediente_nombre,
    codigo_interno: linea.ingrediente_codigo_interno,
    cantidad: linea.cantidad == null ? "" : String(Number(linea.cantidad)),
    unidad: linea.unidad ?? "",
    notas: linea.notas,
    desactivado: linea.ingrediente_desactivado,
  }));
}

export interface FormulacionDraftErrors {
  general?: string;
  lineas: Record<number, string>;
}

export function validateDraftLines(lines: FormulacionDraftLine[]): FormulacionDraftErrors {
  const errors: FormulacionDraftErrors = { lineas: {} };
  if (lines.length === 0) {
    errors.general = "Agrega al menos un ingrediente a la formulación.";
  }
  for (const line of lines) {
    const cantidad = line.cantidad.trim();
    if (cantidad && !line.unidad) {
      errors.lineas[line.ingrediente_id] = "Indica la unidad para esta cantidad.";
    } else if (!cantidad && line.unidad) {
      errors.lineas[line.ingrediente_id] = "Indica la cantidad para esta unidad.";
    } else if (
      cantidad &&
      (!CANTIDAD_PATTERN.test(cantidad) || Number(cantidad.replace(",", ".")) <= 0)
    ) {
      errors.lineas[line.ingrediente_id] =
        "Ingresa una cantidad mayor que 0, con hasta 3 decimales.";
    }
  }
  return errors;
}

export function hasDraftErrors(errors: FormulacionDraftErrors): boolean {
  return Boolean(errors.general) || Object.keys(errors.lineas).length > 0;
}

export function buildReemplazoPayload(
  lines: FormulacionDraftLine[],
): FormulacionReemplazoPayload {
  return {
    lineas: lines.map((line) => {
      const payload: FormulacionLineaPayload = { ingrediente_id: line.ingrediente_id };
      const cantidad = line.cantidad.trim();
      if (cantidad && line.unidad) {
        payload.cantidad = cantidad.replace(",", ".");
        payload.unidad = line.unidad;
      }
      // Notes are not editable yet; resending them keeps an unchanged recipe unchanged.
      if (line.notas) payload.notas = line.notas;
      return payload;
    }),
  };
}

export function resultadoGuardadoMessage(
  resultado: ResultadoGuardadoFormulacion,
  numeroVersion: number,
): string {
  switch (resultado) {
    case "version_creada":
      return `Formulación guardada (versión ${numeroVersion}).`;
    case "modificada_en_lugar":
      return "Formulación actualizada.";
    case "nueva_version":
      return `Se creó la versión ${numeroVersion}, porque la anterior ya se utilizó en una elaboración.`;
    case "sin_cambios":
      return "No hay cambios para guardar.";
  }
}
