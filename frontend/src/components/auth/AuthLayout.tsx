import type { CSSProperties, ReactNode } from "react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface AuthLayoutProps {
  /** Frase grande del panel lateral (escritorio). */
  panelTitle: string;
  panelText: string;
  children: ReactNode;
}

/**
 * Pantallas de acceso (HT08): el formulario y, desde 1024 px, un panel bosque con el
 * recorrido de la z del logo dibujándose y tres hitos que aparecen en orden.
 * En el celular solo queda el formulario, con el logo y el selector de modo arriba.
 */
export default function AuthLayout({ panelTitle, panelText, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-[100dvh] bg-surface lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden h-[100dvh] flex-col justify-between gap-8 overflow-hidden bg-deep px-12 py-10 lg:sticky lg:top-0 lg:flex">
        <div className="flex items-center gap-2">
          <Logo size="lg" variant="light" />
          <ThemeToggle variant="onBrand" />
        </div>

        <Recorrido />

        <div className="max-w-[30rem] space-y-3">
          <p className="font-display text-[2.5rem] leading-[1.05] font-bold tracking-[-0.02em] text-balance text-on-brand">
            {panelTitle}
          </p>
          <p className="max-w-[40ch] text-base leading-relaxed text-panel-faint">{panelText}</p>
        </div>
      </aside>

      <main className="flex min-h-[100dvh] flex-col px-5 pb-10 pt-4 sm:px-10 lg:px-14 lg:pt-8">
        <div className="flex min-h-12 items-center justify-between gap-3 lg:hidden">
          <div className="flex items-center gap-1">
            <Logo size="md" />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

/** Encabezado de cada formulario de acceso: título grande y una línea de apoyo. */
export function AuthHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-[2.25rem] leading-[1.05] font-extrabold text-text-primary sm:text-[2.75rem]">
        {title}
      </h1>
      <p className="text-[15px] leading-relaxed text-text-secondary">{children}</p>
    </div>
  );
}

const HITOS = [
  { titulo: "Harina integral, revisada", detalle: "7801505000358", icono: <IconoEscaner />, pos: "left-[4%] top-[18%]", i: 0 },
  { titulo: "Elaboración finalizada", detalle: "E-0112 · 21 frascos", icono: <IconoOlla />, pos: "left-[30%] top-[46%]", i: 1 },
  { titulo: "Ficha publicada", detalle: "Código QR listo", icono: <IconoQr />, pos: "right-[2%] top-[72%]", i: 2 },
];

/** La z del logo como recorrido: del insumo (punto lleno) a quien consume (punto abierto). */
function Recorrido() {
  return (
    <div aria-hidden="true" className="relative min-h-[320px] flex-1">
      <svg
        className="auth-ruta absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 400 360"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
      >
        <path
          d="M40 40H340L60 320H348"
          stroke="rgb(250 247 242 / 0.85)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="40" cy="40" r="12" fill="var(--color-on-brand)" />
        <circle cx="360" cy="320" r="11" stroke="var(--color-on-brand)" strokeWidth="3" />
      </svg>
      {HITOS.map((hito) => (
        <div
          key={hito.titulo}
          className={`auth-hito absolute flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.08] py-2 pl-2 pr-3.5 text-[13px] text-on-brand backdrop-blur-sm ${hito.pos}`}
          style={{ "--i": hito.i } as CSSProperties}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.12]">
            {hito.icono}
          </span>
          <span>
            {hito.titulo}
            <small className="block font-mono text-xs text-panel-faint">{hito.detalle}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function IconoEscaner() {
  return (
    <Icono>
      <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M12 8v8M16 8v8" />
    </Icono>
  );
}

function IconoOlla() {
  return (
    <Icono>
      <path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h20M9 6c0-1 1-2 3-2s3 1 3 2" />
    </Icono>
  );
}

function IconoQr() {
  return (
    <Icono>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4" />
    </Icono>
  );
}
