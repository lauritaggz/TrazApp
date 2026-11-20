import { forwardRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { GRUPOS } from "@/components/layout/secciones";
import { useNavegacionAnimada } from "@/components/layout/transicionPagina";

/** Secciones con acceso directo en la barra inferior del celular; el resto queda en «Más». */
const RAPIDAS = ["/dashboard", "/productos", "/ingredientes", "/insumos"];
const TABS = GRUPOS.flatMap((grupo) => grupo.items).filter((item) =>
  RAPIDAS.includes(item.to),
);

interface TabBarProps {
  menuOpen: boolean;
  menuId: string;
  onOpenMenu: () => void;
}

/**
 * Barra de pestañas inferior para el celular (HT08). La pestaña activa lleva una
 * píldora que se desliza entre pestañas al cambiar de sección.
 * «Más» abre el menú lateral completo.
 */
const TabBar = forwardRef<HTMLButtonElement, TabBarProps>(function TabBar(
  { menuOpen, menuId, onOpenMenu },
  moreRef,
) {
  const animar = useNavegacionAnimada();
  const { pathname } = useLocation();
  const activa = TABS.findIndex(
    (tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`),
  );

  return (
    <nav
      aria-label="Accesos rápidos"
      className="app-tabbar fixed inset-x-0 bottom-0 z-[15] border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="relative mx-auto grid h-16 max-w-[520px] grid-cols-5 px-1">
        {/* Una sola píldora que se desliza entre pestañas con una transición CSS, por debajo
            del ícono. (Como capa de View Transition se dibujaba encima y lo tapaba.) */}
        <li
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-1 flex w-[calc((100%-0.5rem)/5)] justify-center transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.34,1.3,0.64,1)] motion-reduce:transition-none ${
            activa < 0 ? "opacity-0" : "opacity-100"
          }`}
          style={{ transform: `translateX(${Math.max(activa, 0) * 100}%)` }}
        >
          <span className="mt-2 h-8 w-14 rounded-full bg-brand-100" />
        </li>
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              onClick={animar(tab.to)}
              className={({ isActive }) =>
                `group relative flex h-full flex-col items-center justify-center gap-1 text-[11.5px] leading-none transition-colors duration-200 ${
                  isActive ? "font-semibold text-accent" : "font-medium text-text-muted"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`relative flex h-8 items-center transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] [&_svg]:h-[21px] [&_svg]:w-[21px] ${
                      isActive ? "-translate-y-px scale-105" : "group-active:scale-90"
                    }`}
                  >
                    {tab.icono}
                  </span>
                  <span className="relative max-w-full truncate px-0.5">
                    {tab.etiqueta}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button
            ref={moreRef}
            type="button"
            onClick={onOpenMenu}
            aria-controls={menuId}
            aria-expanded={menuOpen}
            className="group flex h-full w-full flex-col items-center justify-center gap-1 text-[11.5px] font-medium leading-none text-text-muted"
          >
            <span
              aria-hidden="true"
              className="flex h-8 items-center transition-transform duration-150 group-active:scale-90"
            >
              <MoreIcon />
            </span>
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
});

export default TabBar;

function MoreIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </svg>
  );
}
