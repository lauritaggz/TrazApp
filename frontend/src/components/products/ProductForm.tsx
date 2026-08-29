import { useEffect, useRef, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import CategoryMultiSelect from "@/components/products/CategoryMultiSelect";
import ProductFormSection from "@/components/products/ProductFormSection";
import ProductImageField from "@/components/products/ProductImageField";
import { Input } from "@/components/ui/Input";
import {
  PRODUCT_FORM_FIELD_ORDER,
  type ProductFormFieldErrors,
} from "@/lib/productFormValidation";
import {
  PRODUCT_FORM_UNIT_OPTIONS,
  type Categoria,
  type ProductFormMode,
  type ProductFormValues,
} from "@/types/product";

interface ProductFormProps {
  values: ProductFormValues;
  errors: ProductFormFieldErrors;
  categories?: Categoria[];
  categoriesLoading?: boolean;
  currentImageUrl?: string | null;
  imageFile?: File | null;
  imageError?: string;
  onImageChange?: (file: File | null) => void;
  mode?: ProductFormMode;
  loading?: boolean;
  /** Increment after each failed submit to move focus to the first error. */
  errorFocusToken?: number;
  submitLabel?: string;
  loadingLabel?: string;
  onChange: (values: ProductFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function ProductForm({
  values,
  errors,
  categories = [],
  categoriesLoading = false,
  currentImageUrl = null,
  imageFile = null,
  imageError,
  onImageChange,
  mode = "create",
  loading = false,
  errorFocusToken = 0,
  submitLabel = mode === "edit" ? "Guardar cambios" : "Guardar producto",
  loadingLabel = "Guardando…",
  onChange,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!errorFocusToken || !formRef.current) return;
    const firstErrorField = PRODUCT_FORM_FIELD_ORDER.find((field) => errors[field]);
    if (!firstErrorField) return;

    const element = formRef.current.querySelector<HTMLElement>(
      `[name="${firstErrorField}"]`,
    );
    element?.focus();
  }, [errorFocusToken, errors]);

  function update<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
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
        id="product-form-general"
        title="Información general"
        description="Datos básicos de identificación y contenido del producto."
      >
        <Input
          id="codigo_interno"
          name="codigo_interno"
          label="Código interno *"
          type="text"
          placeholder="GAL-001"
          value={values.codigo_interno}
          onChange={(e) => update("codigo_interno", e.target.value)}
          error={errors.codigo_interno}
          hint={
            errors.codigo_interno
              ? undefined
              : "Utiliza el código con el que identificas este producto en tu negocio."
          }
          disabled={loading}
          maxLength={100}
          autoComplete="off"
          aria-required="true"
        />

        <Input
          id="nombre"
          name="nombre"
          label="Nombre *"
          type="text"
          placeholder="Galleta de chocolate"
          value={values.nombre}
          onChange={(e) => update("nombre", e.target.value)}
          error={errors.nombre}
          disabled={loading}
          maxLength={255}
          autoComplete="off"
          aria-required="true"
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="descripcion"
            className="text-sm font-medium text-text-primary"
          >
            Descripción *
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={4}
            placeholder="Describe el producto"
            value={values.descripcion}
            onChange={(e) => update("descripcion", e.target.value)}
            disabled={loading}
            aria-required="true"
            aria-invalid={Boolean(errors.descripcion)}
            aria-describedby={
              errors.descripcion ? "descripcion-error" : undefined
            }
            className={`
              w-full rounded-lg border bg-card text-sm text-text-primary placeholder:text-text-muted
              px-3 py-2.5 transition-all duration-150 resize-y min-h-[6rem]
              focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent
              disabled:opacity-50 disabled:bg-surface disabled:cursor-not-allowed
              ${
                errors.descripcion
                  ? "border-error focus:ring-error bg-error-bg"
                  : "border-border hover:border-[#b0b7b0]"
              }
            `}
          />
          {errors.descripcion && (
            <p
              id="descripcion-error"
              className="text-xs text-error flex items-center gap-1"
            >
              {errors.descripcion}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="contenido_neto"
            name="contenido_neto"
            label="Contenido neto *"
            type="text"
            inputMode="decimal"
            placeholder="250"
            value={values.contenido_neto}
            onChange={(e) => update("contenido_neto", e.target.value)}
            error={errors.contenido_neto}
            disabled={loading}
            autoComplete="off"
            aria-required="true"
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">
              Unidad de medida *
            </span>
            <select
              id="unidad_medida"
              name="unidad_medida"
              value={values.unidad_medida}
              onChange={(e) =>
                update(
                  "unidad_medida",
                  e.target.value as ProductFormValues["unidad_medida"],
                )
              }
              disabled={loading}
              aria-required="true"
              aria-invalid={Boolean(errors.unidad_medida)}
              aria-describedby={
                errors.unidad_medida ? "unidad_medida-error" : undefined
              }
              className={`
                w-full rounded-lg border bg-card text-sm text-text-primary px-3 py-2.5
                focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent
                disabled:opacity-50 disabled:bg-surface disabled:cursor-not-allowed
                ${
                  errors.unidad_medida
                    ? "border-error focus:ring-error bg-error-bg"
                    : "border-border hover:border-[#b0b7b0]"
                }
              `}
            >
              <option value="">Selecciona una unidad</option>
              {PRODUCT_FORM_UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.unidad_medida && (
              <p
                id="unidad_medida-error"
                className="text-xs text-error flex items-center gap-1"
              >
                {errors.unidad_medida}
              </p>
            )}
          </label>
        </div>

        <Input
          id="presentacion"
          name="presentacion"
          label="Presentación"
          type="text"
          placeholder="Ej.: Bolsa de 10 unidades"
          value={values.presentacion}
          onChange={(e) => update("presentacion", e.target.value)}
          error={errors.presentacion}
          hint="Opcional. Cómo se comercializa o empaqueta el producto."
          disabled={loading}
          maxLength={255}
          autoComplete="off"
        />
      </ProductFormSection>

      <ProductFormSection
        id="product-form-classification"
        title="Clasificación"
        description="Organiza el producto dentro de tu catálogo."
      >
        <CategoryMultiSelect
          categories={categories}
          selectedIds={values.categoria_ids}
          disabled={loading}
          loading={categoriesLoading}
          error={errors.categoria_ids}
          onChange={(categoria_ids) => update("categoria_ids", categoria_ids)}
        />
      </ProductFormSection>

      <ProductFormSection
        id="product-form-commercial"
        title="Información comercial"
        description="Valores de referencia opcionales para tu gestión interna."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="costo_produccion"
            name="costo_produccion"
            label="Costo de producción"
            type="text"
            inputMode="decimal"
            placeholder="Ej.: 12.50"
            value={values.costo_produccion}
            onChange={(e) => update("costo_produccion", e.target.value)}
            error={errors.costo_produccion}
            hint={
              errors.costo_produccion
                ? undefined
                : "Opcional. Valor estimado de producción."
            }
            disabled={loading}
            autoComplete="off"
          />

          <Input
            id="precio_venta"
            name="precio_venta"
            label="Precio de venta"
            type="text"
            inputMode="decimal"
            placeholder="Ej.: 25.00"
            value={values.precio_venta}
            onChange={(e) => update("precio_venta", e.target.value)}
            error={errors.precio_venta}
            hint={
              errors.precio_venta
                ? undefined
                : "Opcional. Precio comercial de referencia."
            }
            disabled={loading}
            autoComplete="off"
          />
        </div>
      </ProductFormSection>

      {onImageChange && (
        <ProductFormSection
          id="product-form-image"
          title="Imagen principal"
          description="Opcional. Se mostrará en el detalle y en el listado cuando esté disponible."
        >
          <ProductImageField
            currentImageUrl={imageFile ? null : currentImageUrl}
            disabled={loading}
            error={imageError}
            onChange={onImageChange}
            hideLegend
          />
        </ProductFormSection>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t border-border">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={loading}
          className="w-full sm:w-auto"
        >
          {loading ? loadingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
