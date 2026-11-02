interface PaginationProps {
  /** From 1. */
  pagina: number;
  totalPaginas: number;
  /** «21–40 de 53». */
  rango: string;
  onChange: (pagina: number) => void;
  /** What is paginated, for the accessible name: «elaboraciones». */
  etiqueta: string;
}

/** Previous / next with «x–y de z» between them; both buttons are 44 px tall. */
export default function Pagination({ pagina, totalPaginas, rango, onChange, etiqueta }: PaginationProps) {
  return (
    <nav
      aria-label={`Paginación de ${etiqueta}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 sm:px-4"
    >
      <button
        type="button"
        onClick={() => onChange(pagina - 1)}
        disabled={pagina <= 1}
        className="inline-flex min-h-11 items-center rounded-lg border border-border-strong bg-card px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
      >
        Anterior
      </button>
      <p aria-live="polite" className="text-center text-sm text-text-secondary">
        {rango}
      </p>
      <button
        type="button"
        onClick={() => onChange(pagina + 1)}
        disabled={pagina >= totalPaginas}
        className="inline-flex min-h-11 items-center rounded-lg border border-border-strong bg-card px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
      >
        Siguiente
      </button>
    </nav>
  );
}
