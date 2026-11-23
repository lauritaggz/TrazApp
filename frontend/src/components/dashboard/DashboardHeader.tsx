import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

interface DashboardHeaderProps {
  firstName: string;
  businessName?: string | null;
  /**
   * HT06-07, «Nueva elaboración»: true = enabled; false = there is no product with a formulation
   * (disabled, with the reason and a link to Productos); null = still unknown (disabled, silent).
   */
  puedeRegistrarElaboracion?: boolean | null;
  onNuevaElaboracion?: () => void;
}

const SIN_FORMULACION = "Define la formulación de un producto para crear elaboraciones";

export default function DashboardHeader({
  firstName,
  businessName,
  puedeRegistrarElaboracion = null,
  onNuevaElaboracion,
}: DashboardHeaderProps) {
  const fecha = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // «Miércoles, 21 de octubre»: solo la primera letra en mayúscula (`capitalize` pondría «De Octubre»).
  const today = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return (
    <section aria-label="Bienvenida" className="space-y-5 pt-1">
      <div className="space-y-1.5">
        <p className="reveal text-[13px] font-medium text-text-muted" style={{ "--i": 0 } as CSSProperties}>
          {today}
        </p>
        <h1
          className="reveal text-[2rem] leading-[1.1] font-bold text-text-primary sm:text-[2.5rem]"
          style={{ "--i": 1 } as CSSProperties}
        >
          Hola, <span className="text-accent">{firstName}</span>
        </h1>
        {businessName?.trim() ? (
          <p className="reveal text-sm font-semibold text-text-secondary" style={{ "--i": 2 } as CSSProperties}>
            {businessName.trim()}
          </p>
        ) : null}
        <p
          className="reveal max-w-[52ch] text-[15px] leading-relaxed text-text-secondary"
          style={{ "--i": 2 } as CSSProperties}
        >
          Registra tus elaboraciones, insumos y alérgenos, y mantén tu catálogo al día.
        </p>
      </div>

      <div className="reveal flex flex-wrap gap-2.5" style={{ "--i": 3 } as CSSProperties}>
        {/* La acción de cada semana va primero y es la única rellena. */}
        {onNuevaElaboracion && (
          <button
            type="button"
            onClick={onNuevaElaboracion}
            disabled={puedeRegistrarElaboracion !== true}
            aria-describedby={puedeRegistrarElaboracion === false ? "dashboard-sin-formulacion" : undefined}
            className={`${ACCION} w-full bg-brand-600 text-on-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_6px_16px_-8px_var(--color-brand-600)] hover:bg-brand-700 active:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-brand-600 disabled:active:scale-100 sm:w-auto`}
          >
            <PlusIcon />
            Nueva elaboración
          </button>
        )}
        <Link
          to="/insumos/nuevo"
          className={`${ACCION} flex-1 border border-border bg-card text-text-primary hover:border-border-strong sm:flex-none`}
        >
          Nuevo insumo
        </Link>
        <Link
          to="/productos/nuevo"
          className={`${ACCION} flex-1 border border-border bg-card text-text-primary hover:border-border-strong sm:flex-none`}
        >
          Nuevo producto
        </Link>
      </div>
      {onNuevaElaboracion && puedeRegistrarElaboracion === false && (
        <p
          id="dashboard-sin-formulacion"
          className="max-w-2xl rounded-xl border border-border-soft bg-panel px-3.5 py-2.5 text-sm text-text-secondary"
        >
          {SIN_FORMULACION}.{" "}
          <Link
            to="/productos"
            className="font-semibold text-accent-strong underline underline-offset-2"
          >
            Ir a Productos
          </Link>
        </p>
      )}
    </section>
  );
}

const ACCION =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-[background-color,border-color,transform] duration-150 active:translate-y-px active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
