import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import ProductForm from "@/components/products/ProductForm";
import ProductUnavailable from "@/components/products/ProductUnavailable";
import Alert from "@/components/ui/Alert";
import { useAppShell } from "@/hooks/useAppShell";
import {
  buildUpdatePayload,
  isProductFormDirtyComparedTo,
  productToFormValues,
  validateProductForm,
  type ProductFormFieldErrors,
} from "@/lib/productFormValidation";
import { getProduct, updateProduct } from "@/services/productService";
import { ApiError } from "@/types/auth";
import {
  EMPTY_PRODUCT_FORM_VALUES,
  type ProductFormValues,
} from "@/types/product";

const DUPLICATE_CODE_MESSAGE =
  "Ya existe un producto con este código interno.";
const SAVE_ERROR_MESSAGE =
  "No pudimos guardar los cambios. Inténtalo nuevamente.";

function parseProductId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export default function ProductEdit() {
  const navigate = useNavigate();
  const { id: rawId } = useParams();
  const productId = parseProductId(rawId);
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();

  const [baseline, setBaseline] = useState<ProductFormValues>(
    EMPTY_PRODUCT_FORM_VALUES,
  );
  const [values, setValues] = useState<ProductFormValues>(
    EMPTY_PRODUCT_FORM_VALUES,
  );
  const [productName, setProductName] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ProductFormFieldErrors>({});
  const [errorFocusToken, setErrorFocusToken] = useState(0);
  const [globalError, setGlobalError] = useState("");

  const loadProduct = useCallback(async (id: number) => {
    setLoadingProduct(true);
    setUnavailable(false);
    try {
      const product = await getProduct(id);
      const formValues = productToFormValues(product);
      setBaseline(formValues);
      setValues(formValues);
      setProductName(product.nombre);
    } catch {
      setUnavailable(true);
    } finally {
      setLoadingProduct(false);
    }
  }, []);

  useEffect(() => {
    if (productId == null) {
      setUnavailable(true);
      setLoadingProduct(false);
      return;
    }
    void loadProduct(productId);
  }, [loadProduct, productId]);

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

  function goToDetail() {
    if (productId == null) {
      navigate("/productos");
      return;
    }
    navigate(`/productos/${productId}`);
  }

  function handleCancel() {
    if (saving) return;
    if (isProductFormDirtyComparedTo(values, baseline)) {
      const confirmed = window.confirm(
        "Tienes cambios sin guardar. ¿Deseas salir sin guardar?",
      );
      if (!confirmed) return;
    }
    goToDetail();
  }

  async function handleSubmit() {
    if (productId == null) return;

    setGlobalError("");
    const validationErrors = validateProductForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    const payload = buildUpdatePayload(baseline, values);
    if (Object.keys(payload).length === 0) {
      navigate(`/productos/${productId}`, {
        state: { productUpdated: true },
      });
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      await updateProduct(productId, payload);
      navigate(`/productos/${productId}`, {
        state: { productUpdated: true },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setUnavailable(true);
          return;
        }
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
      setSaving(false);
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
        {loadingProduct && (
          <div className="space-y-4" aria-live="polite" aria-busy="true">
            <p className="text-sm text-text-secondary">Cargando producto...</p>
            <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
          </div>
        )}

        {!loadingProduct && unavailable && (
          <ProductUnavailable onBack={() => navigate("/productos")} />
        )}

        {!loadingProduct && !unavailable && (
          <>
            <header>
              <p className="text-sm text-brand-600 font-medium mb-1">
                Productos / {productName || "Editar"} / Editar
              </p>
              <h1 className="text-2xl font-semibold text-text-primary mb-1.5">
                Editar producto
              </h1>
              <p className="text-sm text-text-secondary leading-relaxed">
                Actualiza la información general del producto.
              </p>
            </header>

            {globalError && <Alert type="error">{globalError}</Alert>}

            <ProductForm
              mode="edit"
              values={values}
              errors={errors}
              loading={saving}
              errorFocusToken={errorFocusToken}
              onChange={handleChange}
              onSubmit={() => void handleSubmit()}
              onCancel={handleCancel}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
