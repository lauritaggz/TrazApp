import { useCallback, useEffect, useRef, useState } from "react";
import { validarCodigoBarras } from "@/lib/codigoBarras";
import { duplicadoDe } from "@/lib/insumoDuplicado";
import { consultarCodigoBarras } from "@/services/insumoService";
import { ApiError } from "@/types/auth";
import type { ConsultaCodigo } from "@/types/consultaCodigo";
import type { InsumoDuplicateInfo } from "@/types/insumo";

export type EstadoBusqueda =
  | "inactivo"
  | "escaneando"
  | "buscando"
  | "encontrado"
  | "no_encontrado"
  | "duplicado"
  | "no_disponible"
  | "invalido"
  | "error";

/** What the screen has to do with the form when a lookup ends without a duplicate. */
export type ResultadoBusqueda =
  | { tipo: "encontrado"; consulta: ConsultaCodigo }
  | { tipo: "no_encontrado"; codigo: string }
  | { tipo: "no_disponible"; codigo: string };

interface Options {
  /** Called once per lookup that ends with a product, a miss or an unavailable source. */
  onResultado?: (resultado: ResultadoBusqueda) => void;
}

/**
 * The barcode lookup of the supply form (HU13): open the scanner, receive a code (camera or typed),
 * ask the backend and report what happened. The scanner closes as soon as it delivers a code and no
 * second code is taken while a lookup is running. A lookup only reads: it registers nothing.
 */
export function useBusquedaCodigoBarras({ onResultado }: Options = {}) {
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const [base, setBase] = useState<Exclude<EstadoBusqueda, "escaneando">>("inactivo");
  const [codigo, setCodigo] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<ConsultaCodigo | null>(null);
  const [duplicado, setDuplicado] = useState<InsumoDuplicateInfo | null>(null);
  const [mensajeInvalido, setMensajeInvalido] = useState("");

  const buscandoRef = useRef(false);
  // Each lookup takes a number; an answer that belongs to an older one (or to an unmounted screen) is dropped.
  const busquedaVigenteRef = useRef(0);
  const onResultadoRef = useRef(onResultado);

  useEffect(() => {
    onResultadoRef.current = onResultado;
  });

  useEffect(
    () => () => {
      busquedaVigenteRef.current += 1;
    },
    [],
  );

  const abrirEscaner = useCallback(() => {
    if (buscandoRef.current) return;
    setEscanerAbierto(true);
  }, []);

  const cerrarEscaner = useCallback(() => {
    setEscanerAbierto(false);
  }, []);

  /** Back to the start: forgets the last lookup (for example when the productor keeps what they typed). */
  const limpiar = useCallback(() => {
    busquedaVigenteRef.current += 1;
    buscandoRef.current = false;
    setEscanerAbierto(false);
    setBase("inactivo");
    setCodigo(null);
    setConsulta(null);
    setDuplicado(null);
    setMensajeInvalido("");
  }, []);

  const buscar = useCallback(async (codigoLeido: string) => {
    // The scanner has delivered its code: it closes, and nothing else is accepted until this ends.
    if (buscandoRef.current) return;
    setEscanerAbierto(false);
    setCodigo(codigoLeido);
    setConsulta(null);
    setDuplicado(null);
    setMensajeInvalido("");

    const invalido = validarCodigoBarras(codigoLeido);
    if (invalido) {
      setMensajeInvalido(invalido);
      setBase("invalido");
      return;
    }

    buscandoRef.current = true;
    const numero = ++busquedaVigenteRef.current;
    setBase("buscando");
    try {
      const respuesta = await consultarCodigoBarras(codigoLeido);
      if (numero !== busquedaVigenteRef.current) return;
      setConsulta(respuesta);
      if (respuesta.encontrado) {
        setBase("encontrado");
        onResultadoRef.current?.({ tipo: "encontrado", consulta: respuesta });
      } else {
        setBase("no_encontrado");
        onResultadoRef.current?.({ tipo: "no_encontrado", codigo: codigoLeido });
      }
    } catch (error) {
      if (numero !== busquedaVigenteRef.current) return;
      if (error instanceof ApiError && error.status === 409) {
        const existente = duplicadoDe(error);
        if (existente) {
          setDuplicado(existente);
          setBase("duplicado");
          return;
        }
        // A conflict that does not say which supply it is about: not "the source is down".
        setBase("error");
        return;
      }
      if (error instanceof ApiError && error.status === 422) {
        setMensajeInvalido(error.message);
        setBase("invalido");
        return;
      }
      setBase("no_disponible");
      onResultadoRef.current?.({ tipo: "no_disponible", codigo: codigoLeido });
    } finally {
      if (numero === busquedaVigenteRef.current) buscandoRef.current = false;
    }
  }, []);

  const estado: EstadoBusqueda = escanerAbierto ? "escaneando" : base;

  return {
    estado,
    codigo,
    consulta,
    duplicado,
    mensajeInvalido,
    escanerAbierto,
    abrirEscaner,
    cerrarEscaner,
    buscar,
    limpiar,
  };
}

export type BusquedaCodigoBarras = ReturnType<typeof useBusquedaCodigoBarras>;
