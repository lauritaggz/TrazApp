import { useLayoutEffect, useRef } from "react";
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

export default function Sidebar({ open, onClose, interactive, id }: SidebarProps) {
  const { pathname } = useLocation();
  const listaRef = useRef<HTMLDivElement>(null);
  const indicadorRef = useRef<HTMLSpanElement>(null);

  // El relleno verde del ítem activo es un solo elemento que se desliza con una transición CSS,
  // debajo del texto. (Como capa de View Transition se dibujaba encima y tapaba el nombre.)
  useLayoutEffect(() => {
    const lista = listaRef.current;
    const indicador = indicadorRef.current;
    if (!lista || !indicador) return;

    function ubicar(animar: boolean) {
      const activo = lista!.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!activo) {
        indicador!.style.opacity = "0";
        return;
      }
      if (!animar) indicador!.style.transition = "none";
      indicador!.style.opacity = "1";
      indicador!.style.height = `${activo.offsetHeight}px`;
      indicador!.style.transform = `translateY(${activo.offsetTop}px)`;
      if (!animar) {
        void indicador!.offsetHeight;
        indicador!.style.transition = "";
      }
    }

    ubicar(indicador.dataset.ubicado === "1");
    indicador.dataset.ubicado = "1";
    // Si la fuente de los títulos de grupo carga después, las posiciones cambian.
    void document.fonts?.ready.then(() => ubicar(false));
  }, [pathname]);

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
        <div ref={listaRef} className="relative [&>div+div]:mt-6">
          <span
            ref={indicadorRef}
            aria-hidden="true"
            data-nav-indicador=""
            className="pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-brand-600 opacity-0 transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.34,1.3,0.64,1)] motion-reduce:transition-none"
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
