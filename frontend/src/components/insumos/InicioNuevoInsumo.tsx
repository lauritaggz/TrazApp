import type { ReactNode } from "react";
import {
  EnlaceBoton,
  IconoEscaner,
  IconoBusqueda,
  IconoEscudo,
  IconoFlechaDerecha,
  IconoLapiz,
} from "@/components/insumos/piezasBusqueda";

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
    <div
      className={`flex flex-col rounded-2xl border p-5 ${
        principal ? "border-brand-200 bg-brand-50" : "border-border bg-card"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
          principal ? "bg-brand-600 text-white" : "bg-surface text-brand-600"
        }`}
      >
        {icono}
      </span>
      <h3 className="mt-5 text-lg font-semibold text-text-primary">{titulo}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-text-secondary">{descripcion}</p>
      <EnlaceBoton to={to} variant={principal ? "primary" : "secondary"} className="mt-5 w-full">
        {accion}
        <IconoFlechaDerecha />
      </EnlaceBoton>
    </div>
  );
}

/**
 * The first screen of a new supply (HU07), as in the design: three ways to start it, and the reminder that
 * nothing is saved without the productor's confirmation (CA9). Each option opens the next step; the title and
 * the back button are in the page's header.
 */
export default function InicioNuevoInsumo() {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Opcion
          principal
          to="/insumos/nuevo/codigo"
          titulo="Escanear código de barras"
          descripcion="Usa la cámara del celular o escribe el código que aparece en el envase."
          accion="Comenzar escaneo"
          icono={<IconoEscaner />}
        />
        <Opcion
          to="/insumos/nuevo/nombre"
          titulo="Buscar por nombre o marca"
          descripcion="Encuentra el producto en el catálogo de Jumbo y elige la presentación correcta."
          accion="Buscar producto"
          icono={<IconoBusqueda />}
        />
        <Opcion
          to="/insumos/nuevo/manual"
          titulo="Ingresar manualmente"
          descripcion="Completa todos los datos mirando directamente el envase del producto."
          accion="Crear ficha manual"
          icono={<IconoLapiz />}
        />
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <span className="mt-0.5 text-brand-600">
          <IconoEscudo />
        </span>
        <div>
          <p className="text-sm font-semibold text-text-primary">Tú decides qué se registra</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Las fuentes solo preparan un borrador. Podrás editar cada campo y revisar especialmente los alérgenos
            con el envase a la vista antes de confirmar.
          </p>
        </div>
      </div>
    </div>
  );
}
