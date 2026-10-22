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
    <div className="relative overflow-hidden rounded-2xl bg-brand-600 px-7 py-6">
      <svg
        className="absolute right-0 top-0 pointer-events-none opacity-10"
        width="260"
        height="140"
        viewBox="0 0 260 140"
        aria-hidden
      >
        <circle cx="200" cy="30" r="60" fill="white" />
        <circle cx="240" cy="100" r="40" fill="white" />
        <circle cx="130" cy="80" r="30" fill="white" />
        <line x1="200" y1="30" x2="240" y2="100" stroke="white" strokeWidth="2" />
        <line x1="200" y1="30" x2="130" y2="80" stroke="white" strokeWidth="2" />
      </svg>
      <p className="mb-1 text-xs font-medium text-panel-muted">{today}</p>
      <h1 className="mb-1 text-2xl font-semibold text-white">
        Hola, {firstName}
      </h1>
      {businessName?.trim() ? (
        <p className="mb-1 text-sm font-medium text-panel-soft">{businessName.trim()}</p>
      ) : null}
      <p className="max-w-2xl text-sm text-panel-soft">
        Registra tus elaboraciones, insumos y alérgenos, y mantén tu catálogo al día.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {/* La acción de cada semana va primero y es la única rellena. */}
        {onNuevaElaboracion && (
          <button
            type="button"
            onClick={onNuevaElaboracion}
            disabled={puedeRegistrarElaboracion !== true}
            aria-describedby={puedeRegistrarElaboracion === false ? "dashboard-sin-formulacion" : undefined}
            className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-medium text-brand-700 transition-colors hover:bg-white/90 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
          >
            Nueva elaboración
          </button>
        )}
        <Link
          to="/insumos/nuevo"
          className="inline-flex min-h-11 items-center rounded-lg border border-white/60 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-white"
        >
          Nuevo insumo
        </Link>
        <Link
          to="/productos/nuevo"
          className="inline-flex min-h-11 items-center rounded-lg border border-white/60 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-white"
        >
          Nuevo producto
        </Link>
      </div>
      {onNuevaElaboracion && puedeRegistrarElaboracion === false && (
        <p id="dashboard-sin-formulacion" className="mt-3 max-w-2xl text-sm text-panel-soft">
          {SIN_FORMULACION}.{" "}
          <Link
            to="/productos"
            className="font-medium text-white underline underline-offset-2 hover:text-white/90"
          >
            Ir a Productos
          </Link>
        </p>
      )}
    </div>
  );
}
