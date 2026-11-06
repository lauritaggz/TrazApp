import { useCallback, useEffect, useRef, useState } from "react";
import type { ResultadoBusqueda } from "@/hooks/useBusquedaCodigoBarras";
import { duplicadoDe } from "@/lib/insumoDuplicado";
import { buscarPorNombre, consultarResultadoDeBusqueda } from "@/services/insumoService";
import { ApiError } from "@/types/auth";
import type { ConsultaCodigo, ResultadoBusquedaNombre } from "@/types/consultaCodigo";
import type { InsumoDuplicateInfo } from "@/types/insumo";

export const TEXTO_MINIMO = 2;
export const MENSAJE_TEXTO_CORTO = `Escribe al menos ${TEXTO_MINIMO} letras para buscar.`;

export type EstadoBusquedaNombre =
  | "inactivo"
  | "buscando"
  | "con_resultados"
  | "sin_resultados"
  | "invalido"
  | "no_disponible"
  | "error"
  | "cargando_ficha"
  | "encontrado"
  | "duplicado"
  | "ficha_no_encontrada"
  | "ficha_no_disponible"
  | "ficha_error";

interface Options {
  /** Called once per hit that ends with a product to preload into the form. */
  onResultado?: (resultado: ResultadoBusqueda) => void;
}

/**
 * The search by name or brand of the supply form (HU07): ask the backend for hits, let the productor pick
 * one and report its proposal. It only reads: nothing is registered, and when the source cannot answer the
 * form is left as it was (CA10).
 */
export function useBusquedaPorNombre({ onResultado }: Options = {}) {
  const [estado, setEstado] = useState<EstadoBusquedaNombre>("inactivo");
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusquedaNombre[]>([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<ConsultaCodigo | null>(null);
  const [duplicado, setDuplicado] = useState<InsumoDuplicateInfo | null>(null);
  const [mensaje, setMensaje] = useState("");
  const ocupadoRef = useRef(false);
  // An answer that belongs to an older request (or to an unmounted screen) is dropped.
  const vigenteRef = useRef(0);
  const onResultadoRef = useRef(onResultado);
  useEffect(() => {
    onResultadoRef.current = onResultado;
  });
  useEffect(
    () => () => {
      vigenteRef.current += 1;
    },
    [],
  );

  const limpiar = useCallback(() => {
    vigenteRef.current += 1;
    ocupadoRef.current = false;
    setEstado("inactivo");
    setTexto("");
    setResultados([]);
    setElegido(null);
    setConsulta(null);
    setDuplicado(null);
    setMensaje("");
  }, []);

  const buscar = useCallback(async (textoBuscado: string) => {
    if (ocupadoRef.current) return;
    const limpio = textoBuscado.trim().replace(/\s+/g, " ");
    setTexto(limpio);
    setResultados([]);
    setElegido(null);
    setConsulta(null);
    setDuplicado(null);
    setMensaje("");
    if (limpio.length < TEXTO_MINIMO) {
      setMensaje(MENSAJE_TEXTO_CORTO);
      setEstado("invalido");
      return;
    }
    ocupadoRef.current = true;
    const numero = ++vigenteRef.current;
    setEstado("buscando");
    try {
      const hallados = await buscarPorNombre(limpio);
      if (numero !== vigenteRef.current) return;
      setResultados(hallados);
      setEstado(hallados.length > 0 ? "con_resultados" : "sin_resultados");
    } catch (error) {
      if (numero !== vigenteRef.current) return;
      if (error instanceof ApiError && error.status === 422) {
        setMensaje(error.message);
        setEstado("invalido");
        return;
      }
      setEstado(error instanceof ApiError && error.status === 503 ? "no_disponible" : "error");
    } finally {
      if (numero === vigenteRef.current) ocupadoRef.current = false;
    }
  }, []);

  const elegir = useCallback(async (resultado: ResultadoBusquedaNombre) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    const numero = ++vigenteRef.current;
    setElegido(resultado.id);
    setConsulta(null);
    setDuplicado(null);
    setMensaje("");
    setEstado("cargando_ficha");
    try {
      const respuesta = await consultarResultadoDeBusqueda(resultado.id);
      if (numero !== vigenteRef.current) return;
      setConsulta(respuesta);
      setEstado("encontrado");
      onResultadoRef.current?.({ tipo: "encontrado", consulta: respuesta });
    } catch (error) {
      if (numero !== vigenteRef.current) return;
      if (error instanceof ApiError && error.status === 409) {
        const existente = duplicadoDe(error);
        if (existente) {
          setDuplicado(existente);
          setEstado("duplicado");
          return;
        }
        setEstado("ficha_error");
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        setMensaje(error.message);
        setEstado("ficha_no_encontrada");
        return;
      }
      setEstado(error instanceof ApiError && error.status === 503 ? "ficha_no_disponible" : "ficha_error");
    } finally {
      if (numero === vigenteRef.current) ocupadoRef.current = false;
    }
  }, []);

  return { estado, texto, resultados, elegido, consulta, duplicado, mensaje, buscar, elegir, limpiar };
}

export type BusquedaPorNombre = ReturnType<typeof useBusquedaPorNombre>;
