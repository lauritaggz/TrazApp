import type { ReactNode } from "react";
import {
  BoxIcon,
  CalculatorIcon,
  HistoryIcon,
  HomeIcon,
  LeafIcon,
  PackageIcon,
  QrIcon,
} from "@/components/layout/iconosMenu";

/* Secciones del menú, compartidas por el menú lateral y la barra de pestañas del celular. */

export interface GrupoMenu {
  titulo: string;
  items: { icono: ReactNode; etiqueta: string; to: string }[];
}

/**
 * Los grupos del menú, como en el diseño. El grupo «Herramientas» tiene «Publicaciones» (HU09) y la
 * «Calculadora de costos» (HU14): sin enlaces a pantallas inexistentes ni «Próximamente».
 * «Elaboraciones» queda marcado también en el detalle y el registro de una elaboración
 * (NavLink sin `end`). Sin contadores.
 */
export const GRUPOS: GrupoMenu[] = [
  {
    titulo: "Gestión",
    items: [
      { icono: <HomeIcon />, etiqueta: "Inicio", to: "/dashboard" },
      { icono: <BoxIcon />, etiqueta: "Productos", to: "/productos" },
      { icono: <LeafIcon />, etiqueta: "Ingredientes", to: "/ingredientes" },
      { icono: <PackageIcon />, etiqueta: "Insumos", to: "/insumos" },
      { icono: <HistoryIcon />, etiqueta: "Elaboraciones", to: "/elaboraciones" },
    ],
  },
  {
    titulo: "Herramientas",
    items: [
      { icono: <QrIcon />, etiqueta: "Publicaciones", to: "/publicaciones" },
      { icono: <CalculatorIcon />, etiqueta: "Calculadora de costos", to: "/calculadora" },
    ],
  },
];
