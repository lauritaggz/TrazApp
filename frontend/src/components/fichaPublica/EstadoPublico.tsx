import type { ReactNode } from "react";

interface EstadoPublicoProps {
  icono: ReactNode;
  etiqueta: string;
  titulo: string;
  descripcion: string;
  /** Inside the ficha (a card) instead of taking the whole page. */
  compacto?: boolean;
  children?: ReactNode;
}

/** A state with no data to show (not available, no elaboraciones, error...). Same look as the design's. */
export default function EstadoPublico({
  icono,
  etiqueta,
  titulo,
  descripcion,
  compacto = false,
  children,
}: EstadoPublicoProps) {
  const Titulo = compacto ? "h2" : "h1";
  return (
    <div
      className={
        compacto
          ? "my-4 rounded-xl border border-border bg-card px-5 py-9 text-center"
          : "mx-auto max-w-md px-6 py-20 text-center"
      }
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-accent">
        {icono}
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">{etiqueta}</p>
      <Titulo className={`${compacto ? "text-lg" : "text-xl"} font-semibold text-text-primary`}>{titulo}</Titulo>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{descripcion}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
