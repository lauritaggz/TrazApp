import type { ElaboracionPublica, FichaPublica } from "@/types/consultaPublica";

/** A public ficha as the API returns it for an available product; `cambios` overrides top-level fields. */
export function fichaDePrueba(cambios: Partial<FichaPublica> = {}): FichaPublica {
  const elaboracion: ElaboracionPublica = {
    codigo: "MFRU-042",
    fecha: "2026-03-18",
    insumos: [
      {
        ingrediente: "Pectina",
        nombre: "Pectina cítrica",
        marca_origen: "Sosa Ingredients",
        ingredientes_declarados: "Pectina cítrica y dextrosa",
        advertencias: "Puede contener leche",
        alergenos: [{ codigo: "leche", nombre: "Leche", tipo: "puede_contener" }],
      },
    ],
    alergenos: { contiene: [], puede_contener: [{ codigo: "leche", nombre: "Leche" }] },
    version_anterior: false,
  };
  return {
    producto: {
      id_publico: "tok123",
      nombre: "Mermelada de frutilla",
      contenido_neto: "350.000",
      unidad_medida: "g",
      presentacion: "Frasco",
      imagen_url: null,
      categorias: ["Conservas"],
      elaborado_por: "Conservas Valle de Curicó",
    },
    elaboraciones: [
      { codigo: "MFRU-042", fecha: "2026-03-18" },
      { codigo: "MFRU-037", fecha: "2026-03-06" },
    ],
    elaboracion,
    estado_elaboracion: "ok",
    coincidencias: [],
    ...cambios,
  };
}
