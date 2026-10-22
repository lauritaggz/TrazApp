import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Select from "@/components/ui/Select";
import { ROTULACION_OBLIGATORIA_AYUDA } from "@/lib/alergenos";
import { groupDeclarados } from "@/lib/insumoUtils";
import { listAlergenosCatalog } from "@/services/ingredientService";
import {
  addInsumoAlergeno,
  deleteInsumoAlergeno,
  listInsumoAlergenos,
  replaceInsumoAlergenos,
  updateInsumoAlergenoTipo,
} from "@/services/insumoService";
import { ApiError } from "@/types/auth";
import type { AlergenoCatalogo } from "@/types/ingredient";
import {
  TIPO_CONTIENE,
  TIPO_DECLARACION_LABELS,
  TIPO_TRAZAS,
  type AlergenoDeclarado,
  type TipoDeclaracion,
} from "@/types/insumo";

const AYUDA =
  "Estos son los alérgenos declarados en el envase del insumo. Se conservan en cada elaboración que lo utilice y son los que verá el consumidor.";

/*
 * TECHNICAL DEBT (HT06-05, decision 1): the list of declared allergens grouped by type
 * ("Contiene" / "Puede contener", with the mandatory-labelling tag and the change-type and remove
 * buttons) is written twice: here and in AlergenosSelector. They differ on purpose in where they persist
 * (this one is controlled and makes no request; the other calls the API on each action), so they
 * were not unified. If the presentation of that list changes, change both, or extract a shared
 * presentational component.
 */
const GROUPS: { tipo: TipoDeclaracion; titulo: string; vacio: string }[] = [
  { tipo: TIPO_CONTIENE, titulo: "Contiene", vacio: "No hay alérgenos declarados como «Contiene»." },
  {
    tipo: TIPO_TRAZAS,
    titulo: "Puede contener",
    vacio: "No hay alérgenos declarados como «Puede contener».",
  },
];

interface InsumoAllergensSectionProps {
  insumoId: number;
  /** HT06: whether the allergens of the supply were reviewed (insumo.alergenos_revisados). */
  revisado: boolean;
}

export default function InsumoAllergensSection({ insumoId, revisado: revisadoInicial }: InsumoAllergensSectionProps) {
  const [declarados, setDeclarados] = useState<AlergenoDeclarado[]>([]);
  // Any declaration made here is a review too (the API records it), so the state follows the actions.
  const [revisado, setRevisado] = useState(revisadoInicial);
  const [confirming, setConfirming] = useState(false);
  const [catalog, setCatalog] = useState<AlergenoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAlergenoId, setSelectedAlergenoId] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<TipoDeclaracion>(TIPO_CONTIENE);
  const [submitting, setSubmitting] = useState(false);
  const [changingId, setChangingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlergenoDeclarado | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDeclarados(await listInsumoAlergenos(insumoId));
    } catch {
      setError("No pudimos cargar los alérgenos.");
    } finally {
      setLoading(false);
    }
  }, [insumoId]);

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
    setRevisado(revisadoInicial);
  }, [revisadoInicial]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const declaredIds = new Set(declarados.map((item) => item.alergeno_id));
  const available = catalog.filter((item) => !declaredIds.has(item.id));
  const availableObligatorios = available.filter((item) => item.obligatorio_chile);
  const availableOtros = available.filter((item) => !item.obligatorio_chile);
  const grouped = groupDeclarados(declarados);

  function closeAddForm() {
    setShowAddForm(false);
    setSelectedAlergenoId("");
    setSelectedTipo(TIPO_CONTIENE);
    setActionError("");
  }

  async function handleAdd() {
    setActionError("");
    const alergenoId = Number(selectedAlergenoId);
    if (!alergenoId) {
      setActionError("Selecciona un alérgeno del catálogo.");
      return;
    }
    setSubmitting(true);
    try {
      await addInsumoAlergeno(insumoId, alergenoId, selectedTipo);
      setRevisado(true);
      closeAddForm();
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No pudimos declarar el alérgeno.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeTipo(item: AlergenoDeclarado) {
    setActionError("");
    setChangingId(item.alergeno_id);
    const nuevo: TipoDeclaracion = item.tipo === TIPO_CONTIENE ? TIPO_TRAZAS : TIPO_CONTIENE;
    try {
      await updateInsumoAlergenoTipo(insumoId, item.alergeno_id, nuevo);
      setRevisado(true);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No pudimos cambiar el tipo de declaración.",
      );
    } finally {
      setChangingId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError("");
    try {
      await deleteInsumoAlergeno(insumoId, deleteTarget.alergeno_id);
      setRevisado(true);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No pudimos quitar el alérgeno.",
      );
    } finally {
      setDeleting(false);
    }
  }

  /** The productor confirms that the supply contains no allergens: PUT with an empty list. */
  async function handleConfirmSinAlergenos() {
    setActionError("");
    setConfirming(true);
    try {
      const actualizado = await replaceInsumoAlergenos(insumoId, []);
      setRevisado(actualizado.alergenos_revisados);
      setDeclarados(actualizado.alergenos_declarados);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No pudimos confirmar que el insumo no contiene alérgenos.",
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-text-secondary">{AYUDA}</p>

      {loading && <p className="text-sm text-text-secondary">Cargando alérgenos...</p>}

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

          {declarados.length === 0 &&
            (revisado ? (
              <p
                data-estado-revision="revisado-sin-alergenos"
                className="rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm font-medium text-success"
              >
                Sin alérgenos (revisado)
              </p>
            ) : (
              <div
                data-estado-revision="sin-revisar"
                className="space-y-3 rounded-lg border border-warning-border bg-warning-bg px-4 py-3"
              >
                <p className="text-sm font-medium text-warning">Alérgenos sin revisar</p>
                <p className="text-[13px] text-text-secondary">
                  Declara los alérgenos del envase o confirma que el insumo no contiene ninguno. Sin
                  revisar, no se puede finalizar una elaboración que lo use.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleConfirmSinAlergenos()}
                  loading={confirming}
                >
                  Confirmar que no contiene alérgenos
                </Button>
              </div>
            ))}

          {/* With nothing declared the status block above is the one sentence; the groups wait for the first allergen. */}
          <div className="grid gap-4 sm:grid-cols-2">
            {declarados.length > 0 && GROUPS.map((group) => (
              <section
                key={group.tipo}
                aria-label={group.titulo}
                className="space-y-2 rounded-lg border border-border p-4"
              >
                <h3 className="text-sm font-semibold text-text-primary">{group.titulo}</h3>
                {grouped[group.tipo].length === 0 ? (
                  <p className="text-[13px] text-text-secondary">{group.vacio}</p>
                ) : (
                  <ul className="space-y-2">
                    {grouped[group.tipo].map((item) => {
                      const destino =
                        item.tipo === TIPO_CONTIENE ? "Puede contener" : "Contiene";
                      return (
                        <li
                          key={item.alergeno_id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                        >
                          <span className="text-sm font-medium text-text-primary">
                            {item.nombre}
                          </span>
                          {item.obligatorio_chile && (
                            <Badge
                              variant="warning"
                              title={ROTULACION_OBLIGATORIA_AYUDA}
                              className="text-xs font-semibold"
                            >
                              Rotulación obligatoria
                              <span className="sr-only">. {ROTULACION_OBLIGATORIA_AYUDA}</span>
                            </Badge>
                          )}
                          <span className="ml-auto flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-accent-strong hover:underline disabled:opacity-50"
                              aria-label={`Cambiar ${item.nombre} a ${destino}`}
                              disabled={changingId === item.alergeno_id}
                              onClick={() => void handleChangeTipo(item)}
                            >
                              Pasar a {destino}
                            </button>
                            <button
                              type="button"
                              className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:bg-text-primary/10 hover:text-error"
                              aria-label={`Quitar alérgeno ${item.nombre}`}
                              onClick={() => setDeleteTarget(item)}
                            >
                              ×
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {catalogLoading ? (
            <p className="text-sm text-text-secondary" aria-live="polite">
              Cargando catálogo de alérgenos...
            </p>
          ) : catalogError ? (
            <div className="space-y-3">
              <Alert type="error">{catalogError}</Alert>
              <Button type="button" variant="secondary" onClick={() => void loadCatalog()}>
                Reintentar
              </Button>
            </div>
          ) : !showAddForm ? (
            <Button
              type="button"
              onClick={() => setShowAddForm(true)}
              disabled={available.length === 0}
            >
              + Agregar alérgeno
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Alérgeno del catálogo"
                  value={selectedAlergenoId}
                  onChange={(e) => setSelectedAlergenoId(e.target.value)}
                  disabled={submitting}
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
                <Select
                  label="Tipo de declaración"
                  value={selectedTipo}
                  onChange={(e) => setSelectedTipo(e.target.value as TipoDeclaracion)}
                  disabled={submitting}
                >
                  <option value={TIPO_CONTIENE}>{TIPO_DECLARACION_LABELS.contiene}</option>
                  <option value={TIPO_TRAZAS}>{TIPO_DECLARACION_LABELS.trazas}</option>
                </Select>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeAddForm}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void handleAdd()} loading={submitting}>
                  Agregar
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Quitar alérgeno"
        description={
          deleteTarget
            ? `¿Quitar «${deleteTarget.nombre}» de los alérgenos declarados de este insumo?`
            : ""
        }
        confirmLabel="Quitar alérgeno"
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
