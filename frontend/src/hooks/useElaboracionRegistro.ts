import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  encabezadoCambio,
  encabezadoDesdeElaboracion,
  lineasCambiaron,
  lineaPendiente,
  lineasDesdeElaboracion,
  usosPayload,
  validarEncabezado,
  validarLineas,
  type EncabezadoErrors,
} from "@/lib/elaboracionUtils";
import {
  deleteElaboracion,
  finalizarElaboracion,
  listLotesInsumo,
  replaceUsos,
  updateElaboracion,
} from "@/services/elaboracionService";
import { listInsumos } from "@/services/insumoService";
import { ApiError } from "@/types/auth";
import type {
  Elaboracion,
  ElaboracionUpdatePayload,
  LineaRegistro,
  LoteInsumo,
  LoteModo,
  MotivoProblema,
  ProblemaFinalizacion,
  RegistroEncabezado,
} from "@/types/elaboracion";
import type { Insumo } from "@/types/insumo";

const SAVE_ERROR = "No pudimos guardar el borrador. Inténtalo nuevamente.";
const FINALIZE_ERROR = "No pudimos finalizar la elaboración. Inténtalo nuevamente.";
const DELETE_ERROR = "No pudimos eliminar el borrador. Inténtalo nuevamente.";
export const MENSAJE_LINEAS_CON_PROBLEMAS =
  "No se puede finalizar todavía: revisa las líneas marcadas.";

export interface ErrorLinea {
  mensaje: string;
  /** The lot code already exists: the existing lot can be used instead. */
  usarLoteId?: number;
}

interface Options {
  elaboracion: Elaboracion;
  onFinalizada: (elaboracion: Elaboracion) => void;
  onEliminada: () => void;
}

function objectDetail(error: ApiError): Record<string, unknown> | null {
  const detail = error.detail;
  return detail && typeof detail === "object" && !Array.isArray(detail)
    ? (detail as Record<string, unknown>)
    : null;
}

/** State, saving, finalizing and deleting of the registro screen of a borrador. */
export function useElaboracionRegistro({ elaboracion, onFinalizada, onEliminada }: Options) {
  const [servidor, setServidor] = useState<Elaboracion>(elaboracion);
  const [baseEncabezado, setBaseEncabezado] = useState<RegistroEncabezado>(() =>
    encabezadoDesdeElaboracion(elaboracion),
  );
  const [encabezado, setEncabezado] = useState<RegistroEncabezado>(baseEncabezado);
  const [baseLineas, setBaseLineas] = useState<LineaRegistro[]>(() =>
    lineasDesdeElaboracion(elaboracion),
  );
  const [lineas, setLineas] = useState<LineaRegistro[]>(baseLineas);

  const [erroresEncabezado, setErroresEncabezado] = useState<EncabezadoErrors>({});
  const [erroresLinea, setErroresLinea] = useState<Record<number, ErrorLinea>>({});
  const [problemas, setProblemas] = useState<Record<number, MotivoProblema[]>>({});
  const [globalError, setGlobalError] = useState("");
  const [errorFocusToken, setErrorFocusToken] = useState(0);

  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumosLoading, setInsumosLoading] = useState(true);
  const [insumosError, setInsumosError] = useState(false);

  const [lotes, setLotes] = useState<Record<number, LoteInsumo[]>>({});
  const [lotesError, setLotesError] = useState<Record<number, boolean>>({});
  const lotesPedidos = useRef(new Set<number>());

  const loadInsumos = useCallback(async () => {
    setInsumosLoading(true);
    setInsumosError(false);
    try {
      setInsumos(await listInsumos());
    } catch {
      setInsumos([]);
      setInsumosError(true);
    } finally {
      setInsumosLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInsumos();
  }, [loadInsumos]);

  const cargarLotes = useCallback(async (insumoId: number, forzar = false) => {
    if (!forzar && lotesPedidos.current.has(insumoId)) return;
    lotesPedidos.current.add(insumoId);
    try {
      const data = await listLotesInsumo(insumoId);
      setLotes((current) => ({ ...current, [insumoId]: data }));
      setLotesError((current) => ({ ...current, [insumoId]: false }));
    } catch {
      lotesPedidos.current.delete(insumoId);
      setLotesError((current) => ({ ...current, [insumoId]: true }));
    }
  }, []);

  // The lots of every supply in use are needed to offer "Lote existente".
  const insumosEnUso = lineas
    .map((linea) => linea.insumoId)
    .filter(Boolean)
    .join(",");
  useEffect(() => {
    for (const id of insumosEnUso ? insumosEnUso.split(",") : []) void cargarLotes(Number(id));
  }, [insumosEnUso, cargarLotes]);

  const dirty = useMemo(
    () => encabezadoCambio(baseEncabezado, encabezado) || lineasCambiaron(baseLineas, lineas),
    [baseEncabezado, encabezado, baseLineas, lineas],
  );
  const busy = saving || finalizing || deleting;

  function aplicarServidor(detalle: Elaboracion) {
    const nuevoEncabezado = encabezadoDesdeElaboracion(detalle);
    const nuevasLineas = lineasDesdeElaboracion(detalle);
    setServidor(detalle);
    setBaseEncabezado(nuevoEncabezado);
    setEncabezado(nuevoEncabezado);
    setBaseLineas(nuevasLineas);
    setLineas(nuevasLineas);
  }

  function limpiarMensajes() {
    setGlobalError("");
    setErroresEncabezado({});
    setErroresLinea({});
    setProblemas({});
    setSaved(false);
  }

  function cambiarEncabezado(cambios: Partial<RegistroEncabezado>) {
    setEncabezado((actual) => ({ ...actual, ...cambios }));
    setErroresEncabezado((actual) => {
      const copia = { ...actual };
      for (const campo of Object.keys(cambios) as (keyof EncabezadoErrors)[]) delete copia[campo];
      return copia;
    });
    setSaved(false);
    if (globalError) setGlobalError("");
  }

  function limpiarLinea(ingredienteId: number) {
    setErroresLinea((actual) => {
      if (!actual[ingredienteId]) return actual;
      const copia = { ...actual };
      delete copia[ingredienteId];
      return copia;
    });
    setProblemas((actual) => {
      if (!actual[ingredienteId]) return actual;
      const copia = { ...actual };
      delete copia[ingredienteId];
      return copia;
    });
    setSaved(false);
  }

  function cambiarLinea(ingredienteId: number, cambios: Partial<LineaRegistro>) {
    setLineas((actuales) =>
      actuales.map((linea) =>
        linea.ingrediente_id === ingredienteId ? { ...linea, ...cambios } : linea,
      ),
    );
    limpiarLinea(ingredienteId);
  }

  function elegirInsumo(ingredienteId: number, insumoId: string) {
    cambiarLinea(ingredienteId, {
      insumoId,
      loteModo: "",
      loteCodigo: "",
      loteVence: "",
      loteId: "",
    });
  }

  function elegirModoLote(ingredienteId: number, modo: LoteModo) {
    cambiarLinea(ingredienteId, { loteModo: modo });
  }

  /** "Usar este lote": the new lot code already exists, so the line points to the existing one. */
  function usarLoteExistente(ingredienteId: number, loteId: number) {
    const linea = lineas.find((item) => item.ingrediente_id === ingredienteId);
    cambiarLinea(ingredienteId, {
      loteModo: "existente",
      loteId: String(loteId),
      loteCodigo: "",
      loteVence: "",
    });
    if (linea?.insumoId) void cargarLotes(Number(linea.insumoId), true);
  }

  function marcarProblemas(lista: ProblemaFinalizacion[]) {
    const porLinea: Record<number, MotivoProblema[]> = {};
    for (const problema of lista) {
      porLinea[problema.ingrediente_id] = [
        ...(porLinea[problema.ingrediente_id] ?? []),
        problema.falta,
      ];
    }
    setProblemas(porLinea);
  }

  function mapearError(err: unknown, fallback: string) {
    if (err instanceof ApiError) {
      const detalle = objectDetail(err);
      const ingredienteId =
        detalle && typeof detalle.ingrediente_id === "number" ? detalle.ingrediente_id : null;

      if (err.status === 409 && detalle) {
        if (ingredienteId !== null && typeof detalle.lote_id === "number") {
          setErroresLinea((actual) => ({
            ...actual,
            [ingredienteId]: { mensaje: err.message, usarLoteId: detalle.lote_id as number },
          }));
          return;
        }
        if (typeof detalle.codigo_sugerido === "string") {
          setErroresEncabezado({
            codigo: `${err.message} Prueba con ${detalle.codigo_sugerido}.`,
          });
          setErrorFocusToken((token) => token + 1);
          return;
        }
        if (Array.isArray(detalle.problemas)) {
          marcarProblemas(detalle.problemas as ProblemaFinalizacion[]);
          setGlobalError(MENSAJE_LINEAS_CON_PROBLEMAS);
          return;
        }
      }
      if (err.status === 422 && ingredienteId !== null) {
        setErroresLinea((actual) => ({ ...actual, [ingredienteId]: { mensaje: err.message } }));
        return;
      }
      if (err.status === 422 && (err.fieldErrors.codigo || err.fieldErrors.fecha)) {
        setErroresEncabezado({
          codigo: err.fieldErrors.codigo,
          fecha: err.fieldErrors.fecha,
        });
        setErrorFocusToken((token) => token + 1);
        return;
      }
      if (err.status === 409 || err.status === 422 || err.status === 404) {
        setGlobalError(err.message);
        return;
      }
    }
    setGlobalError(fallback);
  }

  /** Saves the header (if it changed) and the whole assignment. Returns whether it all worked. */
  async function guardar(): Promise<boolean> {
    limpiarMensajes();
    const erroresEnc = validarEncabezado(encabezado);
    const erroresLin = validarLineas(lineas);
    if (Object.keys(erroresEnc).length > 0 || Object.keys(erroresLin).length > 0) {
      setErroresEncabezado(erroresEnc);
      setErroresLinea(
        Object.fromEntries(
          Object.entries(erroresLin).map(([id, mensaje]) => [id, { mensaje }]),
        ),
      );
      setErrorFocusToken((token) => token + 1);
      return false;
    }

    setSaving(true);
    try {
      if (encabezadoCambio(baseEncabezado, encabezado)) {
        const cambios: ElaboracionUpdatePayload = {};
        if (encabezado.codigo.trim() !== baseEncabezado.codigo.trim()) {
          cambios.codigo = encabezado.codigo.trim();
        }
        if (encabezado.fecha !== baseEncabezado.fecha) cambios.fecha = encabezado.fecha;
        const actualizada = await updateElaboracion(servidor.id, cambios);
        const nuevaBase = encabezadoDesdeElaboracion(actualizada);
        setBaseEncabezado(nuevaBase);
        setEncabezado(nuevaBase);
        setServidor(actualizada);
      }
      const detalle = await replaceUsos(servidor.id, usosPayload(lineas));
      aplicarServidor(detalle);
      for (const uso of detalle.usos) {
        if (uso.insumo) void cargarLotes(uso.insumo.id, true);
      }
      setSaved(true);
      return true;
    } catch (err) {
      mapearError(err, SAVE_ERROR);
      return false;
    } finally {
      setSaving(false);
    }
  }

  /**
   * Saves pending changes first, then checks what the screen already knows is missing.
   * Returns true when the confirmation dialog can open; the server still has the last word.
   */
  async function prepararFinalizacion(): Promise<boolean> {
    if (dirty) {
      if (!(await guardar())) return false;
    } else {
      limpiarMensajes();
    }
    const locales: Record<number, MotivoProblema[]> = {};
    for (const linea of lineas) {
      const motivos: MotivoProblema[] = [];
      if (linea.ingredienteDesactivado) motivos.push("ingrediente_desactivado");
      if (!linea.insumoId) motivos.push("insumo");
      else if (lineaPendiente(linea)) motivos.push("lote");
      if (motivos.length > 0) locales[linea.ingrediente_id] = motivos;
    }
    if (Object.keys(locales).length > 0) {
      setProblemas(locales);
      setGlobalError(MENSAJE_LINEAS_CON_PROBLEMAS);
      return false;
    }
    return true;
  }

  async function finalizar(): Promise<void> {
    setGlobalError("");
    setProblemas({});
    setFinalizing(true);
    try {
      onFinalizada(await finalizarElaboracion(servidor.id));
    } catch (err) {
      mapearError(err, FINALIZE_ERROR);
    } finally {
      setFinalizing(false);
    }
  }

  async function eliminar(): Promise<void> {
    setGlobalError("");
    setDeleting(true);
    try {
      await deleteElaboracion(servidor.id);
      onEliminada();
    } catch (err) {
      mapearError(err, DELETE_ERROR);
    } finally {
      setDeleting(false);
    }
  }

  const insumosPorIngrediente = useMemo(() => {
    const mapa: Record<number, Insumo[]> = {};
    for (const insumo of insumos) {
      (mapa[insumo.ingrediente_id] ??= []).push(insumo);
    }
    return mapa;
  }, [insumos]);

  return {
    servidor,
    encabezado,
    lineas,
    erroresEncabezado,
    erroresLinea,
    problemas,
    globalError,
    errorFocusToken,
    saving,
    finalizing,
    deleting,
    busy,
    dirty,
    saved,
    insumosPorIngrediente,
    insumosLoading,
    insumosError,
    reintentarInsumos: loadInsumos,
    lotes,
    lotesError,
    reintentarLotes: (insumoId: number) => void cargarLotes(insumoId, true),
    cambiarEncabezado,
    elegirInsumo,
    elegirModoLote,
    cambiarLinea,
    usarLoteExistente,
    guardar,
    prepararFinalizacion,
    finalizar,
    eliminar,
  };
}
