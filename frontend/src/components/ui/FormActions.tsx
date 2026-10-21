import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Barra de acciones de formularios largos. Cancelar y la acción principal van lado a lado también
 * en el celular (dos columnas); un texto de estado puede ocupar la fila entera con `col-span-2`.
 * Tiene dos estados según el scroll:
 * - en reposo: el final del formulario ya es visible y la barra queda plana en su lugar;
 * - flotante: el final aún no se ve, la barra se fija al borde inferior, entra con un
 *   deslizamiento corto y se eleva con sombra para no perder Guardar y Cancelar.
 *
 * Se detecta con un IntersectionObserver sobre un marcador en la posición natural de
 * la barra, sin escuchar el scroll. La animación usa solo opacity y transform.
 */
export default function FormActions({ children }: { children: ReactNode }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setFloating(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <div
        data-floating={floating}
        className={`sticky bottom-0 z-10 grid grid-cols-2 gap-3 rounded-xl border bg-card px-4 py-3 transition-shadow duration-200 sm:flex sm:flex-row sm:justify-end sm:px-5 ${
          floating
            ? "form-actions-float border-border shadow-lift"
            : "border-transparent shadow-none"
        }`}
      >
        {children}
      </div>
    </>
  );
}
