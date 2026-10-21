import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import ElaboracionLinea from "@/components/elaboraciones/ElaboracionLinea";
import RevisarAlergenosDialog from "@/components/elaboraciones/RevisarAlergenosDialog";
import InsumoCreateDialog from "@/components/insumos/InsumoCreateDialog";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormActions from "@/components/ui/FormActions";
import { Input } from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/toastContext";
import { useAppShell } from "@/hooks/useAppShell";
import { useElaboracionRegistro } from "@/hooks/useElaboracionRegistro";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  estadoDeLinea,
  hoyChile,
  TEXTO_CONFIRMAR_FINALIZACION,
  textoProgreso,
} from "@/lib/elaboracionUtils";
import { getElaboracion } from "@/services/elaboracionService";
import type { Elaboracion } from "@/types/elaboracion";
import type { Insumo } from "@/types/insumo";

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default function ElaboracionRegistro() {
  const navigate = useNavigate();
  const { id: rawId } = useParams();
  const elaboracionId = parseId(rawId);
  const { handleLogout, producerName, businessName } = useAppShell();

  const [elaboracion, setElaboracion] = useState<Elaboracion | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setUnavailable(false);
    try {
      setElaboracion(await getElaboracion(id));
    } catch {
      setElaboracion(null);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (elaboracionId == null) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    void load(elaboracionId);
  }, [elaboracionId, load]);

  // A finalizada is read-only: it has no registro screen.
  if (elaboracion?.estado === "finalizada") {
    return <Navigate to={`/elaboraciones/${elaboracion.id}`} replace />;
  }

  return (
    <AppShell
      activePage="productos"
      pageTitle="Elaboración"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {loading && <p className="text-sm text-text-secondary">Cargando elaboración...</p>}

        {!loading && unavailable && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <h1 className="text-lg font-semibold text-text-primary">Elaboración no disponible</h1>
            <p className="text-sm text-text-secondary">
              No encontramos esta elaboración. Puede haber sido eliminada o no pertenecer a tu cuenta.
            </p>
            <Button type="button" variant="secondary" onClick={() => navigate("/productos")}>
              Volver a productos
            </Button>
          </div>
        )}

        {!loading && elaboracion && <Registro key={elaboracion.id} elaboracion={elaboracion} />}
      </div>
    </AppShell>
  );
}

/** Mounted after the borrador is loaded, so the form starts from what is saved. */
function Registro({ elaboracion }: { elaboracion: Elaboracion }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [confirmarFinalizar, setConfirmarFinalizar] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [confirmarSalir, setConfirmarSalir] = useState(false);
  const [insumoNuevoPara, setInsumoNuevoPara] = useState<{ id: number; nombre: string } | null>(null);
  const [insumoARevisar, setInsumoARevisar] = useState<Insumo | null>(null);
  // Bumped when the screen has to take the user to what is wrong. `focoDestino` says which button the focus
  // goes back to when there is nothing to point at (the button that was working is disabled meanwhile).
  const [focoToken, setFocoToken] = useState(0);
  const focoDestino = useRef<"guardar" | "finalizar">("finalizar");
  // Saved or confirmation closed without a problem: go straight back to the button, do not look for anything.
  const soloElBoton = useRef(false);
  const guardarRef = useRef<HTMLButtonElement>(null);
  const finalizarRef = useRef<HTMLButtonElement>(null);

  const form = useElaboracionRegistro({
    elaboracion,
    onFinalizada: (finalizada) =>
      navigate(`/elaboraciones/${finalizada.id}`, { state: { elaboracionFinalizada: true } }),
    onEliminada: () =>
      navigate(`/productos/${elaboracion.producto.id}`, { state: { elaboracionEliminada: true } }),
  });

  const { pendingHref, clearPending } = useUnsavedChangesGuard(form.dirty && !form.busy);
  const hoy = hoyChile();
  const producto = form.servidor.producto;
  // Lines that can take the lot suggested from the last finalized elaboración.
  const lotesElegibles = form.lineas.filter((linea) => form.loteSugeridoDe(linea) !== null).length;
  const estados = form.lineas.map((linea) =>
    estadoDeLinea(linea, form.insumoSeleccionado(linea), form.problemas[linea.ingrediente_id]),
  );
  const faltan = estados.filter((estado) => estado !== "lista").length;

  // Saving or finalizing failed: scroll to the first thing that needs attention (a field marked invalid, or a
  // line with a problem) and leave the focus on it. With nothing to point at (a generic error, or the
  // confirmation closed) the focus goes back to the button that was working, which was disabled meanwhile and
  // let the focus fall to BODY.
  useEffect(() => {
    if (focoToken === 0) return;
    const boton = (focoDestino.current === "guardar" ? guardarRef : finalizarRef).current;
    if (soloElBoton.current) {
      soloElBoton.current = false;
      boton?.focus();
      return;
    }
    let objetivo = document.querySelector<HTMLElement>('[aria-invalid="true"], [data-problema="true"]');
    // A line with a marked field inside: the field is what needs the attention.
    objetivo = objetivo?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? objetivo;
    if (!objetivo) {
      boton?.focus();
      return;
    }
    const sinMovimiento =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    objetivo.focus({ preventScroll: true });
    objetivo.scrollIntoView({ behavior: sinMovimiento ? "auto" : "smooth", block: "center" });
  }, [focoToken]);

  function irAlProblema(destino: "guardar" | "finalizar") {
    focoDestino.current = destino;
    setFocoToken((token) => token + 1);
  }

  async function handleGuardar() {
    if (await form.guardar()) {
      notify("Borrador guardado.");
      // Saved: nothing to point at, the focus returns to the button that was disabled while saving.
      soloElBoton.current = true;
      irAlProblema("guardar");
    } else {
      irAlProblema("guardar");
    }
  }

  async function handleFinalizar() {
    if (await form.prepararFinalizacion()) setConfirmarFinalizar(true);
    else irAlProblema("finalizar");
  }

  async function handleConfirmarFinalizar() {
    await form.finalizar();
    setConfirmarFinalizar(false);
    irAlProblema("finalizar");
  }

  async function handleConfirmarEliminar() {
    await form.eliminar();
    setConfirmarEliminar(false);
  }

  return (
    <>
      <PageHeader
        title={`Elaboración ${form.encabezado.codigo || elaboracion.codigo}`}
        description="Indica el insumo y el lote que usaste para cada ingrediente. Puedes guardar un avance y terminar después."
        titleSuffix={<Badge variant="warning">Borrador</Badge>}
        breadcrumbs={[
          { label: "Productos", to: "/productos" },
          { label: producto.nombre, to: `/productos/${producto.id}` },
          { label: "Elaboración" },
        ]}
        actions={
          <Link
            to={`/productos/${producto.id}`}
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-accent-strong underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Volver al producto
          </Link>
        }
      />

      {form.globalError && <Alert type="error">{form.globalError}</Alert>}

      <form
        noValidate
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void handleGuardar();
        }}
      >
        <section
          aria-labelledby="elaboracion-encabezado"
          className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
        >
          <h2 id="elaboracion-encabezado" className="text-sm font-semibold text-text-primary">
            Datos de la elaboración
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                Producto
              </dt>
              <dd className="text-sm text-text-primary">{producto.nombre}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                Versión de la formulación
              </dt>
              <dd className="text-sm text-text-primary">
                Versión {form.servidor.version.numero_version}
              </dd>
            </div>
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="elaboracion-codigo"
              label="Código de la elaboración"
              value={form.encabezado.codigo}
              onChange={(event) => form.cambiarEncabezado({ codigo: event.target.value })}
              error={form.erroresEncabezado.codigo}
              hint="Es el código que imprimes en el envase. Debe ser único en este producto."
              maxLength={100}
              autoComplete="off"
              disabled={form.busy}
            />
            <Input
              id="elaboracion-fecha"
              label="Fecha de elaboración"
              type="date"
              max={hoy}
              value={form.encabezado.fecha}
              onChange={(event) => form.cambiarEncabezado({ fecha: event.target.value })}
              error={form.erroresEncabezado.fecha}
              disabled={form.busy}
            />
          </div>
        </section>

        <section aria-labelledby="elaboracion-ingredientes" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 id="elaboracion-ingredientes" className="text-sm font-semibold text-text-primary">
                Ingredientes
              </h2>
              <p className="text-sm text-text-secondary">
                Una línea por cada ingrediente de la formulación.
              </p>
              <p
                role="status"
                aria-live="polite"
                data-progreso={faltan === 0 ? "listo" : "faltan"}
                className={`text-sm font-medium ${faltan === 0 ? "text-success" : "text-warning"}`}
              >
                {!form.insumosLoading && !form.insumosError
                  ? textoProgreso(faltan, form.lineas.length)
                  : ""}
              </p>
            </div>
            {lotesElegibles > 0 && (
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={form.usarLotesSugeridos}
                disabled={form.busy}
              >
                Usar los mismos lotes
              </Button>
            )}
          </div>
          <p
            role="status"
            aria-live="polite"
            className={form.anuncioLotes ? "text-sm font-medium text-text-primary" : "sr-only"}
          >
            {form.anuncioLotes}
          </p>

          {form.insumosError && (
            <div role="alert" className="space-y-2 rounded-lg border border-error-border bg-error-bg p-3">
              <p className="text-sm font-medium text-error">No pudimos cargar tus insumos.</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void form.reintentarInsumos()}
              >
                Reintentar
              </Button>
            </div>
          )}
          {form.insumosLoading && (
            <p className="text-sm text-text-secondary">Cargando insumos...</p>
          )}

          {!form.insumosLoading &&
            !form.insumosError &&
            form.lineas.map((linea, indice) => {
              const insumoId = linea.insumoId ? Number(linea.insumoId) : null;
              return (
                <ElaboracionLinea
                  key={linea.ingrediente_id}
                  linea={linea}
                  estado={estados[indice]}
                  insumos={form.insumosPorIngrediente[linea.ingrediente_id] ?? []}
                  uso={form.servidor.usos.find((u) => u.ingrediente_id === linea.ingrediente_id)}
                  lotes={insumoId !== null ? form.lotes[insumoId] : undefined}
                  lotesError={insumoId !== null && Boolean(form.lotesError[insumoId])}
                  error={form.erroresLinea[linea.ingrediente_id]}
                  problemas={form.problemas[linea.ingrediente_id]}
                  insumoSeleccionado={form.insumoSeleccionado(linea)}
                  loteSugerido={form.loteSugeridoDe(linea)}
                  disabled={form.busy}
                  onInsumo={(valor) => form.elegirInsumo(linea.ingrediente_id, valor)}
                  onModoLote={(modo) => form.elegirModoLote(linea.ingrediente_id, modo)}
                  onCambio={(cambios) => form.cambiarLinea(linea.ingrediente_id, cambios)}
                  onUsarLote={(loteId) => form.usarLoteExistente(linea.ingrediente_id, loteId)}
                  onReintentarLotes={form.reintentarLotes}
                  onUsarLoteSugerido={() => form.usarLoteSugerido(linea.ingrediente_id)}
                  onRevisarAlergenos={() => setInsumoARevisar(form.insumoSeleccionado(linea))}
                  onRegistrarInsumo={() =>
                    setInsumoNuevoPara({ id: linea.ingrediente_id, nombre: linea.ingrediente_nombre })
                  }
                />
              );
            })}
        </section>

        <FormActions>
          {form.dirty && (
            <p
              role="status"
              className="col-span-2 self-center text-sm text-text-secondary sm:mr-auto"
            >
              Tienes cambios sin guardar.
            </p>
          )}
          <Button
            ref={guardarRef}
            type="submit"
            variant="secondary"
            className="w-full min-h-11 sm:w-auto"
            loading={form.saving}
            disabled={form.busy}
          >
            Guardar borrador
          </Button>
          <Button
            ref={finalizarRef}
            type="button"
            className="w-full min-h-11 sm:w-auto"
            onClick={() => void handleFinalizar()}
            disabled={form.busy}
          >
            Finalizar elaboración
          </Button>
        </FormActions>
      </form>

      <section
        aria-label="Eliminar borrador"
        className="rounded-xl border border-error-border bg-card p-5 sm:p-6"
      >
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Eliminar borrador</h2>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              Se perderá lo que ya registraste en este borrador. No se puede deshacer.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full border-error/30 text-error hover:bg-error-bg sm:w-auto"
            onClick={() => setConfirmarEliminar(true)}
            disabled={form.busy}
          >
            Eliminar borrador
          </Button>
        </div>
      </section>

      {insumoNuevoPara && (
        <InsumoCreateDialog
          ingrediente={insumoNuevoPara}
          onAssigned={(insumo) => {
            form.asignarInsumoNuevo(insumo);
            setInsumoNuevoPara(null);
            notify("Insumo asignado a la línea. Guarda el borrador para conservarlo.");
          }}
          onCancel={() => setInsumoNuevoPara(null)}
        />
      )}

      {insumoARevisar && (
        <RevisarAlergenosDialog
          insumo={insumoARevisar}
          onGuardado={(insumo) => {
            form.actualizarInsumo(insumo);
            setInsumoARevisar(null);
            notify("Alérgenos del insumo guardados.");
          }}
          onCancel={() => setInsumoARevisar(null)}
        />
      )}

      <ConfirmDialog
        open={confirmarFinalizar}
        title="Finalizar elaboración"
        description={TEXTO_CONFIRMAR_FINALIZACION}
        confirmLabel="Finalizar"
        cancelLabel="Seguir editando"
        loading={form.finalizing}
        onConfirm={() => void handleConfirmarFinalizar()}
        onCancel={() => {
          if (!form.finalizing) setConfirmarFinalizar(false);
        }}
      />

      <ConfirmDialog
        open={confirmarEliminar}
        title="Eliminar borrador"
        description="¿Eliminar este borrador? Se perderá lo que ya registraste en él."
        confirmLabel="Eliminar borrador"
        cancelLabel="Cancelar"
        destructive
        loading={form.deleting}
        onConfirm={() => void handleConfirmarEliminar()}
        onCancel={() => {
          if (!form.deleting) setConfirmarEliminar(false);
        }}
      />

      <ConfirmDialog
        open={confirmarSalir || pendingHref !== null}
        title="Salir sin guardar"
        description="Tienes cambios sin guardar. ¿Deseas salir sin guardar?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => {
          const href = pendingHref;
          clearPending();
          setConfirmarSalir(false);
          navigate(href ?? `/productos/${producto.id}`);
        }}
        onCancel={() => {
          setConfirmarSalir(false);
          clearPending();
        }}
      />
    </>
  );
}
