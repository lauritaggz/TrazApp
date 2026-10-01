import { useCallback, useState } from "react";

export type ListView = "lista" | "cuadricula";

const STORAGE_KEY = "trazapp_vista_productos";

function readStored(): ListView {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "cuadricula"
      ? "cuadricula"
      : "lista";
  } catch {
    return "lista";
  }
}

/** Vista del listado de productos, recordada entre visitas. Sin almacenamiento, usa lista. */
export function useStoredView(): [ListView, (view: ListView) => void] {
  const [view, setView] = useState<ListView>(readStored);

  const update = useCallback((next: ListView) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // La preferencia es opcional: si no se puede guardar, solo vale esta sesión.
    }
  }, []);

  return [view, update];
}
