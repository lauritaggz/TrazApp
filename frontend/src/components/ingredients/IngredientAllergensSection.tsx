import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  addIngredientAllergen,
  deleteIngredientAllergen,
  listAlergenosCatalog,
  listIngredientAllergens,
} from "@/services/ingredientService";
import { ApiError } from "@/types/auth";
import type { Alergeno } from "@/types/ingredient";

interface IngredientAllergensSectionProps {
  ingredienteId: number;
}

export default function IngredientAllergensSection({
  ingredienteId,
}: IngredientAllergensSectionProps) {
  const [alergenos, setAlergenos] = useState<Alergeno[]>([]);
  const [catalog, setCatalog] = useState<Alergeno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAlergenoId, setSelectedAlergenoId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Alergeno | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [associated, catalogData] = await Promise.all([
        listIngredientAllergens(ingredienteId),
        listAlergenosCatalog(),
      ]);
      setAlergenos(associated);
      setCatalog(catalogData);
    } catch {
      setError("No pudimos cargar los alérgenos.");
    } finally {
      setLoading(false);
    }
  }, [ingredienteId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const associatedIds = new Set(alergenos.map((item) => item.id));
  const availableCatalog = catalog.filter((item) => !associatedIds.has(item.id));

  async function handleAdd() {
    setActionError("");
    const alergenoId = Number(selectedAlergenoId);
    if (!alergenoId) {
      setActionError("Selecciona un alérgeno del catálogo.");
      return;
    }

    setSubmitting(true);
    try {
      await addIngredientAllergen(ingredienteId, alergenoId);
      setShowAddForm(false);
      setSelectedAlergenoId("");
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No pudimos asociar el alérgeno.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError("");
    try {
      await deleteIngredientAllergen(ingredienteId, deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No pudimos eliminar la asociación.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading && (
        <p className="text-sm text-text-secondary">Cargando alérgenos...</p>
      )}

      {!loading && error && (
        <div className="space-y-3">
          <Alert type="error">{error}</Alert>
          <Button type="button" variant="secondary" onClick={() => void loadData()}>
            Reintentar
          </Button>
        </div>
      )}

      {!loading && !error && (
        <>
          {actionError && <Alert type="error">{actionError}</Alert>}

          {alergenos.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Este ingrediente no tiene alérgenos asociados.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {alergenos.map((alergeno) => (
                <div
                  key={alergeno.id}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-50 text-brand-700 border border-brand-100 px-3 py-1 text-xs font-medium"
                >
                  <span>{alergeno.nombre}</span>
                  <button
                    type="button"
                    className="text-brand-800 hover:text-error"
                    aria-label={`Eliminar alérgeno ${alergeno.nombre}`}
                    onClick={() => setDeleteTarget(alergeno)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {!showAddForm ? (
            <Button
              type="button"
              onClick={() => setShowAddForm(true)}
              disabled={availableCatalog.length === 0}
            >
              + Agregar alérgeno
            </Button>
          ) : (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">
                  Alérgeno del catálogo
                </span>
                <select
                  value={selectedAlergenoId}
                  onChange={(e) => setSelectedAlergenoId(e.target.value)}
                  disabled={submitting}
                  aria-label="Alérgeno del catálogo"
                  className="w-full rounded-lg border border-border bg-card text-sm px-3 py-2.5"
                >
                  <option value="">Selecciona un alérgeno</option>
                  {availableCatalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <Button type="button" onClick={() => void handleAdd()} loading={submitting}>
                  Agregar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddForm(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar alérgeno"
        description={`¿Eliminar la asociación con "${deleteTarget?.nombre}"?`}
        confirmLabel="Eliminar asociación"
        cancelLabel="Cancelar"
        destructive
        loading={deleting}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
