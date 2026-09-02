import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import IngredientAllergensSection from "@/components/ingredients/IngredientAllergensSection";
import IngredientCompositionSection from "@/components/ingredients/IngredientCompositionSection";
import IngredientUnavailable from "@/components/ingredients/IngredientUnavailable";
import ProductDetailSection from "@/components/products/ProductDetailSection";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAppShell } from "@/hooks/useAppShell";
import { formatIngredienteTipo } from "@/lib/ingredientListUtils";
import { deleteIngredient, getIngredient } from "@/services/ingredientService";
import { ApiError } from "@/types/auth";
import type { Ingrediente } from "@/types/ingredient";

function parseIngredientId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export default function IngredientDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: rawId } = useParams();
  const ingredientId = parseIngredientId(rawId);
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();

  const [ingredient, setIngredient] = useState<Ingrediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadIngredient = useCallback(async (id: number) => {
    setLoading(true);
    setUnavailable(false);
    try {
      const data = await getIngredient(id);
      setIngredient(data);
    } catch {
      setIngredient(null);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ingredientId == null) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    void loadIngredient(ingredientId);
  }, [ingredientId, loadIngredient]);

  useEffect(() => {
    const state = location.state as { ingredientUpdated?: boolean } | null;
    if (!state?.ingredientUpdated) return;
    setSuccessMessage("Ingrediente actualizado correctamente.");
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  async function handleDeleteConfirm() {
    if (!ingredient) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteIngredient(ingredient.id);
      navigate("/ingredientes", { state: { ingredientDeleted: true } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setUnavailable(true);
        return;
      }
      setDeleteError("No pudimos desactivar el ingrediente. Inténtalo nuevamente.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <AppShell
      activePage="ingredientes"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-2xl space-y-6">
        {loading && (
          <p className="text-sm text-text-secondary">Cargando ingrediente...</p>
        )}

        {!loading && unavailable && (
          <IngredientUnavailable onBack={() => navigate("/ingredientes")} />
        )}

        {!loading && ingredient && ingredientId != null && (
          <>
            <header className="space-y-2">
              <p className="text-sm text-brand-600 font-medium">
                Ingredientes / {ingredient.nombre}
              </p>
              <h1 className="text-2xl font-semibold text-text-primary">
                {ingredient.nombre}
              </h1>
              <p className="text-sm font-medium text-text-secondary tracking-wide">
                {ingredient.codigo_interno ?? "—"}
              </p>
            </header>

            {successMessage && <Alert type="success">{successMessage}</Alert>}
            {deleteError && <Alert type="error">{deleteError}</Alert>}

            <ProductDetailSection id="ingredient-detail-general" title="Información general">
              <dl className="grid grid-cols-1 gap-4">
                <DetailField label="Código interno">
                  {ingredient.codigo_interno ?? "—"}
                </DetailField>
                <DetailField label="Descripción">
                  {ingredient.descripcion?.trim() || "—"}
                </DetailField>
                <DetailField label="Tipo">
                  {formatIngredienteTipo(ingredient.tipo)}
                </DetailField>
                <DetailField label="Estado">
                  {ingredient.activo ? "Activo" : "Inactivo"}
                </DetailField>
              </dl>
            </ProductDetailSection>

            {ingredient.tipo === "compuesto" && (
              <ProductDetailSection
                id="ingredient-detail-composition"
                title="Composición declarada"
              >
                <IngredientCompositionSection
                  ingredienteId={ingredientId}
                  ingredienteTipo={ingredient.tipo}
                />
              </ProductDetailSection>
            )}

            <ProductDetailSection id="ingredient-detail-allergens" title="Alérgenos">
              <IngredientAllergensSection ingredienteId={ingredientId} />
            </ProductDetailSection>

            <section className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Acciones
              </h2>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/ingredientes")}
                >
                  Volver a ingredientes
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate(`/ingredientes/${ingredient.id}/editar`)}
                >
                  Editar ingrediente
                </Button>
              </div>
              <div className="border-t border-border pt-4 space-y-3">
                <div>
                  <h3 className="text-sm font-medium">Desactivar ingrediente</h3>
                  <p className="text-sm text-text-secondary mt-1">
                    Al desactivar, el ingrediente dejará de aparecer en tu catálogo.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-error border-error/30 hover:bg-error-bg"
                  onClick={() => setShowDeleteConfirm(true)}
                  loading={deleting}
                >
                  Desactivar ingrediente
                </Button>
              </div>
            </section>
          </>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Desactivar ingrediente"
        description="¿Desactivar este ingrediente? Dejará de aparecer en tu catálogo."
        confirmLabel="Desactivar ingrediente"
        cancelLabel="Cancelar"
        destructive
        loading={deleting}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          if (!deleting) setShowDeleteConfirm(false);
        }}
      />
    </AppShell>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-text-secondary uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm text-text-primary whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
