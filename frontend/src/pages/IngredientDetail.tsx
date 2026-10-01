import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/toastContext";
import IngredientAllergensSection from "@/components/ingredients/IngredientAllergensSection";
import IngredientUnavailable from "@/components/ingredients/IngredientUnavailable";
import ProductDetailSection from "@/components/products/ProductDetailSection";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAppShell } from "@/hooks/useAppShell";
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
  const { handleLogout, producerName, businessName } =
    useAppShell();

  const [ingredient, setIngredient] = useState<Ingrediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const { notify } = useToast();
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
    notify("Ingrediente actualizado correctamente.");
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, notify]);

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
      pageTitle={ingredient?.nombre ?? "Detalle del ingrediente"}
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
            <PageHeader
              title={ingredient.nombre}
              description={ingredient.codigo_interno ?? "—"}
              breadcrumbs={[
                { label: "Ingredientes", to: "/ingredientes" },
                { label: ingredient.nombre },
              ]}
              actions={
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => navigate("/ingredientes")}
                  >
                    Volver a ingredientes
                  </Button>
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => navigate(`/ingredientes/${ingredient.id}/editar`)}
                  >
                    Editar ingrediente
                  </Button>
                </>
              }
            />
            {deleteError && <Alert type="error">{deleteError}</Alert>}

            <ProductDetailSection id="ingredient-detail-general" title="Información general">
              <dl className="grid grid-cols-1 gap-4">
                <DetailField label="Código interno">
                  {ingredient.codigo_interno ?? "—"}
                </DetailField>
                <DetailField label="Descripción">
                  {ingredient.descripcion?.trim() || "—"}
                </DetailField>
                <DetailField label="Estado">
                  <Badge variant={ingredient.activo ? "success" : "neutral"}>
                    {ingredient.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </DetailField>
              </dl>
            </ProductDetailSection>

            <ProductDetailSection id="ingredient-detail-allergens" title="Alérgenos">
              <IngredientAllergensSection ingredienteId={ingredientId} />
            </ProductDetailSection>

            <section
              aria-label="Desactivar ingrediente"
              className="bg-card border border-error-border rounded-xl p-5 sm:p-6"
            >
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Desactivar ingrediente</h2>
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
