import { useCallback, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Transición entre secciones del menú (HT08) con la View Transitions API.
 * La página sale hacia un lado y entra desde el otro según el orden del menú:
 * avanzar en el menú desliza hacia la izquierda; retroceder, hacia la derecha.
 * Sin la API o con `prefers-reduced-motion`, la navegación es la normal.
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

function indiceSeccion(path: string): number {
  return ORDEN_SECCIONES.findIndex(
    (base) => path === base || path.startsWith(`${base}/`),
  );
}

type DocumentoConTransicion = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * El título de la página (su primer h1) se anima aparte, solo con un fundido en su lugar:
 * texto grande desplazándose en fracciones de píxel se ve tembloroso. Se marca uno solo
 * a la vez, porque dos elementos con el mismo nombre cancelan la transición.
 */
const NOMBRE_TITULO = "page-title";

function marcarTitulo(): HTMLElement | null {
  const titulo = document.querySelector<HTMLElement>(".app-page h1");
  if (titulo) titulo.style.viewTransitionName = NOMBRE_TITULO;
  return titulo;
}

function puedeAnimar(): boolean {
  const doc = document as DocumentoConTransicion;
  if (typeof doc.startViewTransition !== "function") return false;
  if (typeof window.matchMedia !== "function") return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Devuelve un manejador de clic para enlaces del menú que anima el cambio de página. */
export function useNavegacionAnimada() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback(
    (to: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !puedeAnimar()
      ) {
        return;
      }
      const desde = indiceSeccion(pathname);
      const hacia = indiceSeccion(to);
      if (desde === hacia && pathname === to) return;

      event.preventDefault();
      const raiz = document.documentElement;
      raiz.dataset.navDir = desde >= 0 && hacia >= 0 && hacia < desde ? "back" : "fwd";
      // Desde aquí las apariciones escalonadas (.reveal) ya no corren: la transición basta.
      // No se quita al terminar: reactivarlas haría parpadear el contenido ya visible.
      raiz.dataset.navSpa = "";
      const viejo = marcarTitulo();
      let nuevo: HTMLElement | null = null;
      const transicion = (document as DocumentoConTransicion).startViewTransition!(() => {
        flushSync(() => navigate(to));
        window.scrollTo(0, 0);
        if (viejo) viejo.style.viewTransitionName = "";
        nuevo = marcarTitulo();
      });
      void transicion.finished.finally(() => {
        if (nuevo) nuevo.style.viewTransitionName = "";
      });
    },
    [navigate, pathname],
  );
}
