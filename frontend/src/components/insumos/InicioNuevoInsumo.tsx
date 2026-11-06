import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export const METODOS_NUEVO_INSUMO = ["codigo", "nombre", "manual"] as const;
export type MetodoNuevoInsumo = (typeof METODOS_NUEVO_INSUMO)[number];

export function esMetodoNuevoInsumo(valor: string | undefined): valor is MetodoNuevoInsumo {
  return METODOS_NUEVO_INSUMO.includes(valor as MetodoNuevoInsumo);
}

interface OpcionProps {
  to: string;
  titulo: string;
  descripcion: string;
  accion: string;
  principal?: boolean;
  icono: ReactNode;
}

function Opcion({ to, titulo, descripcion, accion, principal = false, icono }: OpcionProps) {
  return (
    <Link
      to={to}
      className={`flex min-h-11 flex-col gap-3 rounded-xl border p-5 shadow-soft transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
        principal ? "border-brand-200 bg-brand-50 hover:bg-brand-50/70" : "border-border bg-card hover:bg-surface"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
          principal ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600"
        }`}
      >
        {icono}
      </span>
      <span className="space-y-1">
        <span className="block text-base font-semibold text-text-primary">{titulo}</span>
        <span className="block text-[13px] leading-relaxed text-text-secondary">{descripcion}</span>
      </span>
      <span className="mt-auto text-sm font-semibold text-accent-strong">{accion}</span>
    </Link>
  );
}

const trazo = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * The first screen of a new supply (HU07): how to start it. Each option opens the same supply form, with the
 * block that fits it. Nothing is saved from here: the productor confirms by saving the form (CA9).
 */
export default function InicioNuevoInsumo() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary">¿Cómo quieres registrar el insumo?</h2>
        <p className="max-w-2xl text-sm text-text-secondary">
          Puedes recuperar información pública del producto o completar la ficha manualmente. Nada se guarda sin tu
          confirmación.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Opcion
          principal
          to="/insumos/nuevo/codigo"
          titulo="Escanear código de barras"
          descripcion="Usa la cámara del celular o escribe el número que aparece en el envase."
          accion="Comenzar escaneo"
          icono={
            <svg width="22" height="22" viewBox="0 0 24 24" {...trazo}>
              <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M12 8v8M16 8v8" />
            </svg>
          }
        />
        <Opcion
          to="/insumos/nuevo/nombre"
          titulo="Buscar por nombre o marca"
          descripcion="Encuentra el producto en el catálogo de Jumbo y elige la presentación correcta."
          accion="Buscar producto"
          icono={
            <svg width="22" height="22" viewBox="0 0 24 24" {...trazo}>
              <circle cx="11" cy="11" r="6" />
              <path d="m20 20-4-4" />
            </svg>
          }
        />
        <Opcion
          to="/insumos/nuevo/manual"
          titulo="Ingresar manualmente"
          descripcion="Completa todos los datos mirando directamente el envase del producto."
          accion="Crear ficha manual"
          icono={
            <svg width="22" height="22" viewBox="0 0 24 24" {...trazo}>
              <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
            </svg>
          }
        />
      </div>

      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <p className="text-sm font-semibold text-text-primary">Tú decides qué se registra</p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Las fuentes solo preparan un borrador. Podrás editar cada campo y revisar los alérgenos con el envase a la
          vista antes de confirmar.
        </p>
      </div>
    </div>
  );
}
