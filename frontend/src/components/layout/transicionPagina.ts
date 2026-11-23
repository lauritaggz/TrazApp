import { useCallback, type MouseEvent } from "react";
import { useLocation } from "react-router-dom";

/**
 * Cambio de sección del menú (HT08). Cada página monta su propio AppShell, así que el
 * contenido entra con una animación CSS al montarse (`.app-page` en index.css). Aquí solo
 * se marca la dirección según el orden del menú: avanzar entra desde la derecha y
 * retroceder desde la izquierda. La navegación en sí es la normal de React Router.
 *
 * No se usa la View Transitions API: sus capturas se mezclaban sumando colores (un
 * destello en el menú y el encabezado) y se dibujaban encima del texto del menú.
 */
const ORDEN_SECCIONES = [
  "/dashboard",
  "/productos",
  "/ingredientes",
  "/insumos",
  "/elaboraciones",
  "/publicaciones",
  "/calculadora",
];

/**
 * Dirección de la próxima entrada. Se guarda aquí y la lee la página nueva al montarse:
 * cambiar un atributo en <html> reiniciaba la animación de la página que se iba.
 */
let direccion: "fwd" | "back" = "fwd";

export function direccionDeEntrada(): "fwd" | "back" {
  return direccion;
}

function indiceSeccion(path: string): number {
  return ORDEN_SECCIONES.findIndex(
    (base) => path === base || path.startsWith(`${base}/`),
  );
}

/** Devuelve un manejador de clic para enlaces del menú que fija la dirección de la entrada. */
export function useNavegacionAnimada() {
  const { pathname } = useLocation();

  return useCallback(
    (to: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const desde = indiceSeccion(pathname);
      const hacia = indiceSeccion(to);
      direccion = desde >= 0 && hacia >= 0 && hacia < desde ? "back" : "fwd";
      // Desde aquí las apariciones escalonadas (.reveal) ya no corren: basta la entrada de la página.
      document.documentElement.dataset.navSpa = "";
    },
    [pathname],
  );
}
