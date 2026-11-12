import { Link } from "react-router-dom";
import { RUTA_RASTREAR } from "@/lib/relacionadas";

/** The two views of Elaboraciones: the history and the tracing of a supply. Two pages, so two links. */
export default function ElaboracionesPestanas({ activa }: { activa: "historial" | "rastrear" }) {
  const item = (nombre: string, to: string, clave: "historial" | "rastrear") => {
    const actual = activa === clave;
    return (
      <Link
        to={to}
        aria-current={actual ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          actual ? "bg-brand-50 text-accent-strong" : "text-text-secondary hover:bg-surface hover:text-text-primary"
        }`}
      >
        {nombre}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Vistas de elaboraciones"
      className="inline-flex max-w-full self-start rounded-xl border border-border bg-card p-1 shadow-sm"
    >
      {item("Historial", "/elaboraciones", "historial")}
      {item("Rastrear insumo", RUTA_RASTREAR, "rastrear")}
    </nav>
  );
}
