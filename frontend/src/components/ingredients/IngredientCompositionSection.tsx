import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { formatPorcentaje } from "@/lib/ingredientListUtils";
import {
  addCompositionComponent,
  deleteCompositionComponent,
  listIngredientComposition,
  listIngredients,
  updateCompositionComponent,
} from "@/services/ingredientService";
import { ApiError } from "@/types/auth";
import type { ComposicionComponente, Ingrediente } from "@/types/ingredient";

interface IngredientCompositionSectionProps {
  ingredienteId: number;
  ingredienteTipo: Ingrediente["tipo"];
}

export default function IngredientCompositionSection({
  ingredienteId,
  ingredienteTipo,
}: IngredientCompositionSectionProps) {
  const [composicion, setComposicion] = useState<ComposicionComponente[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<Ingrediente[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [componenteId, setComponenteId] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [orden, setOrden] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPorcentaje, setEditPorcentaje] = useState("");
  const [editOrden, setEditOrden] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ComposicionComponente | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [compositionData, ingredientsData] = await Promise.all([
        listIngredientComposition(ingredienteId),
        listIngredients(),
      ]);
      setComposicion(compositionData);
      setAvailableIngredients(
        ingredientsData.filter((item) => item.id !== ingredienteId),
      );
    } catch {
      setError("No pudimos cargar la composición.");
    } finally {
      setLoading(false);
    }
  }, [ingredienteId]);

  useEffect(() => {
    if (ingredienteTipo !== "compuesto") return;
    void loadData();
  }, [ingredienteTipo, loadData]);

  if (ingredienteTipo !== "compuesto") {
    return null;
  }

  const usedComponentIds = new Set(
    composicion.map((item) => item.ingrediente_componente_id),
  );
  const selectableComponents = availableIngredients.filter(
    (item) => !usedComponentIds.has(item.id),
  );

  async function handleAdd() {
    setActionError("");
    const parsedComponenteId = Number(componenteId);
    const parsedPorcentaje = porcentaje.trim().replace(",", ".");
    if (!parsedComponenteId || !parsedPorcentaje) {
      setActionError("Selecciona un componente e ingresa un porcentaje válido.");
      return;
    }

    setSubmitting(true);
    try {
      await addCompositionComponent(ingredienteId, {
        ingrediente_componente_id: parsedComponenteId,
        porcentaje: parsedPorcentaje,
        orden: orden.trim() ? Number(orden) : null,
      });
      setShowAddForm(false);
      setComponenteId("");
      setPorcentaje("");
      setOrden("");
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No pudimos agregar el componente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: ComposicionComponente) {
    setEditingId(item.id);
    setEditPorcentaje(item.porcentaje);
    setEditOrden(item.orden?.toString() ?? "");
    setActionError("");
  }

  async function handleSaveEdit(item: ComposicionComponente) {
    setActionError("");
    setSubmitting(true);
    try {
      await updateCompositionComponent(ingredienteId, item.id, {
        porcentaje: editPorcentaje.trim().replace(",", "."),
        orden: editOrden.trim() ? Number(editOrden) : null,
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No pudimos actualizar el componente.",
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
      await deleteCompositionComponent(ingredienteId, deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No pudimos eliminar el componente.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading && (
        <p className="text-sm text-text-secondary">Cargando composición...</p>
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

          {composicion.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Este ingrediente compuesto aún no tiene componentes declarados.
            </p>
          ) : (
            <ul className="space-y-3">
              {composicion.map((item) => (
                <li
                  key={item.id}
                  className="border border-border rounded-lg p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {item.nombre}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {item.codigo_interno ?? "—"} ·{" "}
                        {item.tipo === "compuesto" ? "Compuesto" : "Simple"}
                      </p>
                    </div>
                    {editingId !== item.id && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => startEdit(item)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-error border-error/30 hover:bg-error-bg"
                          onClick={() => setDeleteTarget(item)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </div>

                  {editingId === item.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Porcentaje"
                        value={editPorcentaje}
                        onChange={(e) => setEditPorcentaje(e.target.value)}
                        disabled={submitting}
                      />
                      <Input
                        label="Orden"
                        value={editOrden}
                        onChange={(e) => setEditOrden(e.target.value)}
                        disabled={submitting}
                      />
                      <div className="sm:col-span-2 flex gap-2">
                        <Button
                          type="button"
                          onClick={() => void handleSaveEdit(item)}
                          loading={submitting}
                        >
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditingId(null)}
                          disabled={submitting}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      {formatPorcentaje(item.porcentaje)}
                      {item.orden != null ? ` · Orden ${item.orden}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!showAddForm ? (
            <Button type="button" onClick={() => setShowAddForm(true)}>
              + Agregar componente
            </Button>
          ) : (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">
                  Componente
                </span>
                <select
                  value={componenteId}
                  onChange={(e) => setComponenteId(e.target.value)}
                  disabled={submitting}
                  aria-label="Componente"
                  className="w-full rounded-lg border border-border bg-card text-sm px-3 py-2.5"
                >
                  <option value="">Selecciona un ingrediente</option>
                  {selectableComponents.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.codigo_interno ?? "—"} — {item.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Porcentaje"
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  disabled={submitting}
                />
                <Input
                  label="Orden (opcional)"
                  value={orden}
                  onChange={(e) => setOrden(e.target.value)}
                  disabled={submitting}
                />
              </div>
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
        title="Eliminar componente"
        description={`¿Eliminar "${deleteTarget?.nombre}" de la composición?`}
        confirmLabel="Eliminar componente"
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
