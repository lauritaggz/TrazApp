import type { ReactNode } from "react";

/**
 * Barra de acciones de formularios largos: queda fija al borde inferior mientras
 * el botón de guardar no es visible y flota sobre el contenido para no perder las acciones.
 */
export default function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-lift sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}
