import type { ReactNode } from "react";

/**
 * Barra de acciones de formularios largos: queda fija al borde inferior mientras
 * el botón de guardar no es visible y se integra al final de la tarjeta del formulario.
 */
export default function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-6 flex flex-col-reverse gap-3 rounded-b-xl border-t border-border bg-card px-5 py-4 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6">
      {children}
    </div>
  );
}
