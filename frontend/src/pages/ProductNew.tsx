import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import ProductForm from "@/components/products/ProductForm";
import Alert from "@/components/ui/Alert";
import { useAppShell } from "@/hooks/useAppShell";
import {
  isProductFormDirty,
  toCreatePayload,
  validateProductForm,
  type ProductFormFieldErrors,
} from "@/lib/productFormValidation";
import { createProduct } from "@/services/productService";
import { ApiError } from "@/types/auth";
import {
  EMPTY_PRODUCT_FORM_VALUES,
  type ProductFormValues,
} from "@/types/product";

const DUPLICATE_CODE_MESSAGE =
  "Ya existe un producto con este código interno.";
const SAVE_ERROR_MESSAGE =
  "No pudimos guardar el producto. Inténtalo nuevamente.";

export default function ProductNew() {
  const navigate = useNavigate();
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();

  const [values, setValues] = useState<ProductFormValues>(
    EMPTY_PRODUCT_FORM_VALUES,
  );
  const [errors, setErrors] = useState<ProductFormFieldErrors>({});
  const [errorFocusToken, setErrorFocusToken] = useState(0);
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);

  function setFieldErrors(next: ProductFormFieldErrors) {
    setErrors(next);
    setErrorFocusToken((token) => token + 1);
  }

  function handleChange(next: ProductFormValues) {
    setValues(next);
    setErrors((current) => {
      if (Object.keys(current).length === 0) return current;
      const cleared = { ...current };
      for (const key of Object.keys(next) as (keyof ProductFormValues)[]) {
        if (next[key] !== values[key]) {
          delete cleared[key];
        }
      }
      return cleared;
    });
    if (globalError) setGlobalError("");
  }

  function goToProducts(options?: { created?: boolean }) {
    navigate("/productos", {
      state: options?.created
        ? { productCreated: true }
        : undefined,
    });
  }

  function handleCancel() {
    if (loading) return;
    if (isProductFormDirty(values)) {
      const confirmed = window.confirm(
        "Tienes cambios sin guardar. ¿Deseas salir sin guardar?",
      );
      if (!confirmed) return;
    }
    goToProducts();
  }

  async function handleSubmit() {
    setGlobalError("");
    const validationErrors = validateProductForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await createProduct(toCreatePayload(values));
      goToProducts({ created: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setFieldErrors({ codigo_interno: DUPLICATE_CODE_MESSAGE });
          return;
        }
        if (err.status === 422 && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors);
          setGlobalError(err.message);
          return;
        }
        setGlobalError(SAVE_ERROR_MESSAGE);
        return;
      }
      setGlobalError(SAVE_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      activePage="productos"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-xl mx-auto space-y-6">
        <header>
          <p className="text-sm text-brand-600 font-medium mb-1">
            Productos / Nuevo producto
          </p>
          <h1 className="text-2xl font-semibold text-text-primary mb-1.5">
            Nuevo producto
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Registra la información general del producto.
          </p>
        </header>

        {globalError && <Alert type="error">{globalError}</Alert>}

        <ProductForm
          mode="create"
          values={values}
          errors={errors}
          loading={loading}
          errorFocusToken={errorFocusToken}
          onChange={handleChange}
          onSubmit={() => void handleSubmit()}
          onCancel={handleCancel}
        />
      </div>
    </AppShell>
  );
}
