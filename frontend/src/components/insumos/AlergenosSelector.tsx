import { useCallback, useEffect, useId, useState } from "react";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { ROTULACION_OBLIGATORIA_AYUDA } from "@/lib/alergenos";
import { alergenosValidos, MENSAJE_ALERGENOS_INVALIDOS } from "@/lib/alergenosDeclaracion";
import { listAlergenosCatalog } from "@/services/ingredientService";
import type { AlergenoCatalogo } from "@/types/ingredient";
import {
  TIPO_CONTIENE,
  TIPO_DECLARACION_LABELS,
  TIPO_TRAZAS,
  type AlergenoDeclaradoInput,
  type AlergenosValue,
  type TipoDeclaracion,
} from "@/types/insumo";

const AYUDA =
  "Declara los alérgenos que indica el envase del insumo. Se conservan en cada elaboración que lo utilice y son los que verá el consumidor.";

const GRUPOS: { tipo: TipoDeclaracion; titulo: string; vacio: string }[] = [
  { tipo: TIPO_CONTIENE, titulo: "Contiene", vacio: "No hay alérgenos declarados como «Contiene»." },
  {
    tipo: TIPO_TRAZAS,
    titulo: "Puede contener",
    vacio: "No hay alérgenos declarados como «Puede contener».",
  },
];

interface AlergenosSelectorProps {
  value: AlergenosValue;
  onChange: (value: AlergenosValue) => void;
  disabled?: boolean;
  /**
   * Show the validation message while the value is invalid. The parent turns it on once the
   * productor tried to save, so an untouched form is not born with an error.
   */
  mostrarError?: boolean;
}

/**
 * Controlled allergen declaration for a supply that is being created (HT06). It makes no request
 * except loading the allergen catalog. The value it receives, even an initial one (for example
 * suggested allergens), is NOT a review: the review happens when the form is saved.
 */
export default function AlergenosSelector({
  value,
  onChange,
  disabled = false,
  mostrarError = false,
}: AlergenosSelectorProps) {
  const ayudaId = useId();
  const sinId = useId();
  const sinAyudaId = useId();
  const errorId = useId();
  const [catalog, setCatalog] = useState<AlergenoCatalogo[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<TipoDeclaracion>(TIPO_CONTIENE);
  const [addError, setAddError] = useState("");

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
    void loadCatalog();
  }, [loadCatalog]);

  const invalido = mostrarError && !alergenosValidos(value);
  const hayAlergenos = value.items.length > 0;
  const declaredIds = new Set(value.items.map((item) => item.alergeno_id));
  const available = catalog.filter((item) => !declaredIds.has(item.id));
  const availableObligatorios = available.filter((item) => item.obligatorio_chile);
  const availableOtros = available.filter((item) => !item.obligatorio_chile);

  function detalle(item: AlergenoDeclaradoInput) {
    const found = catalog.find((entry) => entry.id === item.alergeno_id);
    return {
      ...item,
      nombre: found?.nombre ?? `Alérgeno ${item.alergeno_id}`,
      obligatorio: found?.obligatorio_chile ?? false,
    };
  }

  function closeAddForm() {
    setShowAddForm(false);
    setSelectedId("");
    setSelectedTipo(TIPO_CONTIENE);
    setAddError("");
  }

  function handleAdd() {
    const alergenoId = Number(selectedId);
    if (!alergenoId) {
      setAddError("Selecciona un alérgeno del catálogo.");
      return;
    }
    // Declaring an allergen contradicts "contains none": the confirmation clears itself.
    onChange({
      items: [...value.items, { alergeno_id: alergenoId, tipo: selectedTipo }],
      sinAlergenos: false,
    });
    closeAddForm();
  }

  function handleChangeTipo(alergenoId: number) {
    onChange({
      ...value,
      items: value.items.map((item) =>
        item.alergeno_id === alergenoId
          ? { ...item, tipo: item.tipo === TIPO_CONTIENE ? TIPO_TRAZAS : TIPO_CONTIENE }
          : item,
      ),
    });
  }

  function handleRemove(alergenoId: number) {
    onChange({ ...value, items: value.items.filter((item) => item.alergeno_id !== alergenoId) });
  }

  function handleSinAlergenos(checked: boolean) {
    // It can only be confirmed with nothing declared (the checkbox is disabled otherwise).
    onChange({ items: checked ? [] : value.items, sinAlergenos: checked });
  }

  const sinDescribedBy = [sinAyudaId, invalido ? errorId : null].filter(Boolean).join(" ");

  return (
    <fieldset
      data-alergenos-selector
      aria-describedby={[ayudaId, invalido ? errorId : null].filter(Boolean).join(" ")}
      className="min-w-0 space-y-4"
    >
      <legend className="text-sm font-medium text-text-primary">Alérgenos del insumo</legend>
      <p id={ayudaId} className="text-[13px] leading-relaxed text-text-secondary">
        {AYUDA}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {GRUPOS.map((grupo) => {
          const items = value.items.filter((item) => item.tipo === grupo.tipo).map(detalle);
          return (
            <section
              key={grupo.tipo}
              aria-label={grupo.titulo}
              className="space-y-2 rounded-lg border border-border p-4"
            >
              <h3 className="text-sm font-semibold text-text-primary">{grupo.titulo}</h3>
              {items.length === 0 ? (
                <p className="text-[13px] text-text-secondary">{grupo.vacio}</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => {
                    const destino = item.tipo === TIPO_CONTIENE ? "Puede contener" : "Contiene";
                    return (
                      <li
                        key={item.alergeno_id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                      >
                        <span className="text-sm font-medium text-text-primary">{item.nombre}</span>
                        {item.obligatorio && (
                          <Badge
                            variant="warning"
                            title={ROTULACION_OBLIGATORIA_AYUDA}
                            className="text-[10px] font-semibold uppercase tracking-wide"
                          >
                            Rotulación obligatoria
                            <span className="sr-only">. {ROTULACION_OBLIGATORIA_AYUDA}</span>
                          </Badge>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded px-2 py-1 text-[13px] font-medium text-accent-strong hover:underline disabled:opacity-50"
                            aria-label={`Cambiar ${item.nombre} a ${destino}`}
                            disabled={disabled}
                            onClick={() => handleChangeTipo(item.alergeno_id)}
                          >
                            Pasar a {destino}
                          </button>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-text-primary/10 hover:text-error disabled:opacity-50"
                            aria-label={`Quitar alérgeno ${item.nombre}`}
                            disabled={disabled}
                            onClick={() => handleRemove(item.alergeno_id)}
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
          );
        })}
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
          variant="secondary"
          onClick={() => setShowAddForm(true)}
          disabled={disabled || available.length === 0}
        >
          + Agregar alérgeno
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Alérgeno del catálogo"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setAddError("");
              }}
              error={addError || undefined}
              disabled={disabled}
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
              disabled={disabled}
            >
              <option value={TIPO_CONTIENE}>{TIPO_DECLARACION_LABELS.contiene}</option>
              <option value={TIPO_TRAZAS}>{TIPO_DECLARACION_LABELS.trazas}</option>
            </Select>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeAddForm}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAdd}>
              Agregar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <input
            id={sinId}
            type="checkbox"
            name="sin_alergenos"
            checked={value.sinAlergenos}
            disabled={disabled || hayAlergenos}
            onChange={(e) => handleSinAlergenos(e.target.checked)}
            aria-describedby={sinDescribedBy}
            aria-invalid={invalido || undefined}
            className="mt-1 h-4 w-4 rounded border-border-strong accent-brand-600"
          />
          <div className="space-y-0.5">
            <label htmlFor={sinId} className="block text-sm font-medium text-text-primary">
              Este insumo no contiene alérgenos
            </label>
            <p id={sinAyudaId} className="text-[13px] text-text-secondary">
              {hayAlergenos
                ? "Quita los alérgenos declarados para poder marcar esta opción."
                : "Márcalo solo si el envase no declara ningún alérgeno."}
            </p>
          </div>
        </div>
        {invalido && (
          <p id={errorId} role="alert" className="text-[13px] text-error">
            {MENSAJE_ALERGENOS_INVALIDOS}
          </p>
        )}
      </div>
    </fieldset>
  );
}
