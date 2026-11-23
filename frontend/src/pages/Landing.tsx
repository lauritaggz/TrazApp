import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import Logo from "@/components/Logo";
import {
  Icono,
  MaquetaCosto,
  MaquetaElaboracion,
  MaquetaEscaner,
  MaquetaPanel,
  QrDecorativo,
  TelefonoFicha,
} from "@/components/landing/Maquetas";
import { TRAZOS } from "@/components/landing/trazos";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import "@/components/landing/landing.css";

/**
 * Página pública de TrazApp (HT08): qué es, cómo funciona en tres pasos, qué ve quien
 * compra y cuánto cuesta cada unidad. Con sesión iniciada, las llamadas llevan al panel.
 */
export default function Landing() {
  useDocumentTitle("Trazabilidad para pequeños productores");
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing min-h-[100dvh] bg-surface text-text-primary">
      <a
        href="#contenido-landing"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-brand"
      >
        Saltar al contenido
      </a>

      <Navegacion conSesion={isAuthenticated} />

      <main id="contenido-landing">
        <Portada conSesion={isAuthenticated} />
        <ParaQuien />
        <ComoFunciona />
        <ParaTusClientes />
        <Costos />
        <Cierre conSesion={isAuthenticated} />
      </main>

      <Pie />
    </div>
  );
}

const CONTENEDOR = "mx-auto w-full max-w-[1180px] px-4 sm:px-6";

/*
 * Las secciones con adornos que sobresalen usan overflow-clip, no overflow-hidden:
 * un contenedor hidden se puede desplazar, y al tocar un botón el navegador lo corría
 * hacia el lado en el celular.
 */

const BOTON =
  "group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
const BOTON_PRINCIPAL = `${BOTON} bg-brand-600 text-on-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_8px_20px_-8px_var(--color-brand-600)] hover:bg-brand-700`;
const BOTON_SECUNDARIO = `${BOTON} border border-border bg-card text-text-primary hover:border-border-strong`;

function Flecha() {
  return (
    <span className="transition-transform duration-200 group-hover:translate-x-0.5">
      <Icono size={18}>{TRAZOS.flecha}</Icono>
    </span>
  );
}

function Navegacion({ conSesion }: { conSesion: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-surface/85 backdrop-blur-md">
      <div className={`${CONTENEDOR} flex min-h-16 items-center justify-between gap-3`}>
        <Link to="/" className="-ml-1 flex min-h-11 items-center rounded-xl px-1">
          <Logo size="sm" />
        </Link>
        <nav aria-label="Secciones de la página" className="hidden gap-1 md:flex">
          {[
            ["#como-funciona", "Cómo funciona"],
            ["#para-tus-clientes", "Para tus clientes"],
            ["#costos", "Costos"],
          ].map(([href, texto]) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-text-secondary transition-colors hover:bg-panel hover:text-text-primary"
            >
              {texto}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {conSesion ? (
            <Link to="/dashboard" className={`${BOTON_PRINCIPAL} min-h-11 px-4 text-sm`}>
              Ir a mi panel
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-text-primary transition-colors hover:text-accent-strong"
              >
                Ingresar
              </Link>
              <Link
                to="/register"
                className={`${BOTON_PRINCIPAL.replace("group inline-flex", "group hidden sm:inline-flex")} min-h-11 px-4 text-sm`}
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Portada({ conSesion }: { conSesion: boolean }) {
  return (
    <section aria-labelledby="landing-titulo" className="relative overflow-clip pb-16 pt-8 lg:pb-24 lg:pt-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-20%] bottom-[-30%] h-[70%] bg-[radial-gradient(60%_60%_at_50%_60%,var(--color-wheat),transparent_70%)]"
      />
      <div className={`${CONTENEDOR} relative grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]`}>
        <div className="flex flex-col gap-5">
          <p className="flex items-start gap-2.5 text-[14.5px] leading-snug text-text-secondary">
            <span aria-hidden="true" className="mt-[0.45em] h-2 w-2 shrink-0 rounded-full bg-brand-600" />
            <span>
              <b className="font-semibold text-text-primary">Para pequeños productores</b> de conservas, panadería,
              salsas y más
            </span>
          </p>
          <h1
            id="landing-titulo"
            className="text-[clamp(2.6rem,11vw,5.25rem)] leading-[0.98] font-extrabold tracking-[-0.045em]"
          >
            Cada frasco sabe{" "}
            <em className="relative whitespace-nowrap not-italic text-accent">
              de dónde viene
              <svg
                aria-hidden="true"
                viewBox="0 0 300 20"
                preserveAspectRatio="none"
                className="landing-subrayado absolute -bottom-[0.12em] left-[-2%] h-[0.32em] w-[104%] overflow-visible"
              >
                <path
                  d="M4 14C70 4 180 2 296 10"
                  fill="none"
                  stroke="var(--color-warning-border)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            </em>
          </h1>
          <p className="max-w-[40ch] text-lg leading-relaxed text-text-secondary">
            TrazApp ordena tus productos, insumos y elaboraciones en un solo lugar, y los convierte en una
            ficha que tus clientes abren con un código QR.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {conSesion ? (
              <Link to="/dashboard" className={`${BOTON_PRINCIPAL} flex-[1_1_200px] sm:flex-none`}>
                Ir a mi panel
                <Flecha />
              </Link>
            ) : (
              <Link to="/register" className={`${BOTON_PRINCIPAL} flex-[1_1_200px] sm:flex-none`}>
                Crear cuenta
                <Flecha />
              </Link>
            )}
            <a href="#como-funciona" className={`${BOTON_SECUNDARIO} flex-[1_1_200px] sm:flex-none`}>
              Ver cómo funciona
            </a>
          </div>
          <p className="flex items-center gap-2 text-[13.5px] text-text-muted">
            <span className="text-accent">
              <Icono>{TRAZOS.check}</Icono>
            </span>
            Funciona desde el celular, en la cocina o en la feria.
          </p>
        </div>

        <VistaPrevia />
      </div>
    </section>
  );
}

/**
 * Las dos caras de TrazApp. En el celular se ven de a una, con un selector; desde 1024 px,
 * el teléfono con la ficha queda sobre el panel, como en una mesa de trabajo.
 */
function VistaPrevia() {
  const [vista, setVista] = useState<"panel" | "ficha">("panel");
  const opciones = [
    { valor: "panel", texto: "Tu panel" },
    { valor: "ficha", texto: "Lo que ve tu cliente" },
  ] as const;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div
        role="group"
        aria-label="Vista previa"
        className="grid grid-cols-2 gap-1 self-center rounded-full border border-border bg-card p-1 lg:hidden"
      >
        {opciones.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={vista === opcion.valor}
            onClick={() => setVista(opcion.valor)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors duration-200 ${
              vista === opcion.valor
                ? "bg-text-primary text-surface"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {opcion.texto}
          </button>
        ))}
      </div>

      <div className="relative lg:min-h-[440px] lg:pb-10">
        <div className={vista === "panel" ? "block" : "hidden lg:block"}>
          <MaquetaPanel />
        </div>
        <div
          className={`${vista === "ficha" ? "flex" : "hidden lg:block"} flex-col items-center gap-4 lg:absolute lg:-bottom-6 lg:right-[-18px]`}
        >
          <TelefonoFicha
            className="landing-flota w-[230px] sm:w-[250px] lg:w-[220px]"
            style={{ "--retraso": "380ms" } as CSSProperties}
            nombre="Pesto de albahaca"
            detalle="Dulces del Valle · 190 g"
            fecha="14 nov."
            codigo="E-0118"
            fondo="bg-brand-100"
            alergenos={
              <div className="rounded-xl border border-warning-border bg-warning-bg px-2.5 py-2 font-semibold text-warning">
                Contiene: leche y frutos secos
              </div>
            }
            ingredientes={[
              ["Albahaca", "Huerta propia"],
              ["Aceite de oliva", "Olave"],
              ["Queso parmesano", "Colun"],
              ["Nueces", "Nutrisa"],
            ]}
          />
        </div>
        <div
          aria-hidden="true"
          className="landing-flota absolute bottom-4 left-[4%] z-10 hidden items-center gap-2.5 rounded-2xl border border-border bg-card py-2.5 pl-2.5 pr-3.5 text-[13.5px] shadow-soft lg:inline-flex"
          style={{ "--retraso": "650ms" } as CSSProperties}
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-100 text-accent">
            <Icono>{TRAZOS.qr}</Icono>
          </span>
          <span>
            <b className="block font-semibold">Ficha publicada</b>
            <span className="block font-mono text-xs text-text-muted">/p/pesto-190</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ParaQuien() {
  const rubros: [string, ReactNode][] = [
    ["Conservas", TRAZOS.frasco],
    ["Panadería", TRAZOS.pan],
    ["Salsas y pestos", TRAZOS.hoja],
    ["Repostería", TRAZOS.olla],
    ["Lácteos artesanales", TRAZOS.frasco],
  ];
  return (
    <section aria-label="Para quién es" className="pb-6 pt-2">
      <div className={`${CONTENEDOR} flex flex-col gap-3.5`}>
        <p className="text-sm text-text-muted">Hecho para cocinas pequeñas que venden lo que elaboran</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {rubros.map(([rubro, trazo]) => (
            <li
              key={rubro}
              className="flex items-center gap-2 font-display text-xl font-semibold tracking-[-0.02em] text-text-secondary"
            >
              <span className="text-accent">
                <Icono size={18}>{trazo}</Icono>
              </span>
              {rubro}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function EncabezadoSeccion({ id, antetitulo, titulo, children }: { id: string; antetitulo: string; titulo: string; children: ReactNode }) {
  return (
    <div className="mb-9 flex max-w-[680px] flex-col gap-3">
      <span className="text-[13.5px] font-semibold text-accent">{antetitulo}</span>
      <h2 id={id} className="text-[clamp(2rem,7vw,3.25rem)] leading-[1.02] font-bold">
        {titulo}
      </h2>
      <p className="max-w-[56ch] text-[17px] leading-relaxed text-text-secondary">{children}</p>
    </div>
  );
}

function Paso({
  numero,
  titulo,
  texto,
  puntos,
  visual,
  fondo = "bg-panel",
  invertido = false,
}: {
  numero: number;
  titulo: string;
  texto: string;
  puntos: string[];
  visual: ReactNode;
  fondo?: string;
  invertido?: boolean;
}) {
  return (
    <article className="grid items-center gap-6 lg:grid-cols-2 lg:gap-14">
      <div className="flex flex-col gap-3">
        <span className="flex items-center gap-2.5 font-mono text-[13px] text-text-muted">
          Paso {numero}
          <span aria-hidden="true" className="h-px w-12 bg-border-strong/50" />
        </span>
        <h3 className="font-display text-[clamp(1.6rem,5.5vw,2.25rem)] leading-tight font-bold tracking-[-0.02em]">
          {titulo}
        </h3>
        <p className="max-w-[46ch] leading-relaxed text-text-secondary">{texto}</p>
        <ul className="mt-1 flex flex-col gap-2 text-[15px] text-text-secondary">
          {puntos.map((punto) => (
            <li key={punto} className="flex items-start gap-2.5">
              <span className="mt-0.5 text-accent">
                <Icono size={18}>{TRAZOS.check}</Icono>
              </span>
              {punto}
            </li>
          ))}
        </ul>
      </div>
      <div
        className={`landing-scroll relative grid min-h-[260px] place-items-center overflow-clip rounded-3xl p-5 lg:min-h-[340px] ${fondo} ${
          invertido ? "lg:order-first" : ""
        }`}
      >
        {visual}
      </div>
    </article>
  );
}

function ComoFunciona() {
  return (
    <section id="como-funciona" aria-labelledby="landing-como-funciona" className="py-16 lg:py-20">
      <div className={CONTENEDOR}>
        <EncabezadoSeccion id="landing-como-funciona" antetitulo="Cómo funciona" titulo="De la compra al cliente, en tres pasos">
          Lo que ya haces en tu cocina, anotado una sola vez. TrazApp une cada paso con el siguiente.
        </EncabezadoSeccion>
        <div className="flex flex-col gap-14">
          <Paso
            numero={1}
            titulo="Registra lo que compras"
            texto="Escanea el código de barras del envase y TrazApp busca el producto en fuentes públicas para precargar nombre, marca y datos de la etiqueta. Tú confirmas lo que dice el envase."
            puntos={[
              "Cada insumo queda ligado a su ingrediente: «Harina Selecta 1 kg» es harina de trigo.",
              "Los alérgenos sin revisar quedan marcados hasta que los confirmes.",
            ]}
            visual={<MaquetaEscaner />}
          />
          <Paso
            numero={2}
            titulo="Registra cada elaboración"
            texto="Al elaborar, eliges qué insumos usaste de verdad. Al finalizarla, queda guardada con su código y su fecha."
            puntos={[
              "Si un proveedor avisa un problema, sabes qué elaboraciones lo usaron.",
              "Los alérgenos salen de los insumos que entraron a la olla.",
            ]}
            visual={<MaquetaElaboracion />}
            fondo="bg-wheat"
            invertido
          />
          <Paso
            numero={3}
            titulo="Publica la ficha con un QR"
            texto="Imprime el QR en tu etiqueta. Quien lo escanea ve ingredientes, alérgenos y la fecha de elaboración, sin descargar nada."
            puntos={[
              "Tú decides qué productos se publican y cuándo.",
              "Revisa la vista previa antes de que la vea tu clientela.",
            ]}
            visual={
              <div aria-hidden="true" className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-center text-[13px] shadow-soft">
                <div className="w-[132px] rounded-2xl border border-[#e7e0d3] bg-[#faf7f2] p-3">
                  <QrDecorativo />
                </div>
                <b className="font-semibold">Pesto de albahaca · 190 g</b>
                <span className="text-xs text-text-muted">Escanea para ver de dónde viene</span>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

function ParaTusClientes() {
  const hechos: [string, string, ReactNode][] = [
    [
      "Alérgenos a la vista",
      "Los que declara el producto, arriba y en otro color, para encontrarlos sin leer toda la ficha.",
      TRAZOS.alerta,
    ],
    [
      "De dónde viene cada ingrediente",
      "El insumo y la marca que usaste, para que nadie tenga que adivinar qué lleva.",
      TRAZOS.hoja,
    ],
    ["Sin cuentas ni apps", "Se abre en el navegador del teléfono de quien compra.", TRAZOS.ojo],
    [
      "Sabes si sirvió",
      "Cada ficha pregunta si la información fue útil y tú ves el porcentaje de respuestas positivas.",
      TRAZOS.pulgar,
    ],
  ];
  return (
    <section id="para-tus-clientes" aria-labelledby="landing-clientes" className="pb-16 pt-6 lg:pb-20">
      <div className={CONTENEDOR}>
        <div className="overflow-clip rounded-[32px] bg-deep text-on-brand">
          <div className="grid gap-10 px-6 py-12 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:px-16 lg:py-[72px]">
            <div className="flex flex-col gap-4">
              <span className="text-[13.5px] font-semibold text-panel-faint">Para tus clientes</span>
              <h2 id="landing-clientes" className="text-[clamp(2rem,7vw,3.25rem)] leading-[1.02] font-bold text-on-brand">
                Lo que tu etiqueta no alcanza a decir
              </h2>
              <p className="max-w-[48ch] text-[17px] leading-relaxed text-panel-faint">
                Para quien vive con una alergia o una intolerancia, leer bien una etiqueta no es opcional. Tu ficha le
                da esa información completa y ordenada, en su celular.
              </p>
              <ul className="mt-2 grid gap-3.5">
                {hechos.map(([titulo, texto, trazo]) => (
                  <li key={titulo} className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.08]">
                      <Icono>{trazo}</Icono>
                    </span>
                    <span>
                      <b className="block font-semibold">{titulo}</b>
                      <span className="text-[14.5px] text-panel-faint">{texto}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div aria-hidden="true" className="relative flex min-h-[440px] items-center justify-center">
              <TelefonoFicha
                className="relative w-[200px]"
                nombre="Mermelada de frambuesa"
                detalle="Dulces del Valle · 250 g"
                fecha="14 nov."
                codigo="E-0112"
                fondo="bg-error-bg"
                alergenos={
                  <div className="rounded-xl bg-brand-100 px-2.5 py-2 font-semibold text-accent-strong">
                    Sin alérgenos declarados
                  </div>
                }
                ingredientes={[
                  ["Frambuesa", "Frutos del Maule"],
                  ["Azúcar", "Iansa"],
                  ["Jugo de limón", "Propio"],
                ]}
                utilRespondida
              />
              <div className="absolute bottom-6 left-0 flex w-[118px] -rotate-6 flex-col gap-1.5 rounded-2xl bg-[#faf7f2] p-3 text-center text-xs font-semibold text-[#22201c] shadow-lift">
                <QrDecorativo />
                Escanéame
              </div>
              <div className="absolute right-0 top-8 flex rotate-3 flex-col gap-0.5 rounded-2xl bg-card px-3.5 py-3 text-[12.5px] text-text-muted shadow-lift">
                Le resultó útil a
                <b className="font-display text-3xl leading-none tracking-[-0.03em] text-accent tabular-nums">87,5 %</b>
                de 48 respuestas
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Costos() {
  return (
    <section id="costos" aria-labelledby="landing-costos" className="py-16 lg:py-20">
      <div className={`${CONTENEDOR} grid items-center gap-8 lg:grid-cols-2 lg:gap-16`}>
        <div className="flex max-w-[680px] flex-col gap-3">
          <span className="text-[13.5px] font-semibold text-accent">Costos</span>
          <h2 id="landing-costos" className="text-[clamp(2rem,7vw,3.25rem)] leading-[1.02] font-bold">
            Cuánto te cuesta cada frasco, sin planilla
          </h2>
          <p className="max-w-[56ch] text-[17px] leading-relaxed text-text-secondary">
            Con la formulación y el precio de tus insumos, la calculadora de TrazApp estima el costo por unidad. Puedes
            actualizar los precios desde Jumbo cuando cambian.
          </p>
        </div>
        <MaquetaCosto />
      </div>
    </section>
  );
}

function Cierre({ conSesion }: { conSesion: boolean }) {
  return (
    <section aria-labelledby="landing-cierre" className="pb-10 pt-6 lg:pt-10">
      <div className={CONTENEDOR}>
        <div className="landing-scroll relative flex flex-col items-start gap-5 overflow-clip rounded-[32px] bg-wheat px-6 py-10 lg:p-16">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-16 h-60 w-60 rounded-full border-[34px] border-wheat-deep/70"
          />
          <h2 id="landing-cierre" className="relative max-w-[14ch] text-[clamp(2.1rem,8vw,3.75rem)] leading-[1] font-extrabold">
            Tu próxima elaboración, ya trazada
          </h2>
          <p className="relative max-w-[46ch] text-[17px] leading-relaxed text-text-secondary">
            Crea tu cuenta con el nombre de tu negocio y registra tu primer producto hoy. Toma unos minutos.
          </p>
          <div className="relative flex flex-wrap gap-2.5">
            {conSesion ? (
              <Link to="/dashboard" className={BOTON_PRINCIPAL}>
                Ir a mi panel
                <Flecha />
              </Link>
            ) : (
              <>
                <Link to="/register" className={BOTON_PRINCIPAL}>
                  Crear cuenta
                  <Flecha />
                </Link>
                <Link to="/login" className={BOTON_SECUNDARIO}>
                  Ya tengo cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pie() {
  return (
    <footer className="pb-10 pt-7">
      <div className={`${CONTENEDOR} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm text-text-muted`}>
        <Logo size="sm" />
        <span>Trazabilidad para pequeños productores de alimentos.</span>
      </div>
    </footer>
  );
}
