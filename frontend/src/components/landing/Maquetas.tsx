import type { CSSProperties, ReactNode } from "react";
import { TRAZOS } from "@/components/landing/trazos";

/*
 * Maquetas decorativas de la landing (HT08): el panel del productor en un navegador, la
 * ficha pública en un teléfono, el visor del escáner, una elaboración, un QR y el costo.
 * Todas son aria-hidden: lo que cuentan ya está dicho en el texto de cada sección.
 * Los nombres y cifras son ejemplos inventados.
 */

export function Icono({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

/** El panel del productor, en miniatura, dentro de una ventana de navegador. */
export function MaquetaPanel() {
  const menu = ["Inicio", "Productos", "Ingredientes", "Insumos", "Elaboraciones"];
  return (
    <div
      aria-hidden="true"
      className="landing-flota overflow-hidden rounded-2xl border border-border bg-card text-[11px] leading-snug text-text-primary shadow-lift"
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-border bg-panel px-3">
        <i className="h-2 w-2 rounded-full bg-wheat-deep" />
        <i className="h-2 w-2 rounded-full bg-wheat-deep" />
        <i className="h-2 w-2 rounded-full bg-wheat-deep" />
        <span className="ml-2.5 flex h-5 max-w-[220px] flex-1 items-center rounded-md bg-card px-2 font-mono text-[10px] text-text-muted">
          trazapp · Inicio
        </span>
      </div>
      <div className="grid min-h-[300px] grid-cols-[104px_minmax(0,1fr)] sm:min-h-[330px]">
        <div className="flex flex-col gap-0.5 border-r border-border bg-panel px-2.5 py-3.5">
          <span className="mx-1.5 mb-3 font-display text-[15px] font-extrabold tracking-[-0.05em]">
            tra<span className="text-accent">z</span>app
          </span>
          {menu.map((item, index) => (
            <b
              key={item}
              className={`rounded-md px-2 py-1.5 font-medium ${
                index === 0 ? "bg-brand-600 font-semibold text-on-brand" : "text-text-secondary"
              }`}
            >
              {item}
            </b>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-3 px-4 py-4">
          <span className="text-text-muted">Dulces del Valle · viernes</span>
          <h4 className="font-display text-[21px] leading-none font-bold tracking-[-0.03em]">
            Hola, <span className="text-accent">María Paz</span>
          </h4>
          <div className="grid grid-cols-[1.6fr_1fr] gap-2.5">
            <div className="rounded-2xl border border-border bg-card px-3 py-2.5">
              <b className="font-display text-[13px]">Requiere tu atención</b>
              <FilaMini tono="bg-warning-bg text-warning" icono={TRAZOS.alerta}>
                <b>4 insumos</b> sin revisar alérgenos
              </FilaMini>
              <FilaMini tono="bg-brand-100 text-accent" icono={TRAZOS.bandera}>
                <b>2 productos</b> por completar
              </FilaMini>
              <FilaMini tono="bg-wheat text-text-secondary" icono={TRAZOS.reloj}>
                Mermelada · borrador
              </FilaMini>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl bg-wheat px-3 py-2.5">
              <b className="font-display text-[13px]">Primeros pasos</b>
              <div className="h-1.5 overflow-hidden rounded-full bg-wheat-deep">
                <i className="block h-full w-2/3 rounded-full bg-brand-600" />
              </div>
              <span className="text-text-muted">2 de 3 listos</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Mermelada de frambuesa", "bg-error-bg"],
              ["Pan de masa madre", "bg-wheat"],
              ["Pesto de albahaca", "bg-brand-100"],
            ].map(([nombre, fondo]) => (
              <div key={nombre} className="overflow-hidden rounded-lg border border-border bg-card">
                <i className={`block h-9 ${fondo}`} />
                <span className="block truncate px-1.5 py-1 text-[10px] font-semibold">{nombre}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilaMini({ tono, icono, children }: { tono: string; icono: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-t border-border-soft py-1.5 first-of-type:mt-1 first-of-type:border-t-0">
      <span className={`flex h-6 w-6 items-center justify-center rounded-md ${tono}`}>
        <Icono size={13}>{icono}</Icono>
      </span>
      <span>{children}</span>
    </div>
  );
}

interface FichaProps {
  nombre: string;
  detalle: string;
  fecha: string;
  codigo: string;
  fondo: string;
  alergenos: ReactNode;
  ingredientes: [string, string][];
  utilRespondida?: boolean;
}

/** Un teléfono con la ficha pública de un producto. */
export function TelefonoFicha({
  className = "",
  style,
  ...ficha
}: FichaProps & { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={`aspect-[9/19] rounded-[30px] bg-[#1b1a16] p-2 shadow-lift ring-1 ring-white/5 ring-inset ${className}`}
      style={style}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[23px] bg-surface">
        <span className="absolute left-1/2 top-1.5 z-10 h-4 w-14 -translate-x-1/2 rounded-full bg-[#1b1a16]" />
        <div className="flex flex-col gap-2.5 px-3 pb-3 pt-8 text-[11px] leading-snug text-text-primary">
          <div className={`grid h-20 place-items-center rounded-xl text-text-secondary ${ficha.fondo}`}>
            <span className="opacity-60">
              <Icono size={30}>{TRAZOS.frasco}</Icono>
            </span>
          </div>
          <div>
            <h5 className="font-display text-[17px] leading-tight font-bold tracking-[-0.03em]">{ficha.nombre}</h5>
            <p className="text-[10.5px] text-text-secondary">{ficha.detalle}</p>
          </div>
          <p className="text-[10.5px] text-text-secondary">
            Elaborado el {ficha.fecha} ·{" "}
            <span className="rounded bg-panel px-1.5 py-0.5 font-mono text-[10px]">{ficha.codigo}</span>
          </p>
          {ficha.alergenos}
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-2.5 py-2">
            <b className="text-[10px] font-semibold text-text-muted">Ingredientes</b>
            {ficha.ingredientes.map(([ingrediente, origen]) => (
              <div key={ingrediente} className="flex justify-between gap-1.5">
                <span>{ingrediente}</span>
                <span className="text-text-muted">{origen}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl bg-wheat px-2.5 py-2 font-semibold">
            ¿Esta información te resultó útil?
            <div className="flex gap-1.5">
              <span
                className={`flex-1 rounded-lg border py-1 text-center font-medium ${
                  ficha.utilRespondida
                    ? "border-brand-600 bg-brand-600 text-on-brand"
                    : "border-border bg-card"
                }`}
              >
                Sí
              </span>
              <span className="flex-1 rounded-lg border border-border bg-card py-1 text-center font-medium">No</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Un QR decorativo: un patrón fijo con las tres esquinas de posición; no codifica nada. */
export function QrDecorativo({ className = "" }: { className?: string }) {
  const lado = 9;
  const esEsquina = (fila: number, col: number) =>
    (fila < 3 || fila > lado - 4) && (col < 3 || col > lado - 4) && !(fila > lado - 4 && col > lado - 4);
  const celdas = Array.from({ length: lado * lado }, (_, i) => {
    const fila = Math.floor(i / lado);
    const col = i % lado;
    if (esEsquina(fila, col)) return true;
    return (fila * 7 + col * 13 + fila * col) % 3 !== 0;
  });
  return (
    <div aria-hidden="true" className={`grid aspect-square grid-cols-9 gap-[1.5px] ${className}`}>
      {celdas.map((lleno, i) => (
        <i key={i} className={`rounded-[1px] ${lleno ? "bg-[#22201c]" : "bg-transparent"}`} />
      ))}
    </div>
  );
}

/** El visor del escáner con un código de barras y el insumo encontrado. */
export function MaquetaEscaner() {
  return (
    <div
      aria-hidden="true"
      className="flex w-[min(100%,320px)] flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 text-[13px] shadow-soft"
    >
      <div className="relative grid h-[120px] place-items-center overflow-hidden rounded-xl bg-[#1f1d18]">
        {[
          "left-3 top-3 rounded-tl-md border-b-0 border-r-0",
          "right-3 top-3 rounded-tr-md border-b-0 border-l-0",
          "bottom-3 left-3 rounded-bl-md border-r-0 border-t-0",
          "bottom-3 right-3 rounded-br-md border-l-0 border-t-0",
        ].map((pos) => (
          <span key={pos} className={`absolute h-[18px] w-[18px] border-[2.5px] border-[#faf7f2] ${pos}`} />
        ))}
        <div className="landing-barras flex h-[54px] items-stretch gap-[3px]">
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <span className="landing-laser absolute inset-x-[12%] top-1/2 h-0.5 bg-[#8cc49b] shadow-[0_0_12px_#8cc49b]" />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-wheat text-text-secondary">
          <Icono size={18}>{TRAZOS.pan}</Icono>
        </span>
        <span className="min-w-0 flex-1">
          <b className="block font-semibold">Harina integral Selecta</b>
          <span className="text-xs text-text-muted">7801505000358 · encontrado en Jumbo</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Etiqueta>Harina de trigo</Etiqueta>
        <Etiqueta tono="bg-warning-bg text-warning">Gluten · por confirmar</Etiqueta>
      </div>
    </div>
  );
}

export function Etiqueta({ children, tono = "bg-panel text-text-secondary" }: { children: ReactNode; tono?: string }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium ${tono}`}>
      {children}
    </span>
  );
}

/** Una elaboración finalizada con los insumos que se usaron de verdad. */
export function MaquetaElaboracion() {
  const lineas: [string, string, string][] = [
    ["Frambuesa congelada", "3,20 kg", "Frutos del Maule · compra del 8 nov."],
    ["Azúcar granulada", "1,85 kg", "Iansa"],
    ["Jugo de limón", "0,12 L", "Elaboración propia"],
  ];
  return (
    <div
      aria-hidden="true"
      className="flex w-[min(100%,360px)] flex-col gap-1 rounded-2xl border border-border bg-card p-4 text-[13.5px] shadow-soft"
    >
      <header className="mb-1 flex items-baseline justify-between gap-2">
        <b className="font-display text-lg tracking-[-0.02em]">Mermelada de frambuesa</b>
        <Etiqueta tono="bg-brand-100 text-accent">Finalizada</Etiqueta>
      </header>
      {lineas.map(([insumo, cantidad, origen]) => (
        <div key={insumo} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-0.5 border-t border-border-soft py-2">
          <span>{insumo}</span>
          <span className="text-right font-mono text-[12.5px] text-text-secondary">{cantidad}</span>
          <small className="col-span-2 text-xs text-text-muted">{origen}</small>
        </div>
      ))}
      <div className="flex justify-between border-t-[1.5px] border-text-primary pt-2">
        <span>
          <b>E-0112</b> · 14 nov., 16:40
        </span>
        <span>21 frascos</span>
      </div>
    </div>
  );
}

/** El costo por unidad de un producto, como lo calcula la calculadora. */
export function MaquetaCosto() {
  const lineas: [string, string][] = [
    ["Albahaca (600 g)", "$ 3.900"],
    ["Aceite de oliva (0,9 L)", "$ 7.290"],
    ["Queso parmesano (300 g)", "$ 5.370"],
    ["Nueces (250 g)", "$ 3.490"],
    ["Frascos, tapas y etiquetas", "$ 4.680"],
  ];
  return (
    <div
      aria-hidden="true"
      className="landing-scroll flex flex-col gap-1 rounded-3xl border border-border bg-card p-5 text-[14.5px] shadow-soft"
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <b className="font-display text-lg tracking-[-0.02em]">Pesto de albahaca · 190 g</b>
        <Etiqueta>12 frascos</Etiqueta>
      </div>
      {lineas.map(([item, monto]) => (
        <div key={item} className="flex justify-between gap-2.5 border-t border-border-soft py-2 first-of-type:border-t-0">
          <span>{item}</span>
          <span className="tabular-nums">{monto}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-baseline justify-between border-t-[1.5px] border-text-primary pt-3">
        <span>Costo por frasco</span>
        <b className="font-display text-3xl tracking-[-0.03em] tabular-nums">$ 2.061</b>
      </div>
    </div>
  );
}
