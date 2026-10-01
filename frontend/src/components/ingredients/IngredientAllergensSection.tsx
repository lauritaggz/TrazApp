import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  addIngredientAllergen,
  deleteIngredientAllergen,
  listAlergenosCatalog,
  listIngredientAllergens,
} from "@/services/ingredientService";
import { ApiError } from "@/types/auth";
import type { Alergeno, AlergenoCatalogo } from "@/types/ingredient";

const ROTULACION_OBLIGATORIA_AYUDA =
  "Alérgeno de declaración obligatoria en el rotulado según la Resolución Exenta N.º 427 del Minsal.";

interface IngredientAllergensSectionProps {
  ingredienteId: number;
}

export default function IngredientAllergensSection({
  ingredienteId,
}: IngredientAllergensSectionProps) {
  const [alergenos, setAlergenos] = useState<Alergeno[]>([]);
  const [catalog, setCatalog] = useState<AlergenoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
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
      setAlergenos(await listIngredientAllergens(ingredienteId));
    } catch {
      setError("No pudimos cargar los alérgenos.");
    } finally {
      setLoading(false);
    }
  }, [ingredienteId]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      setCatalog(await listAlergenosCatalog());
    } catch {
      setCatalog([]);
      setCatalogError("No pudimos cargar el catálogo de alérgenos.");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const associatedIds = new Set(alergenos.map((item) => item.id));
  const obligatorioIds = new Set(
    catalog.filter((item) => item.obligatorio_chile).map((item) => item.id),
  );
  // Filtering keeps the backend order, which already lists mandatory first.
  const availableCatalog = catalog.filter((item) => !associatedIds.has(item.id));
  const availableObligatorios = availableCatalog.filter(
    (item) => item.obligatorio_chile,
  );
  const availableOtros = availableCatalog.filter((item) => !item.obligatorio_chile);

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
      <div className="space-y-1 text-xs text-text-secondary leading-relaxed">
        <p>
          Alérgenos de referencia del ingrediente. Los alérgenos de cada
          elaboración se obtienen de los insumos comerciales utilizados.
        </p>
        <p>
          Los marcados con «Rotulación obligatoria» deben declararse en la
          etiqueta del producto según la Resolución Exenta N.º 427 del
          Ministerio de Salud.
        </p>
      </div>

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
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                    obligatorioIds.has(alergeno.id)
                      ? "bg-warning-bg text-warning border-warning-border"
                      : "bg-brand-50 text-brand-700 border-brand-100"
                  }`}
                >
                  <span>{alergeno.nombre}</span>
                  {obligatorioIds.has(alergeno.id) && (
                    <Badge
                      variant="warning"
                      title={ROTULACION_OBLIGATORIA_AYUDA}
                      className="uppercase tracking-wide text-[10px] font-semibold"
                    >
                      Rotulación obligatoria
                      <span className="sr-only">. {ROTULACION_OBLIGATORIA_AYUDA}</span>
                    </Badge>
                  )}
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/5 hover:text-error"
                    aria-label={`Eliminar alérgeno ${alergeno.nombre}`}
                    onClick={() => setDeleteTarget(alergeno)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {catalogLoading ? (
            <p className="text-sm text-text-secondary" aria-live="polite">
              Cargando catálogo de alérgenos...
            </p>
          ) : catalogError ? (
            <div className="space-y-3">
              <Alert type="error">{catalogError}</Alert>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadCatalog()}
              >
                Reintentar
              </Button>
            </div>
          ) : !showAddForm ? (
            <Button
              type="button"
              onClick={() => setShowAddForm(true)}
              disabled={availableCatalog.length === 0}
            >
              + Agregar alérgeno
            </Button>
          ) : (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <Select
                label="Alérgeno del catálogo"
                  value={selectedAlergenoId}
                  onChange={(e) => setSelectedAlergenoId(e.target.value)}
                  disabled={submitting}
                  aria-label="Alérgeno del catálogo"
                  className="w-full rounded-lg border border-border bg-card text-sm px-3 py-2.5"
                >
                  <option value="">Selecciona un alérgeno</option>
                  {availableObligatorios.length > 0 && (
                    <optgroup label="Declaración obligatoria">
                      {availableObligatorios.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {availableOtros.length > 0 && (
                    <optgroup label="Otros alérgenos">
                      {availableOtros.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
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
