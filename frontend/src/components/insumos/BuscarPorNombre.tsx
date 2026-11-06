import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { AccionesExistente } from "@/components/insumos/BuscarPorCodigo";
import MiniaturaProducto from "@/components/insumos/MiniaturaProducto";
import {
  EnlaceBoton,
  EstadoVacioDeBusqueda,
  IconoBusqueda,
  IconoCopiar,
  IconoFlechaDerecha,
  IconoTienda,
  NotaDeControl,
  PasoDeFuente,
  PestanasDeBusqueda,
} from "@/components/insumos/piezasBusqueda";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { BusquedaPorNombre, EstadoBusquedaNombre } from "@/hooks/useBusquedaPorNombre";
import { nombreFuente } from "@/lib/fuentesInsumo";

export const MENSAJE_BUSCANDO_NOMBRE = "Buscando en Jumbo…";
export const MENSAJE_CARGANDO_FICHA = "Recuperando la ficha del producto…";
export const MENSAJE_SIN_RESULTADOS =
  "No encontramos productos con ese texto. Prueba con otro nombre o marca, o completa los datos manualmente.";
export const MENSAJE_NO_DISPONIBLE_NOMBRE =
  "No pudimos consultar Jumbo en este momento. Completa los datos manualmente.";
export const MENSAJE_ERROR_NOMBRE =
  "No pudimos completar la búsqueda. Intenta de nuevo o completa los datos manualmente.";
export const MENSAJE_FICHA_NO_ENCONTRADA =
  "Este producto ya no está disponible en Jumbo. Puedes ingresar los datos manualmente.";
export const MENSAJE_FICHA_NO_DISPONIBLE =
  "No pudimos recuperar la ficha en este momento. Elige otro resultado o completa los datos manualmente.";
export const MENSAJE_FICHA_ERROR =
  "No pudimos recuperar la ficha del producto. Intenta de nuevo o completa los datos manualmente.";
export const TITULO_DUPLICADO_NOMBRE = "Este producto ya está en tus insumos";
export const mensajeEncontradoNombre = (fuente: string) =>
  `Encontramos este producto en ${nombreFuente(fuente)}. Revisa los datos antes de crear el insumo.`;

const NOTA = "rounded-lg border px-3.5 py-3 text-sm leading-relaxed";

function mensajeDe(estado: EstadoBusquedaNombre, busqueda: BusquedaPorNombre): string {
  switch (estado) {
    case "buscando":
      return MENSAJE_BUSCANDO_NOMBRE;
    case "cargando_ficha":
      return MENSAJE_CARGANDO_FICHA;
    case "sin_resultados":
      return MENSAJE_SIN_RESULTADOS;
    case "invalido":
      return busqueda.mensaje;
    case "no_disponible":
      return MENSAJE_NO_DISPONIBLE_NOMBRE;
    case "error":
      return MENSAJE_ERROR_NOMBRE;
    case "encontrado":
      return mensajeEncontradoNombre(busqueda.consulta?.fuente ?? "jumbo");
    case "ficha_no_encontrada":
      return busqueda.mensaje || MENSAJE_FICHA_NO_ENCONTRADA;
    case "ficha_no_disponible":
      return MENSAJE_FICHA_NO_DISPONIBLE;
    case "ficha_error":
      return MENSAJE_FICHA_ERROR;
    default:
      return "";
  }
}

/** The states in which the search ends without a way forward: the productor is offered the manual entry (CA10). */
const SIN_SALIDA: EstadoBusquedaNombre[] = [
  "sin_resultados",
  "no_disponible",
  "error",
  "ficha_no_encontrada",
  "ficha_no_disponible",
  "ficha_error",
];

interface BuscarPorNombreProps {
  busqueda: BusquedaPorNombre;
  existente: AccionesExistente;
}

/**
 * The search by name or brand of "Nuevo insumo" (HU07), as in the design: the way of searching, a field, the hits
 * in Jumbo with their thumbnail and, for the one the productor picks, the proposal that preloads the form. It
 * owns no form data and registers nothing.
 */
export default function BuscarPorNombre({ busqueda, existente }: BuscarPorNombreProps) {
  const { estado, duplicado, resultados } = busqueda;
  const [texto, setTexto] = useState("");
  const ocupado = estado === "buscando" || estado === "cargando_ficha";
  const mensaje = mensajeDe(estado, busqueda);
  const sinSalida = SIN_SALIDA.includes(estado);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    void busqueda.buscar(texto);
  }

  return (
    <div className="space-y-4">
      <section
        aria-label="Buscar por nombre o marca"
        className="overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="border-b border-border p-5 sm:p-6">
          <PestanasDeBusqueda modo="nombre" />

          <form onSubmit={enviar} className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
            <div className="w-full flex-1">
              <Input
                label="Nombre o marca"
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                placeholder="Ej. queso mantecoso Quilque"
                inputMode="search"
                autoComplete="off"
                maxLength={100}
                leftIcon={<IconoBusqueda size={16} />}
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={ocupado || !texto.trim()}>
              Buscar en Jumbo
            </Button>
          </form>

          <div className="mt-4">
            <PasoDeFuente icono={<IconoTienda />} nombre="Jumbo.cl" detalle="Busca coincidencias comerciales" />
          </div>
        </div>

        {/* Always mounted: a live region announces what it receives. */}
        <p
          role="status"
          aria-live="polite"
          className={
            mensaje
              ? estado === "encontrado"
                ? `m-5 ${NOTA} border-success-border bg-success-bg text-success`
                : ocupado
                  ? "px-5 py-4 text-sm text-text-secondary"
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
            <div className="mt-4 flex justify-center">
              <EnlaceBoton to="/insumos/nuevo/manual" variant="ghost">
                Ingresar manualmente
              </EnlaceBoton>
            </div>
          </div>
        )}

        {estado === "duplicado" && duplicado && (
          <div
            className={`m-5 ${NOTA} flex flex-col gap-3 border-warning-border bg-warning-bg text-warning sm:flex-row sm:items-center`}
            role="status"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card">
              <IconoCopiar />
            </span>
            <div className="flex-1">
              <p className="font-semibold">
                {TITULO_DUPLICADO_NOMBRE}
                {!duplicado.activo && <span className="font-normal"> (está desactivado; puedes reactivarlo)</span>}
              </p>
              <p className="mt-1 text-xs">Puedes usar la ficha existente y evitar duplicados.</p>
              {existente.aviso && <p className="mt-1 text-xs font-medium text-error">{existente.aviso}</p>}
            </div>
            {existente.hrefVer && (
              <Link
                to={existente.hrefVer(duplicado)}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Usar el insumo existente
              </Link>
            )}
            {!duplicado.activo && (
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                loading={existente.ocupado}
                onClick={() => existente.onReactivar(duplicado)}
              >
                Reactivar
              </Button>
            )}
          </div>
        )}

        {resultados.length > 0 && (
          <div>
            <div className="flex flex-col justify-between gap-1 border-y border-border bg-surface px-5 py-3 sm:flex-row sm:items-center">
              <p className="text-xs text-text-secondary">
                <strong className="font-semibold text-text-primary">Resultados de Jumbo</strong> para “
                {busqueda.texto}”
              </p>
              <p className="text-xs text-text-secondary">Fuente: Jumbo</p>
            </div>
            <ul className="divide-y divide-border" aria-label="Resultados de la búsqueda">
              {resultados.map((resultado) => (
                <li
                  key={resultado.id}
                  className="flex flex-col gap-4 p-4 transition-colors hover:bg-surface sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <MiniaturaProducto src={resultado.imagen_url} nombre={resultado.nombre} fuente="jumbo" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">{resultado.nombre}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        <strong className="font-medium text-text-primary">{resultado.marca ?? "Sin marca"}</strong>
                        {resultado.presentacion ? ` · ${resultado.presentacion}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="w-full shrink-0 sm:w-auto"
                    aria-label={`Revisar ficha de ${resultado.nombre}`}
                    disabled={ocupado}
                    loading={estado === "cargando_ficha" && busqueda.elegido === resultado.id}
                    onClick={() => void busqueda.elegir(resultado)}
                  >
                    Revisar ficha
                    <IconoFlechaDerecha />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {resultados.length === 0 && !mensaje && estado !== "duplicado" && (
          <EstadoVacioDeBusqueda
            icono={<IconoBusqueda size={25} />}
            titulo="Busca por nombre comercial o marca"
            texto="Mostraremos productos encontrados en Jumbo para que elijas la presentación correcta."
          />
        )}
      </section>

      <NotaDeControl />
    </div>
  );
}
