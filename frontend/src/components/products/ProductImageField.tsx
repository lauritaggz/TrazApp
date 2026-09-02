import { useEffect, useRef, useState } from "react";
import { resolveProductImageUrl } from "@/lib/productImageUpload";
import { validateProductImage } from "@/lib/productImageUtils";

interface ProductImageFieldProps {
  currentImageUrl?: string | null;
  removeExistingImage?: boolean;
  disabled?: boolean;
  error?: string;
  hideLegend?: boolean;
  onChange: (file: File | null) => void;
  onRemoveExistingImage?: () => void;
  onUndoRemoveExistingImage?: () => void;
}

export default function ProductImageField({
  currentImageUrl = null,
  removeExistingImage = false,
  disabled = false,
  error,
  hideLegend = false,
  onChange,
  onRemoveExistingImage,
  onUndoRemoveExistingImage,
}: ProductImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");

  const existingUrl =
    removeExistingImage ? null : resolveProductImageUrl(currentImageUrl);
  const displayUrl = previewUrl ?? existingUrl;
  const canRemoveExisting =
    Boolean(onRemoveExistingImage) &&
    Boolean(resolveProductImageUrl(currentImageUrl)) &&
    !previewUrl &&
    !removeExistingImage;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(file: File | null) {
    setLocalError("");
    if (!file) {
      onChange(null);
      setPreviewUrl(null);
      return;
    }

    const validationError = validateProductImage(file);
    if (validationError) {
      setLocalError(validationError);
      onChange(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    onChange(file);
  }

  const message = error ?? localError;

  return (
    <fieldset className="space-y-2">
      {!hideLegend && (
        <>
          <legend className="text-sm font-medium text-text-primary">
            Imagen principal
          </legend>
          <p className="text-xs text-text-secondary">
            Opcional. JPG, JPEG, PNG o WEBP. Máximo 5 MB.
          </p>
        </>
      )}
      {hideLegend && (
        <p className="text-xs text-text-secondary">
          JPG, JPEG, PNG o WEBP. Máximo 5 MB.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div
          className="w-full sm:w-40 h-40 rounded-xl border border-border bg-surface overflow-hidden flex items-center justify-center shrink-0"
          aria-hidden={!displayUrl}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Vista previa del producto"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-center px-3 text-xs text-text-secondary">
              Sin imagen
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 w-full">
          <input
            ref={inputRef}
            id="imagen_producto"
            name="imagen_producto"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            disabled={disabled}
            aria-label="Seleccionar imagen del producto"
            onChange={(event) =>
              handleFileChange(event.target.files?.[0] ?? null)
            }
            className="block w-full text-sm text-text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 disabled:opacity-50"
          />
          {previewUrl && (
            <button
              type="button"
              className="text-sm text-text-secondary hover:text-text-primary underline-offset-2 hover:underline disabled:opacity-50"
              disabled={disabled}
              onClick={() => {
                if (inputRef.current) inputRef.current.value = "";
                handleFileChange(null);
              }}
            >
              Quitar selección
            </button>
          )}
          {canRemoveExisting && (
            <button
              type="button"
              className="text-sm text-text-secondary hover:text-text-primary underline-offset-2 hover:underline disabled:opacity-50"
              disabled={disabled}
              onClick={onRemoveExistingImage}
            >
              Quitar imagen
            </button>
          )}
          {removeExistingImage && onUndoRemoveExistingImage && (
            <button
              type="button"
              className="text-sm text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline disabled:opacity-50"
              disabled={disabled}
              onClick={onUndoRemoveExistingImage}
            >
              Deshacer
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className="text-xs text-error" role="alert">
          {message}
        </p>
      )}
    </fieldset>
  );
}
