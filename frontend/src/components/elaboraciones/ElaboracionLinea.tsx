import type { ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import type { ErrorLinea } from "@/hooks/useElaboracionRegistro";
import {
  describirLote,
  describirMotivo,
  lineaPendiente,
  textoUsarLote,
} from "@/lib/elaboracionUtils";
import { formatFormulacionCantidad } from "@/lib/formulationUtils";
import type {
  LineaRegistro,
  LoteInsumo,
  LoteModo,
  LoteUsado,
  MotivoProblema,
  UsoInsumo,
} from "@/types/elaboracion";
import type { Insumo } from "@/types/insumo";

interface ElaboracionLineaProps {
  linea: LineaRegistro;
  /** Active supplies of the ingredient. */
  insumos: Insumo[];
  /** The line as the server has it: tells whether the assigned supply is deactivated. */
  uso: UsoInsumo | undefined;
  lotes: LoteInsumo[] | undefined;
  lotesError: boolean;
  error: ErrorLinea | undefined;
  problemas: MotivoProblema[] | undefined;
  /** The supply selected in the line (an active one from the loaded list), to know its review state. */
  insumoSeleccionado: Insumo | null;
  /** The lot suggested from the last finalized elaboración; already null when it does not apply. */
  loteSugerido: LoteUsado | null;
  disabled: boolean;
  onInsumo: (insumoId: string) => void;
  onModoLote: (modo: LoteModo) => void;
  onCambio: (cambios: Partial<LineaRegistro>) => void;
  onUsarLote: (loteId: number) => void;
  onReintentarLotes: (insumoId: number) => void;
  onRegistrarInsumo: () => void;
  onRevisarAlergenos: () => void;
  onUsarLoteSugerido: () => void;
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm font-medium text-warning"
    >
      {children}
    </p>
  );
}

const MODOS: { valor: Exclude<LoteModo, "">; etiqueta: string }[] = [
  { valor: "nuevo", etiqueta: "Lote nuevo" },
  { valor: "existente", etiqueta: "Lote existente" },
  { valor: "sin_lote", etiqueta: "Sin lote" },
];

/** One ingredient of the formulation: its supply, its lot and what is wrong with it. */
export default function ElaboracionLinea({
  linea,
  insumos,
  uso,
  lotes,
  lotesError,
  error,
  problemas,
  insumoSeleccionado,
  loteSugerido,
  disabled,
  onInsumo,
  onModoLote,
  onCambio,
  onUsarLote,
  onReintentarLotes,
  onRegistrarInsumo,
  onRevisarAlergenos,
  onUsarLoteSugerido,
}: ElaboracionLineaProps) {
  const id = linea.ingrediente_id;
  const titulo = `linea-${id}-titulo`;
  const pendiente = lineaPendiente(linea);
  const cantidad = formatFormulacionCantidad(linea.cantidad, linea.unidad);

  const activos = new Set(insumos.map((insumo) => insumo.id));
  const seleccionado = linea.insumoId ? Number(linea.insumoId) : null;
  // The assigned supply was deactivated: it is no longer an option, but the line must show it.
  const insumoDesactivado =
    seleccionado !== null && !activos.has(seleccionado) && uso?.insumo?.id === seleccionado;
  const sinInsumosActivos = insumos.length === 0 && !insumoDesactivado;
  // The mark follows the supply selected NOW (not what the server brought), or the server's 409.
  const alergenosSinRevisar =
    insumoSeleccionado !== null &&
    (!insumoSeleccionado.alergenos_revisados ||
      Boolean(problemas?.includes("alergenos_sin_revisar")));

  return (
    <section
      aria-labelledby={titulo}
      data-pendiente={pendiente}
      className={`space-y-4 rounded-xl border bg-card p-4 sm:p-5 ${
        error || problemas ? "border-error-border" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 id={titulo} className="text-base font-semibold text-text-primary">
            {linea.ingrediente_nombre}
          </h3>
          {cantidad && <p className="text-sm text-text-secondary">{cantidad}</p>}
        </div>
        {pendiente ? (
          <Badge variant="warning">Pendiente</Badge>
        ) : (
          <Badge variant="success">Completo</Badge>
        )}
      </div>

      {linea.ingredienteDesactivado && (
        <Aviso>
          El ingrediente {linea.ingrediente_nombre} está desactivado. Corrige la formulación del
          producto para poder finalizar.
        </Aviso>
      )}

      {sinInsumosActivos && (
        <Aviso>
          Este ingrediente no tiene insumos activos. Registra uno nuevo para poder asignarlo.
        </Aviso>
      )}

      <Select
        label={`Insumo de ${linea.ingrediente_nombre}`}
        id={`linea-${id}-insumo`}
        value={linea.insumoId}
        onChange={(event) => onInsumo(event.target.value)}
        disabled={disabled || (sinInsumosActivos && !linea.insumoId)}
      >
        <option value="">Sin asignar</option>
        {insumoDesactivado && uso?.insumo && (
          <option value={uso.insumo.id}>{uso.insumo.nombre} (desactivado)</option>
        )}
        {insumos.map((insumo) => (
          <option key={insumo.id} value={insumo.id}>
            {insumo.nombre}
            {insumo.presentacion ? ` · ${insumo.presentacion}` : ""} · {insumo.marca_origen}
            {insumo.habitual ? " (habitual)" : ""}
          </option>
        ))}
      </Select>

      {insumoDesactivado && <Aviso>El insumo asignado está desactivado. Elige otro insumo.</Aviso>}

      {alergenosSinRevisar && (
        <div
          data-alergenos-sin-revisar
          className="flex flex-wrap items-center gap-3 rounded-lg border border-warning-border bg-warning-bg px-3 py-2"
        >
          <Badge variant="warning">Alérgenos sin revisar</Badge>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onRevisarAlergenos}
            disabled={disabled}
          >
            Revisar alérgenos
          </Button>
        </div>
      )}

      <Button
        type="button"
        variant={sinInsumosActivos ? "primary" : "ghost"}
        className="w-full min-h-11 sm:w-auto"
        onClick={onRegistrarInsumo}
        data-destacado={sinInsumosActivos}
        disabled={disabled}
        aria-label={`Registrar insumo nuevo para ${linea.ingrediente_nombre}`}
      >
        Registrar insumo nuevo
      </Button>

      {linea.insumoId && (
        <fieldset className="space-y-3" disabled={disabled}>
          <legend className="text-sm font-medium text-text-primary">
            Lote de {linea.ingrediente_nombre}
          </legend>
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-5">
            {MODOS.map((modo) => (
              <label key={modo.valor} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`linea-${id}-lote`}
                  value={modo.valor}
                  checked={linea.loteModo === modo.valor}
                  onChange={() => onModoLote(modo.valor)}
                  className="h-4 w-4"
                />
                {modo.etiqueta}
              </label>
            ))}
          </div>

          {loteSugerido && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onUsarLoteSugerido}
            >
              {textoUsarLote(loteSugerido.codigo, loteSugerido.fecha_vencimiento)}
            </Button>
          )}

          {linea.loteModo === "nuevo" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id={`linea-${id}-lote-codigo`}
                label="Código del lote"
                value={linea.loteCodigo}
                onChange={(event) => onCambio({ loteCodigo: event.target.value })}
                maxLength={100}
                autoComplete="off"
              />
              <Input
                id={`linea-${id}-lote-vence`}
                label="Vencimiento (opcional)"
                type="date"
                value={linea.loteVence}
                onChange={(event) => onCambio({ loteVence: event.target.value })}
              />
            </div>
          )}

          {linea.loteModo === "existente" && (
            <div className="space-y-2">
              {lotesError ? (
                <p className="text-sm text-error">
                  No pudimos cargar los lotes.{" "}
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={() => onReintentarLotes(Number(linea.insumoId))}
                  >
                    Reintentar
                  </button>
                </p>
              ) : lotes === undefined ? (
                <p className="text-sm text-text-secondary">Cargando lotes...</p>
              ) : lotes.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  Este insumo aún no tiene lotes registrados. Usa «Lote nuevo».
                </p>
              ) : (
                <Select
                  label="Lote registrado"
                  id={`linea-${id}-lote-existente`}
                  value={linea.loteId}
                  onChange={(event) => onCambio({ loteId: event.target.value })}
                >
                  <option value="">Elige un lote</option>
                  {lotes.map((lote) => (
                    <option key={lote.id} value={lote.id}>
                      {describirLote(lote.codigo, lote.fecha_vencimiento)}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}
        </fieldset>
      )}

      {error && (
        <div role="alert" className="space-y-2 text-sm font-medium text-error">
          <p>{error.mensaje}</p>
          {error.usarLoteId !== undefined && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => onUsarLote(error.usarLoteId as number)}
            >
              Usar este lote
            </Button>
          )}
        </div>
      )}

      {problemas && problemas.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 pl-5 text-sm font-medium text-error">
          {problemas.map((motivo, indice) => (
            <li key={`${motivo}-${indice}`}>{describirMotivo(motivo)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
