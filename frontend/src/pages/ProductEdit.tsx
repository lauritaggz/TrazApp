import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import ImageUploadRecovery from "@/components/products/ImageUploadRecovery";
import ProductForm from "@/components/products/ProductForm";
import ProductUnavailable from "@/components/products/ProductUnavailable";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAppShell } from "@/hooks/useAppShell";
import {
  buildUpdatePayload,
  isProductFormDirtyComparedTo,
  productToFormValues,
  validateProductForm,
  type ProductFormFieldErrors,
} from "@/lib/productFormValidation";
import { getProduct, listCategories, updateProduct, uploadProductImage } from "@/services/productService";
import { ApiError } from "@/types/auth";
import {
  EMPTY_PRODUCT_FORM_VALUES,
  type Categoria,
  type ProductFormValues,
  type ProductUpdatePayload,
} from "@/types/product";

const DUPLICATE_CODE_MESSAGE =
  "Ya existe un producto con este código interno.";
const SAVE_ERROR_MESSAGE =
  "No pudimos guardar los cambios. Inténtalo nuevamente.";
const IMAGE_UPLOAD_ERROR_MESSAGE =
  "Los cambios se guardaron, pero no pudimos subir la imagen.";
const CATEGORIES_LOAD_ERROR_MESSAGE =
  "No pudimos cargar las categorías disponibles.";

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
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesLoadError, setCategoriesLoadError] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
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

  const loadProduct = useCallback(async (id: number) => {
    setLoadingProduct(true);
    setUnavailable(false);
    try {
      const product = await getProduct(id);
      const formValues = productToFormValues(product);
      setBaseline(formValues);
      setValues(formValues);
      setProductName(product.nombre);
      setCurrentImageUrl(product.imagen_url);
      setImageFile(null);
      setRemoveExistingImage(false);
      setImageError("");
      setPendingImageUpload(null);
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

  function handleImageChange(file: File | null) {
    setImageFile(file);
    if (imageError) setImageError("");
    if (pendingImageUpload) setPendingImageUpload(null);
    if (file) setRemoveExistingImage(false);
  }

  function handleRemoveExistingImage() {
    setRemoveExistingImage(true);
    setImageFile(null);
    if (imageError) setImageError("");
    if (pendingImageUpload) setPendingImageUpload(null);
  }

  function handleUndoRemoveExistingImage() {
    setRemoveExistingImage(false);
  }

  function hasUnsavedChanges() {
    return (
      isProductFormDirtyComparedTo(values, baseline) ||
      imageFile !== null ||
      removeExistingImage
    );
  }

  function goToDetail(options?: { productUpdated?: boolean }) {
    if (productId == null) {
      navigate("/productos");
      return;
    }
    navigate(`/productos/${productId}`, {
      state: options?.productUpdated ? { productUpdated: true } : undefined,
    });
  }

  function handleCancel() {
    if (saving || retryingImageUpload) return;
    if (hasUnsavedChanges()) {
      setShowCancelConfirm(true);
      return;
    }
    goToDetail();
  }

  function buildPayloadWithImageRemoval(payload: ProductUpdatePayload) {
    if (!removeExistingImage || imageFile) return payload;
    return { ...payload, imagen_url: null };
  }

  async function uploadImageForProduct(id: number, file: File) {
    try {
      await uploadProductImage(id, file);
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        setImageError(err.message);
      }
      setGlobalError(IMAGE_UPLOAD_ERROR_MESSAGE);
      setPendingImageUpload({ productId: id, file });
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
      goToDetail({ productUpdated: true });
    }
  }

  function handleContinueWithoutImage() {
    if (!pendingImageUpload) return;
    goToDetail({ productUpdated: true });
  }

  async function handleSubmit() {
    if (productId == null || pendingImageUpload) return;

    setGlobalError("");
    const validationErrors = validateProductForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    const payload = buildPayloadWithImageRemoval(
      buildUpdatePayload(baseline, values),
    );
    const hasPayloadChanges = Object.keys(payload).length > 0;
    const hasImageChange = imageFile !== null;
    if (!hasPayloadChanges && !hasImageChange) {
      goToDetail({ productUpdated: true });
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      if (hasPayloadChanges) {
        await updateProduct(productId, payload);
        if (payload.imagen_url === null) {
          setCurrentImageUrl(null);
          setRemoveExistingImage(false);
        }
      }
      if (hasImageChange && imageFile) {
        const uploaded = await uploadImageForProduct(productId, imageFile);
        if (!uploaded) return;
      }
      goToDetail({ productUpdated: true });
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

            {pendingImageUpload ? (
              <ImageUploadRecovery
                message={globalError || IMAGE_UPLOAD_ERROR_MESSAGE}
                retrying={retryingImageUpload}
                onRetry={() => void handleRetryImageUpload()}
                onContinue={handleContinueWithoutImage}
              />
            ) : (
              globalError && <Alert type="error">{globalError}</Alert>
            )}

            <ProductForm
              mode="edit"
              values={values}
              errors={errors}
              categories={categories}
              categoriesLoading={categoriesLoading}
              categoriesLoadError={categoriesLoadError}
              onCategoriesRetry={() => void loadCategories()}
              currentImageUrl={currentImageUrl}
              removeExistingImage={removeExistingImage}
              imageFile={imageFile}
              imageError={imageError}
              onImageChange={handleImageChange}
              onRemoveExistingImage={handleRemoveExistingImage}
              onUndoRemoveExistingImage={handleUndoRemoveExistingImage}
              loading={saving || retryingImageUpload || Boolean(pendingImageUpload)}
              errorFocusToken={errorFocusToken}
              onChange={handleChange}
              onSubmit={() => void handleSubmit()}
              onCancel={handleCancel}
            />
          </>
        )}
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
          goToDetail();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </AppShell>
  );
}
