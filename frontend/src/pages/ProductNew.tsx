import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import ImageUploadRecovery from "@/components/products/ImageUploadRecovery";
import ProductForm from "@/components/products/ProductForm";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAppShell } from "@/hooks/useAppShell";
import {
  isProductFormDirty,
  toCreatePayload,
  validateProductForm,
  type ProductFormFieldErrors,
} from "@/lib/productFormValidation";
import { createProduct, listCategories, uploadProductImage } from "@/services/productService";
import { ApiError } from "@/types/auth";
import {
  EMPTY_PRODUCT_FORM_VALUES,
  type Categoria,
  type ProductFormValues,
} from "@/types/product";

const DUPLICATE_CODE_MESSAGE =
  "Ya existe un producto con este código interno.";
const SAVE_ERROR_MESSAGE =
  "No pudimos guardar el producto. Inténtalo nuevamente.";
const IMAGE_UPLOAD_ERROR_MESSAGE =
  "El producto se creó, pero no pudimos subir la imagen.";
const CATEGORIES_LOAD_ERROR_MESSAGE =
  "No pudimos cargar las categorías disponibles.";

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
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesLoadError, setCategoriesLoadError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [pendingImageUpload, setPendingImageUpload] = useState<{
    productId: number;
    file: File;
  } | null>(null);
  const [retryingImageUpload, setRetryingImageUpload] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesLoadError("");
    try {
      const data = await listCategories();
      setCategories(data);
    } catch {
      setCategoriesLoadError(CATEGORIES_LOAD_ERROR_MESSAGE);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

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

  function handleImageChange(file: File | null) {
    setImageFile(file);
    if (imageError) setImageError("");
    if (pendingImageUpload) setPendingImageUpload(null);
  }

  function goToProducts(options?: { created?: boolean }) {
    navigate("/productos", {
      state: options?.created
        ? { productCreated: true }
        : undefined,
    });
  }

  function goToCreatedProduct(productId: number, options?: { created?: boolean }) {
    navigate(`/productos/${productId}`, {
      state: options?.created ? { productUpdated: true } : undefined,
    });
  }

  function handleCancel() {
    if (loading || retryingImageUpload) return;
    if (isProductFormDirty(values) || imageFile) {
      setShowCancelConfirm(true);
      return;
    }
    goToProducts();
  }

  async function uploadImageForProduct(productId: number, file: File) {
    try {
      await uploadProductImage(productId, file);
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        setImageError(err.message);
      }
      setGlobalError(IMAGE_UPLOAD_ERROR_MESSAGE);
      setPendingImageUpload({ productId, file });
      return false;
    }
  }

  async function handleRetryImageUpload() {
    if (!pendingImageUpload) return;
    setRetryingImageUpload(true);
    setGlobalError("");
    setImageError("");
    const uploaded = await uploadImageForProduct(
      pendingImageUpload.productId,
      pendingImageUpload.file,
    );
    setRetryingImageUpload(false);
    if (uploaded) {
      goToProducts({ created: true });
    }
  }

  function handleContinueWithoutImage() {
    if (!pendingImageUpload) return;
    goToCreatedProduct(pendingImageUpload.productId, { created: true });
  }

  async function handleSubmit() {
    if (pendingImageUpload) return;
    setGlobalError("");
    const validationErrors = validateProductForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const created = await createProduct(toCreatePayload(values));
      if (imageFile) {
        const uploaded = await uploadImageForProduct(created.id, imageFile);
        if (!uploaded) return;
      }
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

        {pendingImageUpload ? (
          <ImageUploadRecovery
            message={globalError || IMAGE_UPLOAD_ERROR_MESSAGE}
            retrying={retryingImageUpload}
            onRetry={() => void handleRetryImageUpload()}
            onContinue={handleContinueWithoutImage}
            continueLabel="Continuar al producto"
          />
        ) : (
          globalError && <Alert type="error">{globalError}</Alert>
        )}

        <ProductForm
          mode="create"
          values={values}
          errors={errors}
          categories={categories}
          categoriesLoading={categoriesLoading}
          categoriesLoadError={categoriesLoadError}
          onCategoriesRetry={() => void loadCategories()}
          currentImageUrl={null}
          imageFile={imageFile}
          imageError={imageError}
          onImageChange={handleImageChange}
          loading={loading || retryingImageUpload || Boolean(pendingImageUpload)}
          errorFocusToken={errorFocusToken}
          onChange={handleChange}
          onSubmit={() => void handleSubmit()}
          onCancel={handleCancel}
        />
      </div>

      <ConfirmDialog
        open={showCancelConfirm}
        title="Salir sin guardar"
        description="Tienes cambios sin guardar. ¿Deseas salir sin guardar?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => {
          setShowCancelConfirm(false);
          goToProducts();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </AppShell>
  );
}
