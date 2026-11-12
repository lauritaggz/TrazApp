import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AvisoAmbar from "@/components/elaboraciones/relacionadas/AvisoAmbar";
import CifrasRelacionadas from "@/components/elaboraciones/relacionadas/CifrasRelacionadas";
import ElaboracionesPestanas from "@/components/elaboraciones/relacionadas/ElaboracionesPestanas";
import FilaRelacionada from "@/components/elaboraciones/relacionadas/FilaRelacionada";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import EmptyStateCard from "@/components/ui/EmptyStateCard";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppShell } from "@/hooks/useAppShell";
import { useElaboracionesRelacionadas } from "@/hooks/useElaboracionesRelacionadas";
import {
  RUTA_RASTREAR,
  avisoOtrasSinLote,
  avisoSinLoteDelInsumo,
  cifrasDelResultado,
  leerSeleccion,
  opcionesDeLotes,
  rutaRastrear,
} from "@/lib/relacionadas";
import { listLotesInsumo } from "@/services/elaboracionService";
import { listInsumos } from "@/services/insumoService";
import type { LoteInsumo } from "@/types/elaboracion";
import type { Insumo } from "@/types/insumo";
import type { ResultadoRelacionadas } from "@/types/relacionadas";

function esDeLote(datos: ResultadoRelacionadas): datos is Extract<ResultadoRelacionadas, { lote: unknown }> {
  return "lote" in datos;
}

/**
 * «Rastrear insumo» (HU08): in which elaboraciones a supply, or one lot of it, was used. The selection lives in
 * the URL (`?insumo=3&lote=5`) so the back button and the links from the supply detail work. Read only.
 */
export default function ElaboracionesRastrear() {
  const navigate = useNavigate();
  const { handleLogout, producerName, businessName } = useAppShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const seleccion = useMemo(() => leerSeleccion(searchParams), [searchParams]);
  const { estado, recargar } = useElaboracionesRelacionadas(seleccion.insumo, seleccion.lote);

  // --- the supplies to choose from (active and inactive: a recall can reach an old supply) ---
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumosError, setInsumosError] = useState(false);
  const [recargaInsumos, setRecargaInsumos] = useState(0);

  useEffect(() => {
    let vigente = true;
    Promise.all([listInsumos({ activo: true }), listInsumos({ activo: false })]).then(
      ([activos, inactivos]) => {
        if (!vigente) return;
        setInsumos([...activos, ...inactivos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
        setInsumosError(false);
      },
      () => {
        if (vigente) setInsumosError(true);
      },
    );
    return () => {
      vigente = false;
    };
  }, [recargaInsumos]);

  // --- the lots of the chosen supply ---
  const [lotesDe, setLotesDe] = useState<{ insumo: number; lotes: LoteInsumo[] } | null>(null);
  useEffect(() => {
    const insumoId = seleccion.insumo;
    if (insumoId === null) return;
    let vigente = true;
    listLotesInsumo(insumoId).then(
      (lista) => {
        if (vigente) setLotesDe({ insumo: insumoId, lotes: Array.isArray(lista) ? lista : [] });
      },
      () => {
        // Without the list the selector only offers «Todos los lotes del insumo».
      },
    );
    return () => {
      vigente = false;
    };
  }, [seleccion.insumo]);

  const cambiarInsumo = useCallback(
    (valor: string) => setSearchParams(valor ? { insumo: valor } : {}),
    [setSearchParams],
  );
  const cambiarLote = useCallback(
    (valor: string) => {
      if (seleccion.insumo === null) return;
      setSearchParams(valor ? { insumo: String(seleccion.insumo), lote: valor } : { insumo: String(seleccion.insumo) });
    },
    [seleccion.insumo, setSearchParams],
  );

  // The lots belong to the supply they were asked for: after changing the supply the old ones are not shown.
  const opcionesLote = opcionesDeLotes(lotesDe?.insumo === seleccion.insumo ? lotesDe.lotes : []);
  const insumoElegido = insumos.some((i) => i.id === seleccion.insumo) ? String(seleccion.insumo) : "";

  return (
    <AppShell activePage="elaboraciones" onLogout={handleLogout} producerName={producerName} businessName={businessName}>
      <div className="max-w-5xl space-y-6">
        <PageHeader
          title="Elaboraciones"
          description="Consulta el historial de producción o rastrea en qué elaboraciones se usó un insumo o un lote."
        />
        <ElaboracionesPestanas activa="rastrear" />

        <section
          aria-labelledby="rastreo-titulo"
          className="rounded-xl border border-brand-200 bg-brand-50 p-4 sm:p-5"
        >
          <h2 id="rastreo-titulo" className="text-sm font-semibold text-text-primary">
            Trazabilidad inversa de insumos
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">
            Identifica las elaboraciones que podrían estar afectadas ante un problema informado por el fabricante.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Insumo comercial" value={insumoElegido} onChange={(e) => cambiarInsumo(e.target.value)}>
              <option value="">Elige un insumo</option>
              {insumos.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>
                  {insumo.nombre}
                  {insumo.activo ? "" : " (inactivo)"}
                </option>
              ))}
            </Select>
            <Select
              label="Lote específico (opcional)"
              value={seleccion.lote === null ? "" : String(seleccion.lote)}
              onChange={(e) => cambiarLote(e.target.value)}
              disabled={seleccion.insumo === null}
            >
              <option value="">Todos los lotes del insumo</option>
              {opcionesLote.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.etiqueta}
                </option>
              ))}
            </Select>
          </div>
          {insumosError && (
            <div className="mt-3">
              <Alert type="error">
                <p>No pudimos cargar tus insumos. Revisa tu conexión e inténtalo de nuevo.</p>
                <Button type="button" variant="secondary" className="mt-3" onClick={() => setRecargaInsumos((n) => n + 1)}>
                  Reintentar
                </Button>
              </Alert>
            </div>
          )}
        </section>

        {estado.fase === "inicial" && (
          <EmptyStateCard
            title="Elige un insumo para empezar"
            description="Verás en qué elaboraciones se usó, con qué lote y si su producto está publicado. Si quieres, acota la búsqueda a un lote."
          />
        )}

        {estado.fase === "cargando" && (
          <div className="space-y-3" aria-busy="true">
            <p className="text-sm text-text-secondary" aria-live="polite">
              Cargando elaboraciones...
            </p>
            {[0, 1, 2].map((n) => (
              <div key={n} className="space-y-2 rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            ))}
          </div>
        )}

        {estado.fase === "error" && (
          <Alert type="error">
            <p>No pudimos cargar las elaboraciones. Revisa tu conexión e inténtalo de nuevo.</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={recargar}>
              Reintentar
            </Button>
          </Alert>
        )}

        {estado.fase === "no_encontrado" && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h2 className="mb-2 text-lg font-semibold text-text-primary">
              {seleccion.lote === null ? "No encontramos ese insumo" : "No encontramos ese lote en este insumo"}
            </h2>
            <p className="mb-6 text-sm text-text-secondary">
              {seleccion.lote === null
                ? "Puede que ya no exista o que no sea uno de tus insumos."
                : "Puede que no exista o que pertenezca a otro insumo."}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                navigate(seleccion.lote === null || seleccion.insumo === null ? RUTA_RASTREAR : rutaRastrear(seleccion.insumo))
              }
            >
              {seleccion.lote === null ? "Elegir otro insumo" : "Ver todos los lotes del insumo"}
            </Button>
          </div>
        )}

        {estado.fase === "ok" && <Resultado datos={estado.datos} />}
      </div>
    </AppShell>
  );
}

function Resultado({ datos }: { datos: ResultadoRelacionadas }) {
  const { insumo, resumen, elaboraciones } = datos;
  const deLote = esDeLote(datos);
  const aviso = deLote
    ? avisoOtrasSinLote(datos.otras_sin_lote)
    : avisoSinLoteDelInsumo("elaboraciones_sin_lote" in resumen ? resumen.elaboraciones_sin_lote : 0);
  const nombreInsumo = `${insumo.nombre}${insumo.activo ? "" : " (inactivo)"}`;

  return (
    <section aria-labelledby="relacionadas-titulo" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="relacionadas-titulo" className="text-base font-semibold text-text-primary">
            Elaboraciones relacionadas
          </h2>
          <p className="text-sm text-text-secondary">
            {deLote ? `Insumo ${nombreInsumo} · lote ${datos.lote.codigo}` : `Todas las apariciones de ${nombreInsumo}`}
          </p>
        </div>
        <span className="self-start rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-accent-strong">
          {resumen.total_elaboraciones} {resumen.total_elaboraciones === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      {aviso && (
        <AvisoAmbar enlace={deLote ? { to: rutaRastrear(insumo.id), texto: "Ver las elaboraciones de este insumo" } : undefined}>
          {aviso}
        </AvisoAmbar>
      )}

      {elaboraciones.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h3 className="text-sm font-semibold text-text-primary">
            {deLote ? "Este lote no se ha usado en ninguna elaboración" : "Este insumo no se ha usado en ninguna elaboración"}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {deLote
              ? "Ninguna de tus elaboraciones registró este lote."
              : "Cuando una elaboración lo use, aparecerá aquí."}
          </p>
        </div>
      ) : (
        <>
          <CifrasRelacionadas cifras={cifrasDelResultado(resumen, elaboraciones)} />
          <ul
            aria-label="Elaboraciones relacionadas"
            className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
          >
            {elaboraciones.map((elaboracion) => (
              <FilaRelacionada key={elaboracion.id} elaboracion={elaboracion} insumoNombre={insumo.nombre} />
            ))}
          </ul>
        </>
      )}

      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-xs leading-relaxed text-text-secondary">
        Consulta de solo lectura. Las elaboraciones finalizadas se muestran con la información conservada al
        finalizar; los borradores, con los datos actuales.
      </p>
    </section>
  );
}
