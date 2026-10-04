import { useCallback, useEffect, useState } from "react";

/**
 * Protege un formulario con cambios sin guardar:
 * - al cerrar o recargar la pestaña, usa el aviso nativo del navegador;
 * - al pulsar un enlace interno (menú, migas, logo), cancela la navegación y
 *   expone el destino en `pendingHref` para que la página pida confirmación.
 *
 * `useBlocker` de React Router requiere un data router; la app usa BrowserRouter,
 * por eso se intercepta el clic en los enlaces.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function handleClick(event: MouseEvent) {
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
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;

      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//")) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [dirty]);

  const clearPending = useCallback(() => setPendingHref(null), []);

  return { pendingHref, clearPending };
}
