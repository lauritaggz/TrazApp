import type { ReactNode } from "react";
import MiniaturaProducto from "@/components/insumos/MiniaturaProducto";
import { IconoFlechaDerecha } from "@/components/insumos/piezasBusqueda";
import Button from "@/components/ui/Button";
import { nombreDeOrigen } from "@/lib/revisionInsumo";
import { TIPO_CONTIENE, TIPO_TRAZAS, type Insumo } from "@/types/insumo";

const CAMPOS: Record<string, string> = {
  nombre: "Nombre",
  marca_origen: "Marca",
  presentacion: "Presentación",
  ingredientes_declarados: "Ingredientes declarados",
  alergenos: "Alérgenos",
};

interface EntradaDeFuente {
  fuente: string;
  fecha?: string;
  campos?: string[];
}

function fechaLarga(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

function entradasDe(insumo: Insumo): EntradaDeFuente[] {
  const fuentes = (insumo.ficha as { fuentes?: unknown } | null)?.fuentes;
  return Array.isArray(fuentes) ? (fuentes as EntradaDeFuente[]) : [];
}

function fuentesPorAlergeno(insumo: Insumo): Record<string, { fuentes?: string[] }> {
  const detalle = (insumo.ficha as { fuentes_por_alergeno?: unknown } | null)?.fuentes_por_alergeno;
  return detalle && typeof detalle === "object" ? (detalle as Record<string, { fuentes?: string[] }>) : {};
}

interface InsumoRegistradoProps {
  /** The supply as the server saved it. */
  insumo: Insumo;
  /** The thumbnail of the product that was reviewed (only shown; never saved). */
  imagen?: { url: string | null; fuente: string };
  onVolver: () => void;
  onOtro: () => void;
}

/**
 * The confirmation after registering a supply (HU07 / T07-07 C), as in the design: what the server saved and
 * where each part came from (source and date, CA11 and CA15), the ingredient it was associated to, and the way
 * back to the list or to register another one. Everything is read from the saved supply.
 */
export default function InsumoRegistrado({ insumo, imagen, onVolver, onOtro }: InsumoRegistradoProps) {
  const entradas = entradasDe(insumo);
  const externas = entradas.filter((entrada) => entrada.fuente !== "manual");
  const delProductor = entradas.find((entrada) => entrada.fuente === "manual");
  const detalle = fuentesPorAlergeno(insumo);
  const contiene = insumo.alergenos_declarados.filter((a) => a.tipo === TIPO_CONTIENE);
  const trazas = insumo.alergenos_declarados.filter((a) => a.tipo === TIPO_TRAZAS);

  return (
    <div className="max-w-4xl" data-insumo-registrado>
      <div className="mb-5 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-bg text-success"
        >
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.1V12a10 10 0 11-5.9-9.1" />
            <polyline points="22 4 12 14 9 11" />
          </svg>
        </span>
        <div role="status">
          <h1 className="mb-1 text-xs font-semibold text-success">Insumo registrado</h1>
          <h2 className="text-2xl font-semibold text-text-primary">{insumo.nombre}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            La información fue confirmada y asociada a {insumo.ingrediente.nombre}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <Tarjeta titulo="Identificación comercial" descripcion="Información confirmada por el productor." imagen={imagen} nombre={insumo.nombre}>
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              <Dato etiqueta="Nombre" valor={insumo.nombre} />
              <Dato etiqueta="Marca" valor={insumo.marca_origen} />
              <Dato etiqueta="Presentación" valor={insumo.presentacion} />
              <Dato etiqueta="Código de barras" valor={insumo.codigo_barras || "Sin código registrado"} mono />
            </div>
          </Tarjeta>

          <Tarjeta titulo="Declaraciones del envase" descripcion="Ingredientes y alérgenos guardados en la ficha.">
            <div className="border-b border-border p-5">
              <Dato etiqueta="Ingredientes declarados" valor={insumo.ingredientes_declarados} />
              {insumo.advertencias && (
                <div className="mt-4">
                  <Dato etiqueta="Advertencias" valor={insumo.advertencias} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              <Alergenos titulo="Contiene" items={contiene} detalle={detalle} peligro />
              <Alergenos titulo="Puede contener" items={trazas} detalle={detalle} />
            </div>
          </Tarjeta>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-text-primary">Origen de la información</h3>
            <p className="mt-1 text-xs text-text-secondary">Datos recuperados y luego revisados por el productor.</p>
            <ul className="mt-4 space-y-3">
              {externas.map((entrada) => (
                <li key={entrada.fuente} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-xs font-semibold text-text-primary">Fuente: {nombreDeOrigen(entrada.fuente)}</p>
                  {entrada.fecha && (
                    <p className="mt-1 text-xs text-text-secondary">Recuperado el {fechaLarga(entrada.fecha)}</p>
                  )}
                  {entrada.campos && entrada.campos.length > 0 && (
                    <p className="mt-1 text-xs text-text-secondary">
                      Aportó: {entrada.campos.map((campo) => CAMPOS[campo] ?? campo).join(", ")}
                    </p>
                  )}
                </li>
              ))}
              {delProductor && (
                <li className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-xs font-semibold text-text-primary">Cambios del productor</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {(delProductor.campos ?? []).map((campo) => CAMPOS[campo] ?? campo).join(", ")}
                  </p>
                </li>
              )}
              {externas.length === 0 && !delProductor && (
                <li className="text-xs text-text-secondary">Ficha ingresada manualmente.</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
            <p className="text-xs font-semibold text-text-primary">Ingrediente asociado</p>
            <p className="mt-1 text-sm font-medium text-brand-700">{insumo.ingrediente.nombre}</p>
          </div>

          <Button className="w-full" onClick={onVolver}>
            Volver a Insumos
          </Button>
          <Button variant="secondary" className="w-full" onClick={onOtro}>
            Registrar otro insumo
            <IconoFlechaDerecha />
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Tarjeta({
  titulo,
  descripcion,
  imagen,
  nombre,
  children,
}: {
  titulo: string;
  descripcion: string;
  imagen?: { url: string | null; fuente: string };
  nombre?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        {imagen && nombre && <MiniaturaProducto src={imagen.url} nombre={nombre} fuente={imagen.fuente} tamano={64} />}
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{titulo}</h3>
          <p className="mt-0.5 text-xs text-text-secondary">{descripcion}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Dato({ etiqueta, valor, mono = false }: { etiqueta: string; valor: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary">{etiqueta}</p>
      <p className={`mt-1 text-sm font-medium text-text-primary ${mono ? "font-mono" : ""}`}>{valor || "No informado"}</p>
    </div>
  );
}

function Alergenos({
  titulo,
  items,
  detalle,
  peligro = false,
}: {
  titulo: string;
  items: Insumo["alergenos_declarados"];
  detalle: Record<string, { fuentes?: string[] }>;
  peligro?: boolean;
}) {
  return (
    <div>
      <p className={`text-sm font-semibold ${peligro ? "text-error" : "text-warning"}`}>{titulo}</p>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {items.map((item) => {
            const fuentes = detalle[item.codigo]?.fuentes;
            return (
              <li key={item.alergeno_id}>
                <span
                  className={`inline-block rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    peligro
                      ? "border-error-border bg-error-bg text-error"
                      : "border-warning-border bg-warning-bg text-warning"
                  }`}
                >
                  {item.nombre}
                </span>
                {fuentes && fuentes.length > 0 && (
                  <span className="ml-2 text-xs text-text-secondary">
                    Fuentes: {fuentes.map((fuente) => (fuente === "manual" ? "Agregado por ti" : nombreDeOrigen(fuente))).join(" · ")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-text-secondary">Ninguno.</p>
      )}
    </div>
  );
}
