import { useEffect, useState } from "react";
import { ELEMENTO_DE_DATOS } from "@/components/costos/estilos";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toastContext";
import { etiquetaDeOrigen, slugDeJumbo } from "@/lib/costosInsumo";
import { nombreFuente } from "@/lib/fuentesInsumo";
import { actualizarPrecioDesdeJumbo, getInsumo } from "@/services/insumoService";
import { ApiError } from "@/types/auth";
import type { InsumoCosto } from "@/types/costos";

interface ActualizarJumboProps {
  insumo: InsumoCosto;
  ingredienteNombre: string;
  /** El precio ya cambió en el servidor: la calculadora recalcula (sin perder lo que se estaba escribiendo). */
  onActualizado: () => void;
}

/**
 * «Actualizar desde Jumbo» de una línea (CA13): una consulta por clic, solo para el insumo de la línea.
 * El cálculo no trae la ficha del insumo, así que se consulta el insumo para saber si es de Jumbo (slug)
 * y si está activo.
 */
export default function ActualizarJumbo({ insumo, ingredienteNombre, onActualizado }: ActualizarJumboProps) {
  const { notify } = useToast();
  const [conJumbo, setConJumbo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    setConJumbo(false);
    setError("");
    getInsumo(insumo.id)
      .then((completo) => {
        if (vigente) setConJumbo(completo.activo && slugDeJumbo(completo.ficha) !== null);
      })
      .catch(() => {
        if (vigente) setConJumbo(false);
      });
    return () => {
      vigente = false;
    };
  }, [insumo.id]);

  async function actualizar() {
    setError("");
    setActualizando(true);
    try {
      await actualizarPrecioDesdeJumbo(insumo.id);
      notify(`Precio actualizado desde ${nombreFuente("jumbo")}.`);
      onActualizado();
    } catch (err) {
      setError(
        err instanceof ApiError && (err.status === 409 || err.status === 404) && err.message
          ? err.message
          : `No pudimos actualizar el precio desde ${nombreFuente("jumbo")}. Revisa tu conexión e inténtalo de nuevo.`,
      );
    } finally {
      setActualizando(false);
      setConfirmando(false);
    }
  }

  if (!conJumbo) return null;

  return (
    <>
      <button
        type="button"
        disabled={actualizando}
        onClick={() => (insumo.precio_fuente === "manual" ? setConfirmando(true) : void actualizar())}
        className={`${ELEMENTO_DE_DATOS} min-h-11 rounded font-medium text-accent-strong underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {actualizando ? "Actualizando…" : "Actualizar desde Jumbo"}
        <span className="sr-only"> el insumo de {ingredienteNombre}</span>
      </button>
      {error && (
        <p role="alert" className="basis-full pl-5 text-[13px] font-medium text-error">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirmando}
        title="Reemplazar el precio manual"
        description={`El precio actual es manual (${
          etiquetaDeOrigen(insumo.precio_fuente, insumo.precio_fecha) ?? "sin fecha"
        }). Se reemplazará por el de ${nombreFuente("jumbo")}.`}
        confirmLabel="Reemplazar precio"
        cancelLabel="Conservar mi precio"
        loading={actualizando}
        onConfirm={() => void actualizar()}
        onCancel={() => {
          if (!actualizando) setConfirmando(false);
        }}
      />
    </>
  );
}
