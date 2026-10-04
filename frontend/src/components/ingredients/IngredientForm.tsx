import { useEffect, useRef, type FormEvent } from "react";
import ProductFormSection from "@/components/products/ProductFormSection";
import Button from "@/components/ui/Button";
import FormActions from "@/components/ui/FormActions";
import Textarea from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { suggestInternalCode } from "@/lib/internalCode";
import { type IngredienteFormFieldErrors } from "@/lib/ingredientFormValidation";
import type {
  IngredienteFormMode,
  IngredienteFormValues,
} from "@/types/ingredient";

/** Orden visual del formulario: el foco tras un error sigue lo que el usuario ve. */
const VISUAL_FIELD_ORDER: (keyof IngredienteFormValues)[] = [
  "nombre",
  "codigo_interno",
  "descripcion",
];

const NEXT_STEPS = [
  {
    title: "Alérgenos",
    text: "Declara cuáles contiene. Los de rotulación obligatoria se destacan.",
  },
  {
    title: "Composición",
    text: "Si es un ingrediente compuesto, indica qué lo forma y en qué porcentaje.",
  },
];

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
    const firstErrorField = VISUAL_FIELD_ORDER.find(
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

  const codeSuggestion = values.codigo_interno.trim()
    ? null
    : suggestInternalCode(values.nombre);
  const showNextSteps = mode === "create";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-6"
      noValidate
    >
      <div
        className={
          showNextSteps
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
            : "max-w-2xl"
        }
      >
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <ProductFormSection
            id="ingredient-form-general"
            title="Información general"
            description="Lo básico para reconocer el ingrediente en tus productos."
          >
            <Input
              label="Nombre"
              name="nombre"
              value={values.nombre}
              onChange={(e) => update("nombre", e.target.value)}
              error={errors.nombre}
              disabled={loading}
              required
            />
            <div className="space-y-1.5">
              <Input
                label="Código interno"
                name="codigo_interno"
                value={values.codigo_interno}
                onChange={(e) => update("codigo_interno", e.target.value)}
                error={errors.codigo_interno}
                hint={
                  errors.codigo_interno
                    ? undefined
                    : "El código con el que identificas este ingrediente en tu negocio."
                }
                disabled={loading}
                autoComplete="off"
                required
              />
              {codeSuggestion && !loading && (
                <button
                  type="button"
                  onClick={() => update("codigo_interno", codeSuggestion)}
                  className="rounded text-[13px] font-medium text-accent-strong underline-offset-2 hover:underline"
                >
                  Usar sugerencia: {codeSuggestion}
                </button>
              )}
            </div>
            <Textarea
              label="Descripción"
              name="descripcion"
              value={values.descripcion}
              onChange={(e) => update("descripcion", e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="Opcional"
            />
          </ProductFormSection>
        </div>

        {showNextSteps && (
          <aside
            aria-labelledby="ingredient-next-steps"
            className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-soft lg:sticky lg:top-6"
          >
            <div className="space-y-1">
              <h2
                id="ingredient-next-steps"
                className="text-sm font-semibold text-text-primary"
              >
                Después de guardar
              </h2>
              <p className="text-[13px] leading-relaxed text-text-secondary">
                Al guardar podrás completar estos datos desde el detalle del
                ingrediente.
              </p>
            </div>
            <ol className="space-y-4">
              {NEXT_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-strong text-xs font-semibold tabular-nums text-text-secondary"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {step.title}
                    </p>
                    <p className="text-[13px] leading-relaxed text-text-secondary">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>

      <FormActions>
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
      </FormActions>
    </form>
  );
}
