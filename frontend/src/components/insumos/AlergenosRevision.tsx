import { useCallback, useEffect, useId, useState } from "react";
import { IconoAlerta } from "@/components/insumos/piezasBusqueda";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { fieldClassName } from "@/components/ui/fieldStyles";
import { ROTULACION_OBLIGATORIA_AYUDA } from "@/lib/alergenos";
import {
  fuentesDelAlergeno,
  type DatosRevision,
  type DecisionTermino,
  type RespuestaTrazas,
} from "@/lib/revisionInsumo";
import { listAlergenosCatalog } from "@/services/ingredientService";
import type { AlergenoCatalogo } from "@/types/ingredient";
import {
  TIPO_CONTIENE,
  TIPO_TRAZAS,
  type AlergenoDeclaradoInput,
  type AlergenosValue,
  type TipoDeclaracion,
} from "@/types/insumo";

const COLUMNAS: { tipo: TipoDeclaracion; titulo: string; otro: string }[] = [
  { tipo: TIPO_CONTIENE, titulo: "Contiene", otro: "Puede contener" },
  { tipo: TIPO_TRAZAS, titulo: "Puede contener", otro: "Contiene" },
];

const tituloDe = (tipo: TipoDeclaracion) => COLUMNAS.find((columna) => columna.tipo === tipo)?.titulo ?? tipo;

export const NOTA_UNION =
  "Los alérgenos se combinan por unión. Una indicación “libre de” se conserva como dato de origen, pero nunca elimina un alérgeno.";

interface AlergenosRevisionProps {
  value: AlergenosValue;
  onChange: (value: AlergenosValue) => void;
  /** Where the data came from; without it (manual entry) no sources are shown. */
  revision?: DatosRevision;
  respuestaTrazas: RespuestaTrazas;
  onRespuestaTrazas: (respuesta: RespuestaTrazas) => void;
  decisiones: Record<string, DecisionTermino>;
  onDecidir: (termino: string, decision: DecisionTermino) => void;
  disabled?: boolean;
}

/**
 * The allergens of the supply under review (HU07 / T07-07, HT06), as in the design: «Contiene» and «Puede
 * contener» side by side, each allergen with the sources that name it, the way to add one, the question about
 * «puede contener» when nobody reported it (CA17), the terms the lookup could not tie to the catalog (CA5) and the
 * «libre de…» claims, which are information only (CA16). It is controlled and makes no request except loading
 * the allergen catalog.
 */
export default function AlergenosRevision({
  value,
  onChange,
  revision,
  respuestaTrazas,
  onRespuestaTrazas,
  decisiones,
  onDecidir,
  disabled = false,
}: AlergenosRevisionProps) {
  const sinId = useId();
  const [catalogo, setCatalogo] = useState<AlergenoCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState("");
  // The class the next added allergen gets: «Contiene» by default (one list of chips for both columns).
  const [tipoAgregar, setTipoAgregar] = useState<TipoDeclaracion>(TIPO_CONTIENE);

  const cargarCatalogo = useCallback(async () => {
    setCargando(true);
    setErrorCatalogo("");
    try {
      setCatalogo(await listAlergenosCatalog());
    } catch {
      setCatalogo([]);
      setErrorCatalogo("No pudimos cargar el catálogo de alérgenos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarCatalogo();
  }, [cargarCatalogo]);

  const declarados = new Set(value.items.map((item) => item.alergeno_id));
  const disponibles = catalogo.filter((item) => !declarados.has(item.id));
  const nombreDe = (id: number) => catalogo.find((item) => item.id === id)?.nombre ?? `Alérgeno ${id}`;
  const obligatorioDe = (id: number) => catalogo.find((item) => item.id === id)?.obligatorio_chile ?? false;

  function agregar(alergenoId: number, tipo: TipoDeclaracion) {
    // Declaring an allergen as «Contiene» contradicts «no contiene»; a trace makes the answer about traces moot.
    onChange({
      items: [...value.items, { alergeno_id: alergenoId, tipo }],
      sinAlergenos: tipo === TIPO_CONTIENE ? false : value.sinAlergenos,
    });
    if (tipo === TIPO_TRAZAS) onRespuestaTrazas("");
  }

  function quitar(alergenoId: number) {
    onChange({ ...value, items: value.items.filter((item) => item.alergeno_id !== alergenoId) });
  }

  function cambiarTipo(alergenoId: number, destino: TipoDeclaracion) {
    onChange({
      items: value.items.map((item) => (item.alergeno_id === alergenoId ? { ...item, tipo: destino } : item)),
      sinAlergenos: destino === TIPO_CONTIENE ? false : value.sinAlergenos,
    });
    if (destino === TIPO_TRAZAS) onRespuestaTrazas("");
  }

  function marcarSinAlergenos(marcado: boolean) {
    // «No contiene» only speaks about «Contiene»: the traces stay.
    onChange({
      items: marcado ? value.items.filter((item) => item.tipo === TIPO_TRAZAS) : value.items,
      sinAlergenos: marcado,
    });
  }

  const hayTrazas = value.items.some((item) => item.tipo === TIPO_TRAZAS);
  const hayContiene = value.items.some((item) => item.tipo === TIPO_CONTIENE);

  return (
    <div role="group" aria-label="Alérgenos del insumo">
      {cargando && <p className="px-5 py-4 text-sm text-text-secondary">Cargando alérgenos…</p>}
      {errorCatalogo && (
        <div className="space-y-2 px-5 py-4">
          <Alert type="error">{errorCatalogo}</Alert>
          <Button type="button" variant="secondary" onClick={() => void cargarCatalogo()}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {COLUMNAS.map((columna) => {
          const danger = columna.tipo === TIPO_CONTIENE;
          const items = value.items.filter((item) => item.tipo === columna.tipo);
          return (
            <div key={columna.tipo} role="group" aria-label={columna.titulo} className="p-5">
              <div className={`flex items-center gap-2 ${danger ? "text-error" : "text-warning"}`}>
                <IconoAlerta />
                <h3 className="text-sm font-semibold">{columna.titulo}</h3>
              </div>

              {items.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {items.map((item) => (
                    <ItemDeAlergeno
                      key={item.alergeno_id}
                      item={item}
                      nombre={nombreDe(item.alergeno_id)}
                      obligatorio={obligatorioDe(item.alergeno_id)}
                      danger={danger}
                      fuentes={fuentesDelAlergeno(revision, item)}
                      destino={columna.otro}
                      disabled={disabled}
                      onQuitar={() => quitar(item.alergeno_id)}
                      onCambiar={() => cambiarTipo(item.alergeno_id, danger ? TIPO_TRAZAS : TIPO_CONTIENE)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-text-secondary">
                  {danger
                    ? revision
                      ? "Ninguna fuente informa alérgenos que contiene."
                      : "No hay alérgenos declarados como «Contiene»."
                    : revision
                      ? "Ninguna fuente informa trazas."
                      : "No hay alérgenos declarados como «Puede contener»."}
                </p>
              )}

              {danger && !hayContiene && (
                <label
                  htmlFor={sinId}
                  className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-text-primary"
                >
                  <input
                    id={sinId}
                    type="checkbox"
                    name="sin_alergenos"
                    checked={value.sinAlergenos}
                    onChange={(evento) => marcarSinAlergenos(evento.target.checked)}
                    disabled={disabled}
                    className="h-5 w-5 shrink-0 rounded border-border-strong accent-brand-600"
                  />
                  Este insumo no contiene alérgenos
                </label>
              )}

              {!danger && !hayTrazas && (
                <PreguntaTrazas
                  conFuentes={Boolean(revision)}
                  respuesta={respuestaTrazas}
                  onResponder={(respuesta) => {
                    onRespuestaTrazas(respuesta);
                    // «El envase indica…»: the chips below now add traces.
                    if (respuesta === "indica") setTipoAgregar(TIPO_TRAZAS);
                  }}
                  disabled={disabled}
                />
              )}

            </div>
          );
        })}
      </div>

      {disponibles.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-text-primary">Agregar alérgeno</p>
            <div
              role="radiogroup"
              aria-label="Tipo de alérgeno a agregar"
              className="flex w-fit rounded-lg bg-surface p-1"
            >
              {COLUMNAS.map((columna) => (
                <label
                  key={columna.tipo}
                  className={`inline-flex min-h-11 cursor-pointer items-center rounded-md px-3.5 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-accent ${
                    tipoAgregar === columna.tipo ? "bg-card text-text-primary shadow-sm" : "text-text-secondary"
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo_alergeno_agregar"
                    value={columna.tipo}
                    checked={tipoAgregar === columna.tipo}
                    onChange={() => setTipoAgregar(columna.tipo)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  {columna.titulo}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {disponibles.map((alergeno) => (
              <Button
                key={alergeno.id}
                type="button"
                variant="secondary"
                className="!px-3"
                aria-label={`Agregar ${alergeno.nombre} a ${tituloDe(tipoAgregar)}`}
                disabled={disabled}
                onClick={() => agregar(alergeno.id, tipoAgregar)}
              >
                + {alergeno.nombre}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 px-5 pb-5 pt-1">
        {revision && <NotaUnion />}

        {revision && revision.libreDe.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-text-primary">Indicaciones “Libre de…”</p>
            <p className="mt-1 text-xs text-text-secondary">
              Información adicional del producto. No modifica los alérgenos de arriba.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {revision.libreDe.map((indicacion) => (
                <li
                  key={indicacion}
                  className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700"
                >
                  {indicacion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {revision && revision.sinReconocer.length > 0 && (
          <TerminosSinReconocer
            terminos={revision.sinReconocer}
            decisiones={decisiones}
            disponibles={disponibles}
            disabled={disabled}
            onAsignar={(termino, alergeno, tipo) => {
              agregar(alergeno.id, tipo);
              onDecidir(termino, { tipo: "asignado", nombre: alergeno.nombre });
            }}
            onDescartar={(termino) => onDecidir(termino, { tipo: "no_alergeno" })}
          />
        )}
      </div>
    </div>
  );
}

function NotaUnion() {
  return (
    <div className="rounded-lg bg-surface px-3.5 py-3">
      <p className="text-xs leading-relaxed text-text-secondary">{NOTA_UNION}</p>
    </div>
  );
}

interface ItemDeAlergenoProps {
  item: AlergenoDeclaradoInput;
  nombre: string;
  obligatorio: boolean;
  danger: boolean;
  fuentes: string[] | null;
  destino: string;
  disabled: boolean;
  onQuitar: () => void;
  onCambiar: () => void;
}

function ItemDeAlergeno({
  nombre,
  obligatorio,
  danger,
  fuentes,
  destino,
  disabled,
  onQuitar,
  onCambiar,
}: ItemDeAlergenoProps) {
  return (
    <li
      className={`rounded-xl border p-3 ${
        danger ? "border-error-border bg-error-bg" : "border-warning-border bg-warning-bg"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${danger ? "text-error" : "text-warning"}`}>{nombre}</p>
          {obligatorio && (
            <p className="mt-0.5 text-xs text-text-secondary" title={ROTULACION_OBLIGATORIA_AYUDA}>
              Declaración obligatoria
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            className="!p-0 min-w-11 text-text-secondary"
            aria-label={`Mover ${nombre} a ${destino}`}
            title={`Mover a ${destino}`}
            disabled={disabled}
            onClick={onCambiar}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3" />
            </svg>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="!p-0 min-w-11 text-text-secondary"
            aria-label={`Quitar ${nombre}`}
            disabled={disabled}
            onClick={onQuitar}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>
      </div>
      {fuentes && <p className="mt-1.5 text-xs text-text-secondary">Fuentes: {fuentes.join(" · ")}</p>}
    </li>
  );
}

interface PreguntaTrazasProps {
  conFuentes: boolean;
  respuesta: RespuestaTrazas;
  onResponder: (respuesta: RespuestaTrazas) => void;
  disabled: boolean;
}

/** CA17: nobody said «puede contener»; the productor checks the package and answers (mandatory to confirm). */
function PreguntaTrazas({ conFuentes, respuesta, onResponder, disabled }: PreguntaTrazasProps) {
  const opcion = (valor: RespuestaTrazas, texto: string) => (
    <Button
      type="button"
      variant="secondary"
      className={`!justify-start ${respuesta === valor ? "border-brand-600 bg-brand-50 text-brand-700" : ""}`}
      aria-pressed={respuesta === valor}
      disabled={disabled}
      onClick={() => onResponder(valor)}
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          respuesta === valor ? "border-brand-600" : "border-border-strong"
        }`}
      >
        {respuesta === valor && <span className="h-2 w-2 rounded-full bg-brand-600" />}
      </span>
      {texto}
    </Button>
  );
  return (
    <div className="mt-3 rounded-xl border border-warning-border bg-warning-bg p-4">
      <p className="text-sm font-semibold text-warning">
        {conFuentes ? "Ninguna fuente informa “puede contener”" : "¿El envase indica “puede contener”?"}
      </p>
      <p className="mt-1 text-xs text-text-secondary">Revisa el envase y elige una respuesta antes de continuar.</p>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {opcion("no_indica", "El envase no indica “puede contener”")}
        {opcion("indica", "El envase indica…")}
      </div>
      {respuesta === "indica" && (
        <p className="mt-3 text-xs font-semibold text-text-primary">Selecciona los alérgenos indicados</p>
      )}
    </div>
  );
}

interface TerminosSinReconocerProps {
  terminos: string[];
  decisiones: Record<string, DecisionTermino>;
  disponibles: AlergenoCatalogo[];
  disabled: boolean;
  onAsignar: (termino: string, alergeno: AlergenoCatalogo, tipo: TipoDeclaracion) => void;
  onDescartar: (termino: string) => void;
}

/** CA5: each term the lookup could not tie to the catalog needs a decision; none is dropped silently. */
function TerminosSinReconocer({
  terminos,
  decisiones,
  disponibles,
  disabled,
  onAsignar,
  onDescartar,
}: TerminosSinReconocerProps) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [alergenoId, setAlergenoId] = useState("");
  const [tipo, setTipo] = useState<TipoDeclaracion>(TIPO_CONTIENE);

  return (
    <div className="rounded-xl border border-warning-border bg-warning-bg p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-warning">
          <IconoAlerta />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-warning">Términos sin reconocer</p>
          <p className="mt-1 text-xs text-text-secondary">
            Decide cada uno para poder continuar: asígnalo a un alérgeno del catálogo o indica que no es un alérgeno.
          </p>
          <ul className="mt-3 space-y-3">
            {terminos.map((termino) => {
              const decision = decisiones[termino];
              return (
                <li key={termino} className="rounded-lg border border-warning-border bg-card p-3">
                  <p className="text-sm font-semibold text-text-primary">“{termino}”</p>
                  {decision ? (
                    <p className="mt-1 text-xs text-success">
                      {decision.tipo === "asignado" ? `Asignado a ${decision.nombre}` : "No es un alérgeno"}
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          aria-label={`Asignar “${termino}” a un alérgeno`}
                          disabled={disabled}
                          onClick={() => {
                            setAbierto(abierto === termino ? null : termino);
                            setAlergenoId("");
                            setTipo(TIPO_CONTIENE);
                          }}
                        >
                          Asignar a…
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          aria-label={`“${termino}” no es un alérgeno`}
                          disabled={disabled}
                          onClick={() => onDescartar(termino)}
                        >
                          No es un alérgeno
                        </Button>
                      </div>
                      {abierto === termino && (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <select
                            aria-label={`Alérgeno para “${termino}”`}
                            value={alergenoId}
                            onChange={(evento) => setAlergenoId(evento.target.value)}
                            className={fieldClassName(false, "sm:flex-1")}
                          >
                            <option value="">Selecciona un alérgeno</option>
                            {disponibles.map((alergeno) => (
                              <option key={alergeno.id} value={alergeno.id}>
                                {alergeno.nombre}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label={`Tipo para “${termino}”`}
                            value={tipo}
                            onChange={(evento) => setTipo(evento.target.value as TipoDeclaracion)}
                            className={fieldClassName(false, "sm:w-auto")}
                          >
                            <option value={TIPO_CONTIENE}>Contiene</option>
                            <option value={TIPO_TRAZAS}>Puede contener</option>
                          </select>
                          <Button
                            type="button"
                            disabled={!alergenoId}
                            onClick={() => {
                              const elegido = disponibles.find((alergeno) => String(alergeno.id) === alergenoId);
                              if (!elegido) return;
                              onAsignar(termino, elegido, tipo);
                              setAbierto(null);
                            }}
                          >
                            Asignar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
