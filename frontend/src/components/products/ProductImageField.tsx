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

      <div className="flex flex-col gap-3">
        <div
          className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface"
          aria-hidden={!displayUrl}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Vista previa del producto"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-3 text-center text-[13px] text-text-secondary">
              <svg
                aria-hidden="true"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
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
            className="peer sr-only"
          />
          <label
            htmlFor="imagen_producto"
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-strong bg-card px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
          >
            {displayUrl ? "Cambiar imagen" : "Elegir imagen"}
          </label>
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
