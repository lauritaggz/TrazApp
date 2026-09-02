import { useEffect, useRef, type FormEvent } from "react";
import ProductFormSection from "@/components/products/ProductFormSection";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  INGREDIENTE_FORM_FIELD_ORDER,
  type IngredienteFormFieldErrors,
} from "@/lib/ingredientFormValidation";
import {
  INGREDIENTE_TIPO_OPTIONS,
  type IngredienteFormMode,
  type IngredienteFormValues,
} from "@/types/ingredient";

interface IngredientFormProps {
  values: IngredienteFormValues;
  errors: IngredienteFormFieldErrors;
  mode?: IngredienteFormMode;
  loading?: boolean;
  errorFocusToken?: number;
  submitLabel?: string;
  loadingLabel?: string;
  onChange: (values: IngredienteFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function IngredientForm({
  values,
  errors,
  mode = "create",
  loading = false,
  errorFocusToken = 0,
  submitLabel = mode === "edit" ? "Guardar cambios" : "Guardar ingrediente",
  loadingLabel = "Guardando…",
  onChange,
  onSubmit,
  onCancel,
}: IngredientFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!errorFocusToken || !formRef.current) return;
    const firstErrorField = INGREDIENTE_FORM_FIELD_ORDER.find(
      (field) => errors[field],
    );
    if (!firstErrorField) return;

    const element = formRef.current.querySelector<HTMLElement>(
      `[name="${firstErrorField}"]`,
    );
    element?.focus();
  }, [errorFocusToken, errors]);

  function update<K extends keyof IngredienteFormValues>(
    key: K,
    value: IngredienteFormValues[K],
  ) {
    onChange({ ...values, [key]: value });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-2"
      noValidate
    >
      <ProductFormSection
        id="ingredient-form-general"
        title="Información general"
        description="Datos básicos del ingrediente."
      >
        <Input
          label="Código interno"
          name="codigo_interno"
          value={values.codigo_interno}
          onChange={(e) => update("codigo_interno", e.target.value)}
          error={errors.codigo_interno}
          disabled={loading}
          autoComplete="off"
          required
        />
        <Input
          label="Nombre"
          name="nombre"
          value={values.nombre}
          onChange={(e) => update("nombre", e.target.value)}
          error={errors.nombre}
          disabled={loading}
          required
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-primary">
            Descripción
          </span>
          <textarea
            name="descripcion"
            value={values.descripcion}
            onChange={(e) => update("descripcion", e.target.value)}
            disabled={loading}
            rows={3}
            className="w-full rounded-lg border border-border bg-card text-sm text-text-primary px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:opacity-50 resize-y min-h-[5rem]"
            placeholder="Opcional"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-primary">Tipo</span>
          <select
            name="tipo"
            value={values.tipo}
            onChange={(e) =>
              update("tipo", e.target.value as IngredienteFormValues["tipo"])
            }
            disabled={loading}
            className="w-full rounded-lg border border-border bg-card text-sm text-text-primary px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:opacity-50"
            aria-invalid={Boolean(errors.tipo)}
            aria-describedby={errors.tipo ? "tipo-error" : undefined}
            required
          >
            <option value="">Selecciona un tipo</option>
            {INGREDIENTE_TIPO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.tipo && (
            <p id="tipo-error" className="text-xs text-error">
              {errors.tipo}
            </p>
          )}
        </label>
      </ProductFormSection>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
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
      </div>
    </form>
  );
}
