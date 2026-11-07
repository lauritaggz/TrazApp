import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import IngredientCreateDialog from "@/components/ingredients/IngredientCreateDialog";
import AlergenosRevision from "@/components/insumos/AlergenosRevision";
import ElegirIngrediente from "@/components/insumos/ElegirIngrediente";
import MiniaturaProducto from "@/components/insumos/MiniaturaProducto";
import { IconoAlerta, IconoCopiar } from "@/components/insumos/piezasBusqueda";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { fieldClassName } from "@/components/ui/fieldStyles";
import { nombreFuente } from "@/lib/fuentesInsumo";
import { INSUMO_FORM_FIELD_ORDER, type InsumoFormFieldErrors } from "@/lib/insumoFormValidation";
import {
  alergenosRevisados,
  fuenteDelCampo,
  informacionComercialCompleta,
  nombreDeOrigen,
  trazasVerificadas,
  type DatosRevision,
  type DecisionTermino,
  type RespuestaTrazas,
} from "@/lib/revisionInsumo";
import type { Ingrediente } from "@/types/ingredient";
import type {
  AlergenosValue,
  IngredienteResumen,
  InsumoDuplicateInfo,
  InsumoFormValues,
} from "@/types/insumo";

export const AVISO_COMBINACION = `Fichas combinadas. El código de barras de ${nombreFuente("jumbo")} coincide con el de ${nombreFuente("open_food_facts")}.`;
const FUENTES_DE_LA_REVISION = ["jumbo", "open_food_facts"];

interface RevisionInsumoProps {
  /** Create (a new supply, retrieved or manual) or edit. */
  modo: "crear" | "editar";
  values: InsumoFormValues;
  /** The values the review started from: what a field is compared with to know the productor changed it. */
  inicial: InsumoFormValues;
  errors: InsumoFormFieldErrors;
  onChange: (values: InsumoFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading?: boolean;
  errorFocusToken?: number;
  ingredientes: Ingrediente[];
  ingredientesLoading?: boolean;
  ingredientesError?: string;
  onIngredientesRetry?: () => void;
  onIngredienteCreado?: (ingrediente: Ingrediente) => void;
  /** Edit mode: the ingredient already assigned. */
  ingredienteActual?: IngredienteResumen | null;
  /** The barcode belongs to another supply of the productor (409). */
  duplicate?: InsumoDuplicateInfo | null;
  reactivating?: boolean;
  onReactivate?: () => void;
  /** Create mode: the allergens declared in this same review (HT06). */
  alergenos?: AlergenosValue;
  onAlergenosChange?: (value: AlergenosValue) => void;
  mostrarErrorAlergenos?: boolean;
  /** Where the data came from; without it (manual entry, edit of a manual supply) no sources are shown. */
  revision?: DatosRevision;
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * The review of a supply (HU07 / T07-07), as in the design: identification, declared ingredients and allergens on
 * the left; the ingredient, the confirmation and the origin on the right (two columns from `xl`). It is the one
 * form of a supply on the page: a new supply from a lookup, a manual one and the edit of a saved one. Nothing is
 * registered until the productor confirms, and the button only works with every requirement done.
 */
export default function RevisionInsumo({
  modo,
  values,
  inicial,
  errors,
  onChange,
  onSubmit,
  onCancel,
  loading = false,
  errorFocusToken = 0,
  ingredientes,
  ingredientesLoading = false,
  ingredientesError,
  onIngredientesRetry,
  onIngredienteCreado,
  ingredienteActual = null,
  duplicate = null,
  reactivating = false,
  onReactivate,
  alergenos,
  onAlergenosChange,
  mostrarErrorAlergenos = false,
  revision,
}: RevisionInsumoProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const tituloIngredientesId = useId();
  const [creandoIngrediente, setCreandoIngrediente] = useState(false);
  const devolverFoco = useRef(false);
  const [respuestaTrazas, setRespuestaTrazas] = useState<RespuestaTrazas>("");
  const [decisiones, setDecisiones] = useState<Record<string, DecisionTermino>>({});
  const crear = modo === "crear";

  // A review that a lookup just filled in starts in view, smooth unless the person prefers reduced motion (HT07).
  const recuperada = crear && revision !== undefined;
  useEffect(() => {
    if (!recuperada) return;
    const sinMovimiento =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.scrollIntoView({ behavior: sinMovimiento ? "auto" : "smooth", block: "start" });
  }, [recuperada]);

  // The dialog hands the focus back to its button when it closes; the chosen ingredient is what changed.
  useEffect(() => {
    if (creandoIngrediente || !devolverFoco.current) return;
    devolverFoco.current = false;
    const form = formRef.current;
    // The focus goes to the ingredient that is chosen (the one just created), else to the first option.
    (
      form?.querySelector<HTMLElement>('[name="ingrediente_id"]:checked') ??
      form?.querySelector<HTMLElement>('[name="ingrediente_id"]')
    )?.focus();
  }, [creandoIngrediente]);

  useEffect(() => {
    if (!errorFocusToken || !formRef.current) return;
    const primerCampo = INSUMO_FORM_FIELD_ORDER.find((campo) => errors[campo]);
    if (!primerCampo) {
      if (mostrarErrorAlergenos) formRef.current.querySelector<HTMLElement>('[name="sin_alergenos"]')?.focus();
      return;
    }
    formRef.current.querySelector<HTMLElement>(`[name="${primerCampo}"]`)?.focus();
  }, [errorFocusToken, errors, mostrarErrorAlergenos]);

  function actualizar<K extends keyof InsumoFormValues>(clave: K, valor: InsumoFormValues[K]) {
    onChange({ ...values, [clave]: valor });
  }

  function cerrarDialogoDeIngrediente() {
    devolverFoco.current = true;
    setCreandoIngrediente(false);
  }

  function alCrearIngrediente(ingrediente: Ingrediente) {
    onIngredienteCreado?.(ingrediente);
    onChange({ ...values, ingrediente_id: String(ingrediente.id) });
    cerrarDialogoDeIngrediente();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (puedeConfirmar) onSubmit();
  }

  const valorAlergenos = alergenos ?? { items: [], sinAlergenos: false };
  const comercialListo = informacionComercialCompleta(values);
  const ingredienteListo = Boolean(values.ingrediente_id);
  const trazasListas = trazasVerificadas(valorAlergenos, respuestaTrazas);
  const alergenosListos = alergenosRevisados(valorAlergenos, revision?.sinReconocer ?? [], decisiones);
  const puedeConfirmar =
    comercialListo && ingredienteListo && (!crear || (trazasListas && alergenosListos)) && !loading;

  const fuente = (campo: keyof InsumoFormValues) => fuenteDelCampo(revision, campo, inicial, values);
  const combinada = revision?.fuente === "combinada";

  return (
    <>
      <form ref={formRef} onSubmit={enviar} noValidate data-revision-recuperada={recuperada || undefined} className="scroll-mt-4">
        {revision?.sinRespuesta.includes("jumbo") && (
          <AvisoDeFuente
            titulo={`${nombreFuente("jumbo")} no respondió a tiempo`}
            detalle={`Continuamos con la información encontrada en ${nombreFuente("open_food_facts")}. Puedes revisar y completar todos los campos.`}
          />
        )}
        {revision?.jumboSinCoincidencia && (
          <AvisoDeFuente
            titulo={`No encontramos el mismo código en ${nombreFuente("jumbo")}`}
            detalle={`Para evitar mezclar productos distintos, continuamos solo con ${nombreFuente("open_food_facts")}.`}
          />
        )}

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-5">
            <Tarjeta
              titulo="Identificación comercial"
              descripcion="Revisa y corrige los datos antes de registrar."
              izquierda={
                revision?.imagen ? (
                  <MiniaturaProducto
                    src={revision.imagen.url}
                    nombre={values.nombre.trim() || "Producto encontrado"}
                    fuente={revision.imagen.fuente}
                    tamano={64}
                  />
                ) : undefined
              }
            >
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <Campo id="insumo-nombre" etiqueta="Nombre" fuente={fuente("nombre")}>
                  <Input
                    id="insumo-nombre"
                    name="nombre"
                    placeholder="Chocolate Ambrosoli 500 g"
                    value={values.nombre}
                    onChange={(e) => actualizar("nombre", e.target.value)}
                    error={errors.nombre}
                    disabled={loading}
                    maxLength={255}
                    autoComplete="off"
                    required
                  />
                </Campo>
                <Campo id="insumo-marca" etiqueta="Marca u origen" fuente={fuente("marca_origen")}>
                  <Input
                    id="insumo-marca"
                    name="marca_origen"
                    placeholder="Ambrosoli"
                    value={values.marca_origen}
                    onChange={(e) => actualizar("marca_origen", e.target.value)}
                    error={errors.marca_origen}
                    disabled={loading}
                    maxLength={255}
                    autoComplete="off"
                    required
                  />
                </Campo>
                <Campo id="insumo-presentacion" etiqueta="Presentación" opcional fuente={fuente("presentacion")}>
                  <Input
                    id="insumo-presentacion"
                    name="presentacion"
                    placeholder="Ej.: Barra de 500 g"
                    value={values.presentacion}
                    onChange={(e) => actualizar("presentacion", e.target.value)}
                    error={errors.presentacion}
                    disabled={loading}
                    maxLength={255}
                    autoComplete="off"
                  />
                </Campo>
                <Campo
                  id="insumo-codigo"
                  etiqueta="Código de barras"
                  opcional
                  fuente={fuente("codigo_barras")}
                  extra={
                    duplicate && (
                      <div className="flex flex-wrap items-center gap-3" aria-live="polite">
                        {duplicate.activo ? (
                          <Link
                            to={`/insumos/${duplicate.insumoId}`}
                            className="text-sm font-medium text-accent-strong underline-offset-2 hover:underline"
                          >
                            Ver insumo existente
                          </Link>
                        ) : (
                          <Button type="button" variant="secondary" onClick={onReactivate} loading={reactivating}>
                            Reactivar
                          </Button>
                        )}
                      </div>
                    )
                  }
                >
                  <Input
                    id="insumo-codigo"
                    name="codigo_barras"
                    inputMode="numeric"
                    placeholder="7802910000971"
                    value={values.codigo_barras}
                    onChange={(e) => actualizar("codigo_barras", e.target.value)}
                    error={errors.codigo_barras}
                    hint="EAN-8, UPC-A o EAN-13 (8, 12 o 13 dígitos)."
                    disabled={loading}
                    autoComplete="off"
                  />
                </Campo>
              </div>
              {combinada && (
                <div className="mx-5 mb-5 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-3">
                  <span className="mt-0.5 text-brand-600">
                    <IconoCopiar size={15} />
                  </span>
                  <p className="text-xs leading-relaxed text-brand-700">{AVISO_COMBINACION}</p>
                </div>
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Ingredientes declarados"
              tituloId={tituloIngredientesId}
              descripcion="Transcripción editable de la declaración del envase."
              derecha={
                revision && fuente("ingredientes_declarados") ? (
                  <EtiquetaDeFuente texto={fuente("ingredientes_declarados") as string} />
                ) : undefined
              }
            >
              <div className="space-y-4 p-5">
                <div>
                  <textarea
                    name="ingredientes_declarados"
                    aria-labelledby={tituloIngredientesId}
                    rows={4}
                    placeholder="Azúcar, pasta de cacao, leche en polvo"
                    value={values.ingredientes_declarados}
                    onChange={(e) => actualizar("ingredientes_declarados", e.target.value)}
                    disabled={loading}
                    aria-invalid={errors.ingredientes_declarados ? true : undefined}
                    className={fieldClassName(Boolean(errors.ingredientes_declarados), "min-h-24 resize-y leading-relaxed")}
                  />
                  {errors.ingredientes_declarados && (
                    <p className="mt-1.5 text-[13px] text-error">{errors.ingredientes_declarados}</p>
                  )}
                  {revision && fuente("ingredientes_declarados") && (
                    <LineaDeFuente texto={fuente("ingredientes_declarados") as string} />
                  )}
                </div>
                <Campo id="insumo-advertencias" etiqueta="Advertencias" opcional>
                  <textarea
                    id="insumo-advertencias"
                    name="advertencias"
                    rows={2}
                    placeholder="Puede contener trazas de maní"
                    value={values.advertencias}
                    onChange={(e) => actualizar("advertencias", e.target.value)}
                    disabled={loading}
                    aria-invalid={errors.advertencias ? true : undefined}
                    className={fieldClassName(Boolean(errors.advertencias), "resize-y")}
                  />
                  {errors.advertencias && <p className="mt-1.5 text-[13px] text-error">{errors.advertencias}</p>}
                </Campo>
              </div>
            </Tarjeta>

            {crear && alergenos && onAlergenosChange && (
              <Tarjeta
                destacada
                titulo={combinada ? "Alérgenos combinados" : "Alérgenos"}
                descripcion="Revisa esta sección con el envase a la vista. Es obligatoria antes de confirmar."
              >
                <AlergenosRevision
                  value={alergenos}
                  onChange={onAlergenosChange}
                  revision={revision}
                  respuestaTrazas={respuestaTrazas}
                  onRespuestaTrazas={setRespuestaTrazas}
                  decisiones={decisiones}
                  onDecidir={(termino, decision) => setDecisiones((actuales) => ({ ...actuales, [termino]: decision }))}
                  disabled={loading}
                />
              </Tarjeta>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-5">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-text-primary">Asociar a un ingrediente</h2>
              <p className="mb-4 mt-1 text-xs leading-relaxed text-text-secondary">
                Elige qué ingrediente de tus formulaciones cubre este producto comercial.
              </p>
              <ElegirIngrediente
                valor={values.ingrediente_id}
                onElegir={(id) => actualizar("ingrediente_id", id)}
                ingredientes={ingredientes}
                ingredienteActual={ingredienteActual}
                cargando={ingredientesLoading}
                error={ingredientesError}
                onReintentar={onIngredientesRetry}
                mensaje={errors.ingrediente_id}
                deshabilitado={loading}
                onCrear={onIngredienteCreado ? () => setCreandoIngrediente(true) : undefined}
              />
              <div className="mt-4 border-t border-border pt-3">
                <label
                  htmlFor="insumo-habitual"
                  className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-text-primary"
                >
                  <input
                    id="insumo-habitual"
                    type="checkbox"
                    name="habitual"
                    checked={values.habitual}
                    onChange={(e) => actualizar("habitual", e.target.checked)}
                    disabled={loading}
                    className="h-5 w-5 shrink-0 rounded border-border-strong accent-brand-600"
                  />
                  Insumo habitual
                </label>
                {errors.habitual && <p className="text-[13px] text-error">{errors.habitual}</p>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-text-primary">
                {crear ? "Confirmar registro" : "Confirmar cambios"}
              </h2>
              <ul className="mt-4 space-y-2.5" aria-label="Requisitos para confirmar">
                <FilaDeRequisito listo={comercialListo} texto="Información comercial revisada" />
                <FilaDeRequisito listo={ingredienteListo} texto="Ingrediente asociado" />
                {crear && <FilaDeRequisito listo={trazasListas} texto="Trazas verificadas" />}
                {crear && <FilaDeRequisito listo={alergenosListos} texto="Alérgenos revisados" />}
              </ul>
              <Button type="submit" className="mt-5 w-full" disabled={!puedeConfirmar} loading={loading}>
                {loading
                  ? crear
                    ? "Creando…"
                    : "Guardando…"
                  : crear
                    ? "Confirmar registro"
                    : "Guardar cambios"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="mt-2 w-full text-text-secondary"
                onClick={onCancel}
                disabled={loading}
              >
                Cancelar
              </Button>
              <p className="mt-2.5 text-center text-xs text-text-secondary">
                {crear ? "Cancelar no guarda ningún dato." : "Cancelar descarta los cambios."}
              </p>
            </div>

            {revision && Object.keys(revision.fechas).length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-4">
                <h2 className="text-xs font-semibold text-text-primary">Origen de la ficha</h2>
                <ul className="mt-3 space-y-2">
                  {FUENTES_DE_LA_REVISION.filter(
                    (fuenteDeOrigen) => revision.fechas[fuenteDeOrigen] || revision.sinRespuesta.includes(fuenteDeOrigen),
                  ).map((fuenteDeOrigen) => (
                    <li key={fuenteDeOrigen} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-text-primary">{nombreDeOrigen(fuenteDeOrigen)}</span>
                      <span className={revision.fechas[fuenteDeOrigen] ? "text-success" : "text-text-secondary"}>
                        {revision.fechas[fuenteDeOrigen]
                          ? `Recuperado el ${formatearFecha(revision.fechas[fuenteDeOrigen])}`
                          : "No respondió"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </form>

      {/* Outside the <form>: the dialog has its own form, and a nested one would submit this one. */}
      {creandoIngrediente && (
        <IngredientCreateDialog
          description="El ingrediente se guardará en tu catálogo y quedará seleccionado en este insumo."
          onCreated={alCrearIngrediente}
          onCancel={cerrarDialogoDeIngrediente}
        />
      )}
    </>
  );
}

function Tarjeta({
  titulo,
  tituloId,
  descripcion,
  izquierda,
  derecha,
  destacada = false,
  children,
}: {
  titulo: string;
  tituloId?: string;
  descripcion: string;
  izquierda?: ReactNode;
  derecha?: ReactNode;
  destacada?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl bg-card ${destacada ? "border-2 border-brand-200 shadow-sm" : "border border-border"}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {izquierda}
          <div>
            <h2 id={tituloId} className="text-sm font-semibold text-text-primary">
              {titulo}
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">{descripcion}</p>
          </div>
        </div>
        {derecha}
      </div>
      {children}
    </section>
  );
}

/** A field of the review: its label (with «Opcional» beside it when it is), the control and where it came from. */
function Campo({
  id,
  etiqueta,
  opcional = false,
  fuente,
  extra,
  children,
}: {
  id: string;
  etiqueta: string;
  opcional?: boolean;
  fuente?: string | null;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {etiqueta}
        </label>
        {opcional && <span className="text-xs text-text-secondary">Opcional</span>}
      </div>
      {children}
      {fuente && <LineaDeFuente texto={fuente} />}
      {extra}
    </div>
  );
}

function LineaDeFuente({ texto }: { texto: string }) {
  return (
    <p className="flex items-center gap-1 text-xs text-text-secondary">
      Fuente: <strong className="font-medium text-text-primary">{texto}</strong>
    </p>
  );
}

function EtiquetaDeFuente({ texto }: { texto: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
      {texto}
    </span>
  );
}

function FilaDeRequisito({ listo, texto }: { listo: boolean; texto: string }) {
  return (
    <li className={`flex items-center gap-2 text-xs ${listo ? "text-success" : "text-text-secondary"}`}>
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          listo ? "border-success bg-success text-white" : "border-border-strong"
        }`}
      >
        {listo && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {texto}
      <span className="sr-only">{listo ? " (listo)" : " (pendiente)"}</span>
    </li>
  );
}

function AvisoDeFuente({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-warning-border bg-warning-bg p-4" role="status">
      <span className="mt-0.5 text-warning">
        <IconoAlerta />
      </span>
      <div>
        <p className="text-sm font-semibold text-warning">{titulo}</p>
        <p className="mt-1 text-xs text-text-secondary">{detalle}</p>
      </div>
    </div>
  );
}
