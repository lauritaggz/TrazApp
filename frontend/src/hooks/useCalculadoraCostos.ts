import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toastContext";
import {
  borradorDesde,
  construirPayload,
  hayCambios,
  hayErrores,
  validarBorrador,
  type Borrador,
  type BorradorLinea,
  type ErroresBorrador,
} from "@/lib/costosCalculadora";
import { guardarCostos, obtenerCostos } from "@/services/costosService";
import { ApiError } from "@/types/auth";
import type { Alternativas, CostosProducto } from "@/types/costos";

export const MENSAJE_RED_COSTOS = "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
const MENSAJE_GENERICO = "No pudimos completar la operación. Inténtalo de nuevo.";

export type EstadoCostos = "cargando" | "listo" | "no-encontrado" | "error";

const SIN_ERRORES: ErroresBorrador = { lineas: {}, otros: {} };

function mensajeDe(err: unknown): string {
  if (err instanceof ApiError && err.status === 0) return MENSAJE_RED_COSTOS;
  if (err instanceof ApiError && err.status === 422) return err.message;
  return MENSAJE_GENERICO;
}

function ingredienteDe(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null;
  const detalle = err.detail;
  if (!detalle || typeof detalle !== "object" || Array.isArray(detalle)) return null;
  const id = (detalle as { ingrediente_id?: unknown }).ingrediente_id;
  return typeof id === "number" ? id : null;
}

/**
 * La calculadora de costos de UN producto (HU14): lectura, borrador editable, insumo alternativo y guardado.
 *
 * - Lo guardado (`datos`) y lo que se está escribiendo (`borrador`) son distintos: el costo se recalcula en el
 *   servidor al guardar, nunca con lo que aún no se guardó.
 * - El insumo alternativo vive solo aquí, en el estado: no va a la URL ni al almacenamiento y se borra al
 *   cambiar de producto. Al recargar la página se vuelve a la preselección.
 */
export function useCalculadoraCostos(productoId: number | null) {
  const { notify } = useToast();
  const [estado, setEstado] = useState<EstadoCostos>("cargando");
  const [datos, setDatos] = useState<CostosProducto | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [alternativas, setAlternativas] = useState<Alternativas>({});
  const [recalculando, setRecalculando] = useState(false);
  const [errorRecalculo, setErrorRecalculo] = useState("");
  const [errores, setErrores] = useState<ErroresBorrador>(SIN_ERRORES);
  const [guardando, setGuardando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [errorDeLinea, setErrorDeLinea] = useState<{ ingredienteId: number; mensaje: string } | null>(null);

  const claveNueva = useRef(0);
  const enCurso = useRef<AbortController | null>(null);
  const guardandoRef = useRef(false);
  const ultimoIntento = useRef<Alternativas>({});

  const cargar = useCallback(
    async (id: number, alternativasPedidas: Alternativas, inicial: boolean) => {
      enCurso.current?.abort();
      const control = new AbortController();
      enCurso.current = control;
      if (inicial) setEstado("cargando");
      else setRecalculando(true);
      setErrorRecalculo("");
      ultimoIntento.current = alternativasPedidas;
      try {
        const respuesta = await obtenerCostos(id, alternativasPedidas, control.signal);
        if (control.signal.aborted) return;
        setDatos(respuesta);
        setAlternativas(alternativasPedidas);
        if (inicial) setBorrador(borradorDesde(respuesta));
        setEstado("listo");
      } catch (err) {
        if (control.signal.aborted) return;
        if (err instanceof ApiError && err.status === 404) {
          setEstado("no-encontrado");
          return;
        }
        // Al recalcular con otro insumo se conserva el último cálculo bueno y se avisa del fallo.
        if (inicial) setEstado("error");
        else setErrorRecalculo(mensajeDe(err));
      } finally {
        if (!control.signal.aborted) setRecalculando(false);
      }
    },
    [],
  );

  // Cambio de producto: todo parte de cero (el insumo alternativo también).
  useEffect(() => {
    enCurso.current?.abort();
    setDatos(null);
    setBorrador(null);
    setAlternativas({});
    setErrores(SIN_ERRORES);
    setErrorGeneral("");
    setErrorDeLinea(null);
    setErrorRecalculo("");
    ultimoIntento.current = {};
    if (productoId === null) return;
    void cargar(productoId, {}, true);
    return () => enCurso.current?.abort();
  }, [productoId, cargar]);

  const sucio = datos !== null && borrador !== null && hayCambios(datos, borrador);

  function limpiarAvisos() {
    setErrorGeneral("");
    setErrorDeLinea(null);
  }

  function cambiarRendimiento(valor: string) {
    setBorrador((b) => (b ? { ...b, rendimiento: valor } : b));
    setErrores((e) => ({ ...e, rendimiento: undefined }));
  }

  function cambiarLinea(ingredienteId: number, cambios: Partial<BorradorLinea>) {
    setBorrador((b) =>
      b
        ? {
            ...b,
            lineas: {
              ...b.lineas,
              [ingredienteId]: { ...(b.lineas[ingredienteId] ?? { cantidad: "", unidad: "" }), ...cambios },
            },
          }
        : b,
    );
    setErrores((e) => {
      if (!e.lineas[ingredienteId]) return e;
      const { [ingredienteId]: _quitada, ...resto } = e.lineas;
      return { ...e, lineas: resto };
    });
    setErrorDeLinea((actual) => (actual?.ingredienteId === ingredienteId ? null : actual));
  }

  function agregarOtroCosto() {
    claveNueva.current -= 1;
    const clave = claveNueva.current;
    setBorrador((b) => (b ? { ...b, otros: [...b.otros, { clave, nombre: "", monto: "" }] } : b));
  }

  function cambiarOtroCosto(clave: number, cambios: { nombre?: string; monto?: string }) {
    setBorrador((b) => (b ? { ...b, otros: b.otros.map((o) => (o.clave === clave ? { ...o, ...cambios } : o)) } : b));
    setErrores((e) => {
      if (!e.otros[clave]) return e;
      const { [clave]: _quitada, ...resto } = e.otros;
      return { ...e, otros: resto, otrosExceso: undefined };
    });
  }

  function quitarOtroCosto(clave: number) {
    setBorrador((b) => (b ? { ...b, otros: b.otros.filter((o) => o.clave !== clave) } : b));
    setErrores((e) => {
      const { [clave]: _quitada, ...resto } = e.otros;
      return { ...e, otros: resto, otrosExceso: undefined };
    });
  }

  /** Elige otro insumo para ESTE cálculo; no se guarda. Los cambios sin guardar del borrador no se pierden. */
  function elegirInsumo(ingredienteId: number, insumoId: number) {
    if (productoId === null) return;
    void cargar(productoId, { ...alternativas, [ingredienteId]: insumoId }, false);
  }

  /** Vuelve a calcular con lo guardado y el insumo alternativo vigente, sin tocar el borrador. */
  function recalcular() {
    if (productoId !== null) void cargar(productoId, alternativas, false);
  }

  function reintentarRecalculo() {
    if (productoId !== null) void cargar(productoId, ultimoIntento.current, false);
  }

  function reintentarCarga() {
    if (productoId !== null) void cargar(productoId, alternativas, true);
  }

  function descartar() {
    if (datos) setBorrador(borradorDesde(datos));
    setErrores(SIN_ERRORES);
    limpiarAvisos();
  }

  async function guardar() {
    if (productoId === null || !datos || !borrador || guardandoRef.current) return;
    limpiarAvisos();
    const encontrados = validarBorrador(borrador);
    setErrores(encontrados);
    if (hayErrores(encontrados)) return;
    const payload = construirPayload(datos, borrador);
    if (Object.keys(payload).length === 0) return;

    guardandoRef.current = true;
    setGuardando(true);
    try {
      const respuesta = await guardarCostos(productoId, payload, alternativas);
      setDatos(respuesta);
      setBorrador(borradorDesde(respuesta));
      setErrores(SIN_ERRORES);
      setErrorRecalculo("");
      notify("Cambios guardados.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setEstado("no-encontrado");
        return;
      }
      const ingredienteId = ingredienteDe(err);
      if (ingredienteId !== null && err instanceof ApiError) {
        setErrorDeLinea({ ingredienteId, mensaje: err.message });
      } else {
        setErrorGeneral(mensajeDe(err));
      }
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  return {
    estado,
    datos,
    borrador,
    alternativas,
    recalculando,
    errorRecalculo,
    errores,
    guardando,
    errorGeneral,
    errorDeLinea,
    sucio,
    cambiarRendimiento,
    cambiarLinea,
    agregarOtroCosto,
    cambiarOtroCosto,
    quitarOtroCosto,
    elegirInsumo,
    recalcular,
    reintentarRecalculo,
    reintentarCarga,
    descartar,
    guardar,
  };
}
