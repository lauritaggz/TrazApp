import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import IngredientCreateDialog from "@/components/ingredients/IngredientCreateDialog";
import AlergenosSelector from "@/components/insumos/AlergenosSelector";
import ProductFormSection from "@/components/products/ProductFormSection";
import Button from "@/components/ui/Button";
import FormActions from "@/components/ui/FormActions";
import { Input } from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import {
  INSUMO_FORM_FIELD_ORDER,
  type InsumoFormFieldErrors,
} from "@/lib/insumoFormValidation";
import type { Ingrediente } from "@/types/ingredient";
import type { SugerenciasAlergenos } from "@/types/consultaCodigo";
import type {
  IngredienteResumen,
  InsumoDuplicateInfo,
  InsumoFormMode,
  InsumoFormValues,
  AlergenosValue,
} from "@/types/insumo";

interface InsumoFormProps {
  values: InsumoFormValues;
  errors: InsumoFormFieldErrors;
  /** Active ingredients the supply can belong to. */
  ingredientes: Ingrediente[];
  ingredientesLoading?: boolean;
  ingredientesError?: string;
  onIngredientesRetry?: () => void;
  /** Edit mode: the ingredient already assigned, kept as an option even if it is no longer active. */
  ingredienteActual?: IngredienteResumen | null;
  mode?: InsumoFormMode;
  loading?: boolean;
  errorFocusToken?: number;
  /** The barcode belongs to another supply of the productor (409). */
  duplicate?: InsumoDuplicateInfo | null;
  reactivating?: boolean;
  onReactivate?: () => void;
  submitLabel?: string;
  loadingLabel?: string;
  /** Inside another dialog (HU05): one column, no card and no floating action bar. */
  embedded?: boolean;
  /** HU05: the supply is registered for this ingredient, which cannot be changed. */
  ingredienteFijo?: IngredienteResumen | null;
  /**
   * HU05: with a repeated barcode of an ACTIVE supply, offer "Usar este insumo" instead of
   * the link to its detail. Without it the form behaves as in HU04.
   */
  onUseExisting?: () => void;
  usingExisting?: boolean;
  /**
   * HU13 (T13-09): offers "Crear ingrediente" next to the selector. The dialog creates it without
   * leaving the page; the parent adds it to its list here and the form selects it, leaving
   * everything else as it was. Without it (or with a fixed ingredient) the button is not shown.
   */
  onIngredienteCreado?: (ingrediente: Ingrediente) => void;
  /**
   * HT06, create mode: the allergens declared in this same form. Without them (edit mode) the
   * selector is not shown: the allergens of an existing supply are managed in its detail.
   */
  alergenos?: AlergenosValue;
  onAlergenosChange?: (value: AlergenosValue) => void;
  /** Show the "declare or confirm" message (the form turns it on after a failed save). */
  mostrarErrorAlergenos?: boolean;
  /**
   * HU13, presentation only: the allergens were suggested from a barcode lookup. Shows the notice,
   * where each one comes from and the terms that could not be tied to the catalog. The supply is
   * reviewed only when the form is saved, never by being suggested.
   */
  sugerencias?: SugerenciasAlergenos;
  onChange: (values: InsumoFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function InsumoForm({
  values,
  errors,
  ingredientes,
  ingredientesLoading = false,
  ingredientesError,
  onIngredientesRetry,
  ingredienteActual = null,
  mode = "create",
  loading = false,
  errorFocusToken = 0,
  duplicate = null,
  reactivating = false,
  onReactivate,
  submitLabel = mode === "edit" ? "Guardar cambios" : "Crear insumo",
  loadingLabel = mode === "edit" ? "Guardando…" : "Creando…",
  embedded = false,
  ingredienteFijo = null,
  onUseExisting,
  usingExisting = false,
  onIngredienteCreado,
  alergenos,
  onAlergenosChange,
  mostrarErrorAlergenos = false,
  sugerencias,
  onChange,
  onSubmit,
  onCancel,
}: InsumoFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [creandoIngrediente, setCreandoIngrediente] = useState(false);
  const devolverFoco = useRef(false);

  // The dialog hands the focus back to its button when it closes; the selector is what changed.
  useEffect(() => {
    if (creandoIngrediente || !devolverFoco.current) return;
    devolverFoco.current = false;
    formRef.current?.querySelector<HTMLElement>('[name="ingrediente_id"]')?.focus();
  }, [creandoIngrediente]);

  function cerrarDialogoDeIngrediente() {
    devolverFoco.current = true;
    setCreandoIngrediente(false);
  }

  function handleIngredienteCreado(ingrediente: Ingrediente) {
    onIngredienteCreado?.(ingrediente);
    onChange({ ...values, ingrediente_id: String(ingrediente.id) });
    cerrarDialogoDeIngrediente();
  }

  useEffect(() => {
    if (!errorFocusToken || !formRef.current) return;
    const firstErrorField = INSUMO_FORM_FIELD_ORDER.find((field) => errors[field]);
    if (!firstErrorField) {
      // Only the allergen declaration is missing: its confirmation checkbox is the way out.
      if (mostrarErrorAlergenos) {
        formRef.current.querySelector<HTMLElement>('[name="sin_alergenos"]')?.focus();
      }
      return;
    }
    formRef.current
      .querySelector<HTMLElement>(`[name="${firstErrorField}"]`)
      ?.focus();
  }, [errorFocusToken, errors, mostrarErrorAlergenos]);

  function update<K extends keyof InsumoFormValues>(key: K, value: InsumoFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  const options = [...ingredientes];
  const faltaElActual =
    ingredienteActual != null && !options.some((item) => item.id === ingredienteActual.id);
  const sinIngredientes =
    !ingredienteFijo &&
    !ingredientesLoading &&
    !ingredientesError &&
    options.length === 0 &&
    !ingredienteActual;

  const actions = (
    <>
      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        onClick={onCancel}
        disabled={loading}
      >
        Cancelar
      </Button>
      <Button type="submit" className="w-full sm:w-auto" loading={loading}>
        {loading ? loadingLabel : submitLabel}
      </Button>
    </>
  );

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={embedded ? "space-y-4" : "max-w-2xl space-y-6"}
        noValidate
      >
        <div
          className={
            embedded
              ? "space-y-8"
              : "space-y-8 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
          }
        >
          <ProductFormSection
            id="insumo-form-general"
            title="Información general"
            description="Qué insumo es y a qué ingrediente abastece."
          >
            <Input
              label="Nombre"
              name="nombre"
              placeholder="Chocolate Ambrosoli 500 g"
              value={values.nombre}
              onChange={(e) => update("nombre", e.target.value)}
              error={errors.nombre}
              disabled={loading}
              maxLength={255}
              autoComplete="off"
              required
            />
            <Input
              label="Marca u origen"
              name="marca_origen"
              placeholder="Ambrosoli"
              value={values.marca_origen}
              onChange={(e) => update("marca_origen", e.target.value)}
              error={errors.marca_origen}
              hint="Por ejemplo, la marca del producto o 'Feria local'."
              disabled={loading}
              maxLength={255}
              autoComplete="off"
              required
            />

            <div className="space-y-2">
              <Select
                label="Ingrediente"
                name="ingrediente_id"
                value={values.ingrediente_id}
                onChange={(e) => update("ingrediente_id", e.target.value)}
                error={errors.ingrediente_id}
                hint={
                  ingredienteFijo
                    ? "Este insumo se registra para el ingrediente de la línea."
                    : "El ingrediente genérico al que abastece este insumo."
                }
                disabled={
                  Boolean(ingredienteFijo) ||
                  loading ||
                  ingredientesLoading ||
                  Boolean(ingredientesError)
                }
                required
              >
                {ingredienteFijo ? (
                  <option value={ingredienteFijo.id}>{ingredienteFijo.nombre}</option>
                ) : (
                  <>
                    <option value="">
                      {ingredientesLoading ? "Cargando ingredientes..." : "Selecciona un ingrediente"}
                    </option>
                    {faltaElActual && ingredienteActual && (
                      <option value={ingredienteActual.id}>
                        {ingredienteActual.nombre} (desactivado)
                      </option>
                    )}
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </>
                )}
              </Select>
              {ingredientesError && !ingredienteFijo && (
                <div className="flex flex-wrap items-center gap-3" role="alert">
                  <p className="text-[13px] text-error">{ingredientesError}</p>
                  {onIngredientesRetry && (
                    <Button type="button" variant="secondary" onClick={onIngredientesRetry}>
                      Reintentar
                    </Button>
                  )}
                </div>
              )}
              {sinIngredientes && (
                <p className="text-[13px] text-text-secondary">Aún no tienes ingredientes activos.</p>
              )}
              {!ingredienteFijo && onIngredienteCreado && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full sm:w-auto px-2"
                  onClick={() => setCreandoIngrediente(true)}
                  disabled={loading}
                >
                  Crear ingrediente
                </Button>
              )}
            </div>

            <Input
              label="Presentación"
              name="presentacion"
              placeholder="Ej.: Barra de 500 g"
              value={values.presentacion}
              onChange={(e) => update("presentacion", e.target.value)}
              error={errors.presentacion}
              hint="Opcional."
              disabled={loading}
              maxLength={255}
              autoComplete="off"
            />

            <div className="space-y-2">
              <Input
                label="Código de barras"
                name="codigo_barras"
                inputMode="numeric"
                placeholder="7802910000971"
                value={values.codigo_barras}
                onChange={(e) => update("codigo_barras", e.target.value)}
                error={errors.codigo_barras}
                hint="Opcional. EAN-8, UPC-A o EAN-13 (8, 12 o 13 dígitos)."
                disabled={loading}
                autoComplete="off"
              />
              {duplicate && (
                <div className="flex flex-wrap items-center gap-3" aria-live="polite">
                  {duplicate.activo && onUseExisting ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onUseExisting}
                      loading={usingExisting}
                    >
                      Usar este insumo
                    </Button>
                  ) : duplicate.activo ? (
                    <Link
                      to={`/insumos/${duplicate.insumoId}`}
                      className="text-sm font-medium text-accent-strong underline-offset-2 hover:underline"
                    >
                      Ver insumo existente
                    </Link>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onReactivate}
                      loading={reactivating}
                    >
                      Reactivar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ProductFormSection>

          <ProductFormSection
            id="insumo-form-declarado"
            title="Información declarada"
            description="Lo que dice el envase. Es lo que se conserva en cada elaboración."
            optional
          >
            <Textarea
              label="Ingredientes declarados"
              name="ingredientes_declarados"
              rows={3}
              placeholder="Azúcar, pasta de cacao, leche en polvo"
              value={values.ingredientes_declarados}
              onChange={(e) => update("ingredientes_declarados", e.target.value)}
              error={errors.ingredientes_declarados}
              hint="Tal como aparecen en el envase."
              disabled={loading}
            />
            <Textarea
              label="Advertencias"
              name="advertencias"
              rows={2}
              placeholder="Puede contener trazas de maní"
              value={values.advertencias}
              onChange={(e) => update("advertencias", e.target.value)}
              error={errors.advertencias}
              disabled={loading}
            />
          </ProductFormSection>

          {mode === "create" && alergenos && onAlergenosChange && (
            <ProductFormSection
              id="insumo-form-alergenos"
              title="Alérgenos"
              description="Obligatorio: declara los alérgenos del envase o confirma que no contiene ninguno."
            >
              {sugerencias && <AvisoAlergenosSugeridos sugerencias={sugerencias} />}
              <AlergenosSelector
                value={alergenos}
                onChange={onAlergenosChange}
                disabled={loading}
                mostrarError={mostrarErrorAlergenos}
                origenes={sugerencias?.origenes}
              />
            </ProductFormSection>
          )}

          <ProductFormSection
            id="insumo-form-uso"
            title="Uso en elaboraciones"
            optional
          >
            <div className="space-y-0.5">
              <label
                htmlFor="insumo-habitual"
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-text-primary"
              >
                <input
                  id="insumo-habitual"
                  type="checkbox"
                  name="habitual"
                  checked={values.habitual}
                  onChange={(e) => update("habitual", e.target.checked)}
                  disabled={loading}
                  aria-describedby="insumo-habitual-ayuda"
                  className="h-5 w-5 shrink-0 rounded border-border-strong accent-brand-600"
                />
                Insumo habitual
              </label>
              <p id="insumo-habitual-ayuda" className="pl-8 text-[13px] text-text-secondary">
                Se preselecciona al crear una elaboración.
              </p>
            </div>
            {errors.habitual && (
              <p className="text-[13px] text-error">{errors.habitual}</p>
            )}
          </ProductFormSection>
        </div>

        {embedded ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {actions}
          </div>
        ) : (
          <FormActions>{actions}</FormActions>
        )}
      </form>

      {/* Outside the <form>: the dialog has its own form, and a nested one would submit this one. */}
      {creandoIngrediente && (
        <IngredientCreateDialog
          description="El ingrediente se guardará en tu catálogo y quedará seleccionado en este insumo."
          onCreated={handleIngredienteCreado}
          onCancel={cerrarDialogoDeIngrediente}
        />
      )}
    </>
  );
}

export const AVISO_ALERGENOS_SUGERIDOS =
  "Alérgenos sugeridos automáticamente. Compáralos con la etiqueta del envase antes de registrar.";

function AvisoAlergenosSugeridos({ sugerencias }: { sugerencias: SugerenciasAlergenos }) {
  const haySugeridos = Object.keys(sugerencias.origenes).length > 0;
  const { sinReconocer } = sugerencias;
  return (
    <div className="space-y-3">
      {haySugeridos && (
        <p
          role="note"
          className="rounded-lg border border-info-border bg-info-bg px-3.5 py-3 text-sm leading-relaxed text-info"
        >
          {AVISO_ALERGENOS_SUGERIDOS}
        </p>
      )}
      {sinReconocer.length > 0 && (
        <div
          role="note"
          className="space-y-1.5 rounded-lg border border-warning-border bg-warning-bg px-3.5 py-3 text-sm leading-relaxed text-warning"
        >
          <p className="font-medium">No pudimos asociar:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {sinReconocer.map((termino) => (
              <li key={termino}>{termino}</li>
            ))}
          </ul>
          <p>Si corresponden a un alérgeno del catálogo, agrégalo tú con «Agregar alérgeno».</p>
        </div>
      )}
    </div>
  );
}
