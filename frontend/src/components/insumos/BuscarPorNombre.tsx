import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { AccionesExistente } from "@/components/insumos/BuscarPorCodigo";
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

interface BuscarPorNombreProps {
  busqueda: BusquedaPorNombre;
  existente: AccionesExistente;
}

/**
 * The «search by name or brand» block of the supply form (HU07): a field, the hits in Jumbo and, for the
 * one the productor picks, the proposal that preloads the form. It owns no form data and registers nothing.
 */
export default function BuscarPorNombre({ busqueda, existente }: BuscarPorNombreProps) {
  const { estado, duplicado, resultados } = busqueda;
  const [texto, setTexto] = useState("");
  const ocupado = estado === "buscando" || estado === "cargando_ficha";
  const mensaje = mensajeDe(estado, busqueda);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    void busqueda.buscar(texto);
  }

  return (
    <section
      aria-label="Buscar por nombre o marca"
      className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-text-primary">Buscar por nombre o marca</h2>
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Busca el producto en el catálogo de Jumbo y elige la presentación correcta. Completamos el
          formulario con su ficha; tú lo revisas antes de crear el insumo.
        </p>
      </div>

      <form onSubmit={enviar} className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Nombre o marca"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Ej. queso mantecoso Quilque"
            inputMode="search"
            autoComplete="off"
            maxLength={100}
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto" disabled={ocupado || !texto.trim()}>
          Buscar
        </Button>
      </form>

      <div className="space-y-3">
        {/* Always mounted: a live region announces what it receives. */}
        <p
          role="status"
          aria-live="polite"
          className={
            mensaje
              ? estado === "encontrado"
                ? `${NOTA} border-success-border bg-success-bg text-success`
                : ocupado
                  ? "text-sm text-text-secondary"
                  : `${NOTA} border-info-border bg-info-bg text-info`
              : "sr-only"
          }
        >
          {mensaje}
        </p>

        {estado === "duplicado" && duplicado && (
          <div className={`${NOTA} space-y-3 border-warning-border bg-warning-bg text-warning`} role="status">
            <p className="font-medium">
              {TITULO_DUPLICADO_NOMBRE}
              {!duplicado.activo && <span className="font-normal"> (está desactivado; puedes reactivarlo)</span>}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {existente.hrefVer && (
                <Link
                  to={existente.hrefVer(duplicado)}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Usar el insumo existente
                </Link>
              )}
              {!duplicado.activo && (
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
        )}

        {resultados.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-text-secondary">
              <strong className="font-semibold text-text-primary">Resultados de Jumbo</strong> para “{busqueda.texto}”
              {" · "}Fuente: Jumbo
            </p>
            <ul
              className="divide-y divide-border rounded-lg border border-border"
              aria-label="Resultados de la búsqueda"
            >
              {resultados.map((resultado) => (
                <li key={resultado.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary">{resultado.nombre}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      <strong className="font-medium text-text-primary">{resultado.marca ?? "Sin marca"}</strong>
                      {resultado.presentacion ? ` · ${resultado.presentacion}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    aria-label={`Revisar ficha de ${resultado.nombre}`}
                    disabled={ocupado}
                    loading={estado === "cargando_ficha" && busqueda.elegido === resultado.id}
                    onClick={() => void busqueda.elegir(resultado)}
                  >
                    Revisar ficha
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
