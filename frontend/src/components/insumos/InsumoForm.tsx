import { useEffect, useRef, type FormEvent } from "react";
import { Link } from "react-router-dom";
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
import type {
  IngredienteResumen,
  InsumoDuplicateInfo,
  InsumoFormMode,
  InsumoFormValues,
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
  submitLabel = mode === "edit" ? "Guardar cambios" : "Guardar insumo",
  loadingLabel = "Guardando…",
  embedded = false,
  onChange,
  onSubmit,
  onCancel,
}: InsumoFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!errorFocusToken || !formRef.current) return;
    const firstErrorField = INSUMO_FORM_FIELD_ORDER.find((field) => errors[field]);
    if (!firstErrorField) return;
    formRef.current
      .querySelector<HTMLElement>(`[name="${firstErrorField}"]`)
      ?.focus();
  }, [errorFocusToken, errors]);

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
    !ingredientesLoading && !ingredientesError && options.length === 0 && !ingredienteActual;

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
          description="Qué producto comercial es y a qué ingrediente abastece."
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
              hint="El ingrediente genérico al que abastece este insumo."
              disabled={loading || ingredientesLoading || Boolean(ingredientesError)}
              required
            >
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
            </Select>
            {ingredientesError && (
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
              <p className="text-[13px] text-text-secondary">
                Aún no tienes ingredientes activos.{" "}
                <Link
                  to="/ingredientes/nuevo"
                  className="font-medium text-accent-strong underline-offset-2 hover:underline"
                >
                  Crear un ingrediente
                </Link>
              </p>
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
                {duplicate.activo ? (
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

        <ProductFormSection
          id="insumo-form-uso"
          title="Uso en elaboraciones"
          optional
        >
          <div className="flex items-start gap-3">
            <input
              id="insumo-habitual"
              type="checkbox"
              name="habitual"
              checked={values.habitual}
              onChange={(e) => update("habitual", e.target.checked)}
              disabled={loading}
              aria-describedby="insumo-habitual-ayuda"
              className="mt-1 h-4 w-4 rounded border-border-strong accent-brand-600"
            />
            <div className="space-y-0.5">
              <label
                htmlFor="insumo-habitual"
                className="block text-sm font-medium text-text-primary"
              >
                Insumo habitual
              </label>
              <p id="insumo-habitual-ayuda" className="text-[13px] text-text-secondary">
                Se preselecciona al registrar una elaboración.
              </p>
            </div>
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
  );
}
