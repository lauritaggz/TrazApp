import { useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NavItem from "@/components/layout/NavItem";
import { GRUPOS } from "@/components/layout/secciones";

export type AppSection = "inicio" | "productos" | "ingredientes" | "insumos" | "elaboraciones" | "publicaciones" | "calculadora" | "perfil";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  /** Cuando es false el panel móvil está fuera de pantalla y no debe recibir foco. */
  interactive: boolean;
  id?: string;
}

/** Duración del deslizamiento del relleno; el texto del ítem activo cambia de color al mismo ritmo. */
const DURACION_MS = 320;

/** Dónde quedó el relleno en el menú de la página anterior. */
let ultimaPosicion: { top: number; height: number } | null = null;

export default function Sidebar({ open, onClose, interactive, id }: SidebarProps) {
  const { pathname } = useLocation();
  const listaRef = useRef<HTMLDivElement>(null);
  const indicadorRef = useRef<HTMLSpanElement>(null);

  // El relleno verde del ítem activo es un solo elemento que se desliza con una transición CSS,
  // debajo del texto. Cada página monta su propio menú, así que la posición anterior se guarda
  // fuera del componente: el relleno nace donde estaba y se desliza hasta el ítem nuevo.
  // El origen se toma una sola vez por montaje, para que repetir el efecto (StrictMode) no
  // cancele el deslizamiento.
  const [origen] = useState(() => ultimaPosicion);

  useLayoutEffect(() => {
    const lista = listaRef.current;
    const indicador = indicadorRef.current;
    if (!lista || !indicador) return;

    function poner(pos: { top: number; height: number }) {
      indicador!.style.height = `${pos.height}px`;
      indicador!.style.transform = `translateY(${pos.top}px)`;
    }

    function ubicar(desde: { top: number; height: number } | null) {
      const activo = lista!.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!activo) {
        indicador!.style.opacity = "0";
        ultimaPosicion = null;
        return;
      }
      const destino = { top: activo.offsetTop, height: activo.offsetHeight };
      indicador!.style.transition = "none";
      indicador!.style.opacity = "1";
      if (desde && desde.top !== destino.top) {
        poner(desde);
        void indicador!.offsetHeight;
        indicador!.style.transition = "";
        lista!.dataset.deslizando = "";
        window.setTimeout(() => delete lista!.dataset.deslizando, DURACION_MS);
        poner(destino);
      } else {
        poner(destino);
        void indicador!.offsetHeight;
        indicador!.style.transition = "";
      }
      ultimaPosicion = destino;
    }

    ubicar(origen);
    // Si la fuente de los títulos de grupo aún no carga, las posiciones cambiarán: se reubica sin animar.
    if (document.fonts && document.fonts.status !== "loaded") {
      void document.fonts.ready.then(() => ubicar(null));
    }
  }, [pathname, origen]);

  return (
    <aside
      id={id}
      aria-label="Navegación principal"
      inert={!interactive}
      className={`
        fixed inset-y-0 left-0 z-30 flex w-[264px] flex-col
        border-r border-border bg-panel
        transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
        lg:sticky lg:top-0 lg:z-auto lg:h-[100dvh] lg:w-[248px] lg:shrink-0
        ${open ? "translate-x-0 shadow-lift lg:shadow-none" : "-translate-x-full lg:translate-x-0"}
      `}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 pl-5 pr-3 lg:h-[72px]">
        <Logo size="sm" />
        <ThemeToggle />
      </div>

      <nav
        aria-label="Secciones"
        className="flex-1 overflow-y-auto px-3 pb-6 pt-2"
      >
        <div ref={listaRef} className="nav-lista relative [&>div+div]:mt-6">
          <span
            ref={indicadorRef}
            aria-hidden="true"
            data-nav-indicador=""
            className="pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-brand-600 opacity-0 transition-[transform,height] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          />
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo} className="space-y-0.5">
              <p className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-text-muted">{grupo.titulo}</p>
              {grupo.items.map((item) => (
                <NavItem key={item.to} icon={item.icono} label={item.etiqueta} to={item.to} onClick={onClose} />
              ))}
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}
