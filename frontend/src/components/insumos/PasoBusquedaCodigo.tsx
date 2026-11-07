import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  MENSAJE_ERROR_BUSQUEDA,
  MENSAJE_NO_DISPONIBLE,
  MENSAJE_NO_ENCONTRADO,
  TITULO_DUPLICADO,
  mensajeEncontrado,
  type AccionesExistente,
} from "@/components/insumos/BuscarPorCodigo";
import EscanerCodigoBarras from "@/components/insumos/EscanerCodigoBarras";
import {
  EnlaceBoton,
  EstadoVacioDeBusqueda,
  IconoBaseDeDatos,
  IconoCargando,
  IconoCopiar,
  IconoEscaner,
  IconoFlechaDerecha,
  IconoTienda,
  NotaDeControl,
  PasoDeFuente,
  PestanasDeBusqueda,
} from "@/components/insumos/piezasBusqueda";
import Button from "@/components/ui/Button";
import { nombreFuente } from "@/lib/fuentesInsumo";
import { Input } from "@/components/ui/Input";
import type { BusquedaCodigoBarras, EstadoBusqueda } from "@/hooks/useBusquedaCodigoBarras";

/** What the live region says while the barcode is looked up. */
export const MENSAJE_CONSULTANDO = `Consultando ${nombreFuente("open_food_facts")} y ${nombreFuente("jumbo")}`;

const ESTADOS_CON_RESULTADO: EstadoBusqueda[] = [
  "encontrado",
  "no_encontrado",
  "duplicado",
  "no_disponible",
  "invalido",
  "error",
];
const NOTA = "rounded-lg border px-3.5 py-3 text-sm leading-relaxed";

interface PasoBusquedaCodigoProps {
  busqueda: BusquedaCodigoBarras;
  existente: AccionesExistente;
}

/**
 * The search by barcode of "Nuevo insumo" (HU07), as in the design: the way of searching, the camera, a field
 * to type the number (the camera is not reliable on a computer) and, when the code is not found or the source
 * does not answer, the options to search by name or to enter the data by hand (T07-08). It owns no form data:
 * it reports the lookup, and nothing is registered from here.
 */
export default function PasoBusquedaCodigo({ busqueda, existente }: PasoBusquedaCodigoProps) {
  const { estado, duplicado } = busqueda;
  const [codigo, setCodigo] = useState("");
  const resultadoRef = useRef<HTMLDivElement>(null);
  const estadoAnteriorRef = useRef(estado);

  // The scanner (or the field in it) that had the focus is gone when the answer arrives: the focus goes to
  // the answer, unless something else (a confirmation dialog) has already taken it.
  useEffect(() => {
    const venia = estadoAnteriorRef.current;
    estadoAnteriorRef.current = estado;
    if ((venia !== "buscando" && venia !== "escaneando") || !ESTADOS_CON_RESULTADO.includes(estado)) return;
    const activo = document.activeElement;
    if (!activo || activo === document.body) resultadoRef.current?.focus();
  }, [estado]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    void busqueda.buscar(codigo);
  }

  if (estado === "buscando") {
    return (
      <section aria-label="Buscar por código de barras" className="mx-auto max-w-2xl py-5 sm:py-10">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <IconoCargando />
            </span>
            <div>
              <p className="mb-1 text-xs font-semibold text-brand-600">Consultando fuentes</p>
              <p className="text-xl font-semibold text-text-primary">Estamos preparando la ficha</p>
              <p className="mt-1 text-sm text-text-secondary">Normalmente demora menos de 10 segundos.</p>
            </div>
          </div>
          <p role="status" aria-live="polite" className="mt-6 text-sm font-medium text-text-primary">
            {MENSAJE_CONSULTANDO}
          </p>
          <Button variant="ghost" className="mt-4 w-full" onClick={busqueda.limpiar}>
            Cancelar consulta
          </Button>
        </div>
      </section>
    );
  }

  let mensaje = "";
  if (estado === "encontrado") mensaje = mensajeEncontrado(busqueda.consulta?.fuente ?? "");
  else if (estado === "no_encontrado") mensaje = MENSAJE_NO_ENCONTRADO;
  else if (estado === "no_disponible") mensaje = MENSAJE_NO_DISPONIBLE;
  else if (estado === "invalido") mensaje = busqueda.mensajeInvalido;
  else if (estado === "error") mensaje = MENSAJE_ERROR_BUSQUEDA;
  const sinSalida = estado === "no_encontrado" || estado === "no_disponible";
  const puedeActuar = !existente.veredicto || existente.veredicto === "mismo";

  return (
    <div className="space-y-4">
      <section aria-label="Buscar por código de barras" className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-5 sm:p-6">
          <PestanasDeBusqueda modo="codigo" />

          <div className="mb-4 flex flex-col gap-4 rounded-xl border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
              <IconoEscaner />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">Escanea el código del envase</p>
              <p className="mt-1 text-xs text-text-secondary">
                En celular, la cámara identifica automáticamente los números del código de barras.
              </p>
            </div>
            <Button className="w-full sm:w-auto" onClick={busqueda.abrirEscaner}>
              Abrir cámara
            </Button>
          </div>

          <form onSubmit={enviar} className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
            <div className="w-full flex-1">
              <Input
                label="Código de barras del envase"
                value={codigo}
                onChange={(evento) => setCodigo(evento.target.value)}
                placeholder="Ej. 7801234567890"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={!codigo.trim()}>
              Buscar en fuentes
            </Button>
          </form>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <PasoDeFuente icono={<IconoBaseDeDatos />} nombre={nombreFuente("open_food_facts")} detalle="Identifica nombre y marca" />
            <span className="hidden text-text-secondary sm:block">
              <IconoFlechaDerecha />
            </span>
            <PasoDeFuente icono={<IconoTienda />} nombre="Jumbo.cl" detalle="Verifica el mismo código" />
          </div>
        </div>

        <div ref={resultadoRef} tabIndex={-1} className="focus:outline-none">
          {/* Always mounted: a live region announces what it receives. */}
          <p
            role="status"
            aria-live="polite"
            className={
              mensaje
                ? estado === "encontrado"
                  ? `m-5 ${NOTA} border-success-border bg-success-bg text-success`
                  : sinSalida
                    ? "px-6 pb-2 pt-8 text-center text-sm font-semibold text-text-primary"
                    : `m-5 ${NOTA} border-info-border bg-info-bg text-info`
                : "sr-only"
            }
          >
            {mensaje}
          </p>

          {sinSalida && (
            <div className="px-6 pb-8 text-center">
              <p className="mx-auto max-w-md text-xs text-text-secondary">
                Prueba con el nombre o la marca, o completa la ficha por tu cuenta.
              </p>
              <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                <EnlaceBoton to="/insumos/nuevo/nombre" variant="secondary">
                  Buscar por nombre
                </EnlaceBoton>
                <EnlaceBoton to="/insumos/nuevo/manual" variant="ghost">
                  Ingresar manualmente
                </EnlaceBoton>
              </div>
            </div>
          )}

          {estado === "duplicado" && duplicado && (
            <div
              role="status"
              className={`m-5 ${NOTA} flex flex-col gap-3 border-warning-border bg-warning-bg text-warning sm:flex-row sm:items-center`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card">
                <IconoCopiar />
              </span>
              <div className="flex-1 space-y-3">
                <p className="font-medium">
                  {TITULO_DUPLICADO}
                  {!duplicado.activo && puedeActuar && (
                    <span className="font-normal"> (está desactivado; puedes reactivarlo)</span>
                  )}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  {existente.hrefVer && (
                    <Link
                      to={existente.hrefVer(duplicado)}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      Ver insumo
                    </Link>
                  )}
                  {existente.veredicto === "pendiente" && (
                    <p className="text-sm font-normal text-text-secondary">Comprobando el insumo…</p>
                  )}
                  {puedeActuar && duplicado.activo && existente.onUsar && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      loading={existente.ocupado}
                      onClick={() => existente.onUsar?.(duplicado)}
                    >
                      Usar este insumo
                    </Button>
                  )}
                  {puedeActuar && !duplicado.activo && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      loading={existente.ocupado}
                      onClick={() => existente.onReactivar(duplicado)}
                    >
                      Reactivar
                    </Button>
                  )}
                </div>
                {existente.aviso && <p className="font-medium text-error">{existente.aviso}</p>}
              </div>
            </div>
          )}

          {!mensaje && estado !== "duplicado" && (
            <EstadoVacioDeBusqueda
              icono={<IconoEscaner size={25} />}
              titulo="Ingresa el código del envase"
              texto={`Consultaremos ${nombreFuente("open_food_facts")} y solo combinaremos datos de ${nombreFuente("jumbo")} si el código coincide.`}
            />
          )}
        </div>
      </section>

      <NotaDeControl />

      {busqueda.escanerAbierto && (
        <EscanerCodigoBarras onDetectado={busqueda.buscar} onCerrar={busqueda.cerrarEscaner} />
      )}
    </div>
  );
}
