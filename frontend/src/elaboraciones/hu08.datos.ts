/** Data shared by the HU08 tests: the base scenario of the plan, as the API answers it. */
import type { LoteInsumo } from "@/types/elaboracion";
import type {
  ElaboracionesDeInsumo,
  ElaboracionesDeLote,
  ElaboracionRelacionada,
  UsoRelacionado,
} from "@/types/relacionadas";

export const INSUMO_ID = 3;
export const NOMBRE_INSUMO = "Harina Selecta 1 kg";

export function usoConLote(id: number, codigo: string, vence: string | null = "2026-12-01"): UsoRelacionado {
  return {
    ingrediente: { id: 1, nombre: "Harina" },
    insumo_nombre: NOMBRE_INSUMO,
    lote: { id, codigo, fecha_vencimiento: vence },
    lote_estado: "con_lote",
  };
}

export function usoSinLote(): UsoRelacionado {
  return { ingrediente: { id: 1, nombre: "Harina" }, insumo_nombre: NOMBRE_INSUMO, lote: null, lote_estado: "sin_lote" };
}

export function usoPendiente(): UsoRelacionado {
  return { ingrediente: { id: 1, nombre: "Harina" }, insumo_nombre: NOMBRE_INSUMO, lote: null, lote_estado: "pendiente" };
}

export function elaboracion(
  id: number,
  codigo: string,
  fecha: string,
  extra: Partial<ElaboracionRelacionada> = {},
): ElaboracionRelacionada {
  return {
    id,
    codigo,
    fecha,
    estado: "finalizada",
    finalizada_at: "2026-10-06T12:00:00Z",
    producto: { id: 5, nombre: "Queque de vainilla", publicado: false },
    oculta: false,
    visible_publicamente: false,
    origen_datos: "conservada",
    usos: [usoConLote(1, "L-42")],
    ...extra,
  };
}

const GALLETAS = { id: 8, nombre: "Galletas", publicado: true };

/** E1 Queque finalizada L-42 · E2 Queque finalizada sin lote · E3 Galletas finalizada L-43, oculta · E4 Galletas borrador L-42. */
export const E1 = elaboracion(1, "E1", "2026-10-01");
export const E2 = elaboracion(2, "E2", "2026-10-03", { usos: [usoSinLote()] });
export const E3 = elaboracion(3, "E3", "2026-10-04", {
  producto: GALLETAS,
  oculta: true,
  usos: [usoConLote(2, "L-43", null)],
});
export const E4 = elaboracion(4, "E4", "2026-10-05", {
  producto: GALLETAS,
  estado: "borrador",
  finalizada_at: null,
  origen_datos: "vigente",
  usos: [usoConLote(1, "L-42")],
});

export const RESULTADO_INSUMO: ElaboracionesDeInsumo = {
  insumo: { id: INSUMO_ID, nombre: NOMBRE_INSUMO, activo: true },
  resumen: {
    total_elaboraciones: 4,
    total_productos: 2,
    finalizadas: 3,
    borradores: 1,
    visibles_publicamente: 0,
    elaboraciones_sin_lote: 1,
  },
  elaboraciones: [E4, E3, E2, E1],
};

export function resultadoDeLote(
  elaboraciones: ElaboracionRelacionada[],
  otras = { sin_lote: 1, lote_pendiente: 0 },
  codigo = "L-42",
): ElaboracionesDeLote {
  return {
    insumo: { id: INSUMO_ID, nombre: NOMBRE_INSUMO, activo: true },
    lote: { id: 1, codigo },
    resumen: {
      total_elaboraciones: elaboraciones.length,
      total_productos: new Set(elaboraciones.map((e) => e.producto.id)).size,
      finalizadas: elaboraciones.filter((e) => e.estado === "finalizada").length,
      borradores: elaboraciones.filter((e) => e.estado === "borrador").length,
      visibles_publicamente: 0,
    },
    otras_sin_lote: otras,
    elaboraciones,
  };
}

/** The lots of the supply as `GET /gestion/insumos/3/lotes` lists them (newest first). */
export const LOTES: LoteInsumo[] = [
  { id: 2, insumo_id: INSUMO_ID, codigo: "L-43", fecha_vencimiento: null, created_at: "2026-10-04T12:00:00Z" },
  { id: 1, insumo_id: INSUMO_ID, codigo: "L-42", fecha_vencimiento: "2026-12-01", created_at: "2026-10-01T12:00:00Z" },
];
