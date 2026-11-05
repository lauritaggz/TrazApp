import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  FILTROS_VACIOS,
  aParams,
  leerFiltros,
  parametrosDeLaPagina,
  rangoInvalido,
  ultimaPagina,
  type FiltrosHistorial,
} from "@/lib/historialElaboraciones";
import { listElaboraciones } from "@/services/elaboracionService";
import type { ElaboracionResumen } from "@/types/elaboracion";

/** How long the code search waits after the last key before asking the server. */
export const ESPERA_BUSQUEDA_MS = 400;

/**
 * The history of elaboraciones (HU06): the filters live in the URL (`?producto=&estado=&desde=&hasta=&codigo=&pagina=`)
 * so the back button and the links keep them. Changing a filter or the page is a new history entry; typing the
 * code replaces the current one, and the server is asked once the typing stopped (or at once with Enter).
 */
export function useHistorialElaboraciones() {
  const [searchParams, setSearchParamsDeRouter] = useSearchParams();
  // `setSearchParams` is a new function whenever the URL changes: the effects must not depend on it, or every
  // change of the URL would ask the server twice.
  const paramsRef = useRef(setSearchParamsDeRouter);
  paramsRef.current = setSearchParamsDeRouter;
  const setSearchParams = useCallback<typeof setSearchParamsDeRouter>(
    (siguiente, opciones) => paramsRef.current(siguiente, opciones),
    [],
  );
  const filtros = useMemo(() => leerFiltros(searchParams), [searchParams]);
  const claveFiltros = searchParams.toString();

  const [items, setItems] = useState<ElaboracionResumen[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);

  // --- the code: typed text (local) and what the URL carries ---
  const [codigoTexto, setCodigoTexto] = useState(filtros.codigo);
  const codigoAplicado = useRef(filtros.codigo);
  const codigoEsperado = useDebouncedValue(codigoTexto.trim(), ESPERA_BUSQUEDA_MS);

  const aplicarCodigo = useCallback((texto: string) => {
    const codigo = texto.trim();
    if (codigo === codigoAplicado.current) return;
    codigoAplicado.current = codigo;
    setSearchParams((actual) => aParams({ ...leerFiltros(actual), codigo, pagina: 1 }), { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    aplicarCodigo(codigoEsperado);
  }, [codigoEsperado, aplicarCodigo]);

  // A code that changed from outside (Limpiar filtros, back button, a link) goes back into the field.
  useEffect(() => {
    if (filtros.codigo !== codigoAplicado.current) {
      codigoAplicado.current = filtros.codigo;
      setCodigoTexto(filtros.codigo);
    }
  }, [filtros.codigo]);

  // --- the page of the list ---
  const fechasInvalidas = rangoInvalido(filtros);
  useEffect(() => {
    if (fechasInvalidas) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setError(false);
      return;
    }
    let vigente = true;
    setLoading(true);
    setError(false);
    listElaboraciones(parametrosDeLaPagina(filtros)).then(
      (pagina) => {
        if (!vigente) return;
        // A page beyond the last one (an old link): go to the last that has something.
        if (pagina.items.length === 0 && pagina.total > 0 && filtros.pagina > ultimaPagina(pagina.total)) {
          setSearchParams(aParams({ ...filtros, pagina: ultimaPagina(pagina.total) }), { replace: true });
          return;
        }
        setItems(pagina.items);
        setTotal(pagina.total);
        setLoading(false);
      },
      () => {
        if (!vigente) return;
        setError(true);
        setLoading(false);
      },
    );
    return () => {
      vigente = false;
    };
    // `claveFiltros` stands for `filtros`: the object is new on every render of the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveFiltros, fechasInvalidas, recarga, setSearchParams]);

  /** Changes some filters: a new history entry and back to the first page. */
  const cambiarFiltros = useCallback(
    (cambios: Partial<FiltrosHistorial>) => {
      setSearchParams(aParams({ ...filtros, ...cambios, pagina: 1 }));
    },
    [filtros, setSearchParams],
  );

  const irAPagina = useCallback(
    (pagina: number) => {
      setSearchParams(aParams({ ...filtros, pagina }));
    },
    [filtros, setSearchParams],
  );

  const limpiar = useCallback(() => {
    codigoAplicado.current = "";
    setCodigoTexto("");
    setSearchParams(aParams(FILTROS_VACIOS));
  }, [setSearchParams]);

  return {
    filtros,
    items,
    total,
    loading,
    error,
    fechasInvalidas,
    codigoTexto,
    setCodigoTexto,
    /** Enter in the code field: ask now, without waiting. */
    buscarCodigoYa: () => aplicarCodigo(codigoTexto),
    cambiarFiltros,
    irAPagina,
    limpiar,
    recargar: () => setRecarga((n) => n + 1),
  };
}
