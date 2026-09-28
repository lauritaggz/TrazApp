import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  buildReemplazoPayload,
  formatFormulacionCantidad,
  hasDraftErrors,
  resultadoGuardadoMessage,
  toDraftLines,
  validateDraftLines,
  type FormulacionDraftErrors,
} from "@/lib/formulationUtils";
import { getProductFormulation, saveProductFormulation } from "@/services/formulationService";
import { listIngredients } from "@/services/ingredientService";
import { ApiError } from "@/types/auth";
import type { FormulacionDraftLine, FormulacionVigente } from "@/types/formulation";
import type { Ingrediente } from "@/types/ingredient";
import { PRODUCT_FORM_UNIT_OPTIONS, type UnidadMedida } from "@/types/product";

const DESACTIVADOS_AVISO =
  "Hay ingredientes desactivados en la formulación. Quítalos antes de guardar.";

const EMPTY_ERRORS: FormulacionDraftErrors = { lineas: {} };

interface ProductFormulationSectionProps {
  productoId: number;
}

export default function ProductFormulationSection({
  productoId,
}: ProductFormulationSectionProps) {
  const [formulacion, setFormulacion] = useState<FormulacionVigente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FormulacionDraftLine[]>([]);
  const [draftErrors, setDraftErrors] = useState<FormulacionDraftErrors>(EMPTY_ERRORS);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const [catalog, setCatalog] = useState<Ingrediente[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [selectedIngredienteId, setSelectedIngredienteId] = useState("");

  const loadFormulacion = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setFormulacion(await getProductFormulation(productoId));
    } catch {
      setFormulacion(null);
      setError("No pudimos cargar la formulación.");
    } finally {
      setLoading(false);
    }
  }, [productoId]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      setCatalog(await listIngredients());
    } catch {
      setCatalog([]);
      setCatalogError("No pudimos cargar tus ingredientes.");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFormulacion();
  }, [loadFormulacion]);

  const version = formulacion?.existe ? formulacion.version : null;
  const draftIds = new Set(draft.map((line) => line.ingrediente_id));
  const availableIngredientes = catalog.filter(
    (item) => item.activo && !draftIds.has(item.id),
  );
  const draftHasDesactivados = draft.some((line) => line.desactivado);

  function startEditing() {
    setDraft(toDraftLines(version));
    setDraftErrors(EMPTY_ERRORS);
    setSaveError("");
    setSuccessMessage("");
    setSelectedIngredienteId("");
    setEditing(true);
    void loadCatalog();
  }

  function cancelEditing() {
    if (saving) return;
    setEditing(false);
    setDraftErrors(EMPTY_ERRORS);
    setSaveError("");
  }

  function clearLineError(ingredienteId: number) {
    setDraftErrors((current) => {
      if (!current.lineas[ingredienteId]) return current;
      const lineas = { ...current.lineas };
      delete lineas[ingredienteId];
      return { ...current, lineas };
    });
  }

  function updateLine(ingredienteId: number, changes: Partial<FormulacionDraftLine>) {
    setDraft((lines) =>
      lines.map((line) =>
        line.ingrediente_id === ingredienteId ? { ...line, ...changes } : line,
      ),
    );
    clearLineError(ingredienteId);
  }

  function removeLine(ingredienteId: number) {
    setDraft((lines) => lines.filter((line) => line.ingrediente_id !== ingredienteId));
    clearLineError(ingredienteId);
  }

  function addLine() {
    const ingrediente = availableIngredientes.find(
      (item) => item.id === Number(selectedIngredienteId),
    );
    if (!ingrediente) return;
    setDraft((lines) => [
      ...lines,
      {
        ingrediente_id: ingrediente.id,
        nombre: ingrediente.nombre,
        codigo_interno: ingrediente.codigo_interno,
        cantidad: "",
        unidad: "",
        notas: null,
        desactivado: false,
      },
    ]);
    setSelectedIngredienteId("");
    setDraftErrors((current) => ({ ...current, general: undefined }));
  }

  async function handleSave() {
    setSaveError("");
    const errors = validateDraftLines(draft);
    setDraftErrors(errors);
    if (hasDraftErrors(errors) || draftHasDesactivados) return;

    setSaving(true);
    try {
      const result = await saveProductFormulation(productoId, buildReemplazoPayload(draft));
      setFormulacion({ existe: true, version: result.version });
      setSuccessMessage(
        resultadoGuardadoMessage(result.resultado, result.version.numero_version),
      );
      setEditing(false);
    } catch (err) {
      setSaveError(
        err instanceof ApiError && (err.status === 422 || err.status === 409)
          ? err.message
          : "No pudimos guardar la formulación. Inténtalo nuevamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-text-secondary" aria-live="polite">
        Cargando formulación...
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Alert type="error">{error}</Alert>
        <Button type="button" variant="secondary" onClick={() => void loadFormulacion()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-text-secondary leading-relaxed">
          Ingredientes genéricos del producto. La cantidad y la unidad son
          opcionales, pero si indicas una debes indicar la otra.
        </p>

        {draftHasDesactivados && <Alert type="error">{DESACTIVADOS_AVISO}</Alert>}
        {saveError && <Alert type="error">{saveError}</Alert>}
        {draftErrors.general && <Alert type="error">{draftErrors.general}</Alert>}

        {draft.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Aún no agregas ingredientes a la formulación.
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Ingredientes de la formulación en edición">
            {draft.map((line) => (
              <DraftLineRow
                key={line.ingrediente_id}
                line={line}
                error={draftErrors.lineas[line.ingrediente_id]}
                disabled={saving}
                onChange={(changes) => updateLine(line.ingrediente_id, changes)}
                onRemove={() => removeLine(line.ingrediente_id)}
              />
            ))}
          </ul>
        )}

        <div className="border border-border rounded-lg p-4 space-y-3">
          {catalogLoading ? (
            <p className="text-sm text-text-secondary" aria-live="polite">
              Cargando ingredientes...
            </p>
          ) : catalogError ? (
            <div className="space-y-3">
              <Alert type="error">{catalogError}</Alert>
              <Button type="button" variant="secondary" onClick={() => void loadCatalog()}>
                Reintentar
              </Button>
            </div>
          ) : availableIngredientes.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No hay más ingredientes activos para agregar.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <label className="flex flex-col gap-1.5 flex-1 min-w-0">
                <span className="text-sm font-medium text-text-primary">Ingrediente</span>
                <select
                  value={selectedIngredienteId}
                  onChange={(e) => setSelectedIngredienteId(e.target.value)}
                  disabled={saving}
                  aria-label="Ingrediente para agregar"
                  className="w-full rounded-lg border border-border bg-card text-sm px-3 py-2.5"
                >
                  <option value="">Selecciona un ingrediente</option>
                  {availableIngredientes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.codigo_interno ? `${item.nombre} (${item.codigo_interno})` : item.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={addLine}
                disabled={saving || !selectedIngredienteId}
              >
                + Agregar ingrediente
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={cancelEditing}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void handleSave()}
            loading={saving}
            disabled={draftHasDesactivados}
          >
            Guardar formulación
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {successMessage && <Alert type="success">{successMessage}</Alert>}

      {!version ? (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Este producto aún no tiene formulación.
          </p>
          <Button type="button" className="w-full sm:w-auto" onClick={startEditing}>
            Definir formulación
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Versión vigente: {version.numero_version}
          </p>

          {version.lineas.some((linea) => linea.ingrediente_desactivado) && (
            <Alert type="error">{DESACTIVADOS_AVISO}</Alert>
          )}

          <ul
            className="divide-y divide-border border border-border rounded-lg"
            aria-label="Ingredientes de la formulación"
          >
            {version.lineas.map((linea) => {
              const cantidad = formatFormulacionCantidad(linea.cantidad, linea.unidad);
              return (
                <li
                  key={linea.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-text-primary break-words">
                      {linea.ingrediente_nombre}
                      {linea.ingrediente_codigo_interno && (
                        <span className="ml-2 text-xs font-normal text-text-secondary">
                          {linea.ingrediente_codigo_interno}
                        </span>
                      )}
                    </p>
                    {linea.ingrediente_desactivado && <DesactivadoBadge />}
                  </div>
                  <p className="text-sm text-text-secondary sm:text-right shrink-0">
                    {cantidad ?? "Sin cantidad"}
                  </p>
                </li>
              );
            })}
          </ul>

          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={startEditing}
          >
            Editar formulación
          </Button>
        </>
      )}
    </div>
  );
}

function DraftLineRow({
  line,
  error,
  disabled,
  onChange,
  onRemove,
}: {
  line: FormulacionDraftLine;
  error: string | undefined;
  disabled: boolean;
  onChange: (changes: Partial<FormulacionDraftLine>) => void;
  onRemove: () => void;
}) {
  const cantidadId = `formulacion-cantidad-${line.ingrediente_id}`;
  // Input renders the pair error under the quantity with this id.
  const errorId = error ? `${cantidadId}-error` : undefined;
  return (
    <li className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-text-primary break-words">
            {line.nombre}
            {line.codigo_interno && (
              <span className="ml-2 text-xs font-normal text-text-secondary">
                {line.codigo_interno}
              </span>
            )}
          </p>
          {line.desactivado && <DesactivadoBadge />}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="text-error hover:bg-error-bg px-2 py-1"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Quitar ${line.nombre}`}
        >
          Quitar
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          id={cantidadId}
          label="Cantidad"
          aria-label={`Cantidad de ${line.nombre}`}
          inputMode="decimal"
          placeholder="Opcional"
          value={line.cantidad}
          error={error}
          disabled={disabled || line.desactivado}
          onChange={(e) => onChange({ cantidad: e.target.value })}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-primary">Unidad</span>
          <select
            value={line.unidad}
            onChange={(e) => onChange({ unidad: e.target.value as "" | UnidadMedida })}
            disabled={disabled || line.desactivado}
            aria-label={`Unidad de ${line.nombre}`}
            aria-describedby={errorId}
            className="w-full rounded-lg border border-border bg-card text-sm px-3 py-2.5"
          >
            <option value="">Sin unidad</option>
            {PRODUCT_FORM_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </li>
  );
}

function DesactivadoBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-error-border bg-error-bg px-2 py-0.5 text-[11px] font-semibold text-error">
      Ingrediente desactivado
    </span>
  );
}
