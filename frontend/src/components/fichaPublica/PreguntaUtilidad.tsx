import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { marcarEvaluado, yaEvaluado } from "@/lib/evaluacionLocal";
import { enviarEvaluacion } from "@/services/consultaPublicaService";

export const TEXTO_PREGUNTA_UTILIDAD = "¿Esta información te resultó útil?";
export const TEXTO_GRACIAS = "¡Gracias por tu respuesta!";
export const TEXTO_ENLACE_VENCIDO = "El enlace para evaluar venció. Recarga la página para responder.";
export const TEXTO_NO_SE_PUDO_ENVIAR = "No pudimos enviar tu respuesta.";

type Estado = "pregunta" | "enviando" | "gracias" | "vencido" | "error";

interface Props {
  idPublico: string;
  /** Code of the elaboración on screen: with the public id it is the pair remembered in the browser. */
  codigo: string;
  /** Signed single-use token of THIS consultation. The parent keys the component by it, so a new
   *  elaboración (new token) always starts with a fresh question. */
  token: string;
}

/** «¿Esta información te resultó útil?» (HU11): anonymous, one answer per consultation. */
export default function PreguntaUtilidad({ idPublico, codigo, token }: Props) {
  const [estado, setEstado] = useState<Estado>(() => (yaEvaluado(idPublico, codigo) ? "gracias" : "pregunta"));
  const [ultima, setUltima] = useState<boolean | null>(null);
  const enCurso = useRef(false);

  async function responder(util: boolean) {
    if (enCurso.current) return; // A double click must not send twice.
    enCurso.current = true;
    setUltima(util);
    setEstado("enviando");
    try {
      await enviarEvaluacion(idPublico, token, util);
      marcarEvaluado(idPublico, codigo);
      setEstado("gracias");
    } catch (error: unknown) {
      const status = (error as { status?: number } | null)?.status;
      if (status === 409) {
        // Already registered for this consultation: same thanks, and remember it.
        marcarEvaluado(idPublico, codigo);
        setEstado("gracias");
      } else if (status === 422) {
        setEstado("vencido"); // The same token will not work again: no retry.
      } else {
        setEstado("error");
      }
    } finally {
      enCurso.current = false;
    }
  }

  return (
    <section
      aria-label="Evaluación de la información"
      className="mt-6 rounded-2xl border border-border bg-card p-5"
    >
      {estado === "gracias" ? (
        <p role="status" className="text-sm font-medium text-text-primary">
          {TEXTO_GRACIAS}
        </p>
      ) : estado === "vencido" ? (
        <p role="alert" className="text-sm text-text-secondary">
          {TEXTO_ENLACE_VENCIDO}
        </p>
      ) : estado === "error" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-text-secondary">{TEXTO_NO_SE_PUDO_ENVIAR}</p>
          <Button variant="secondary" onClick={() => ultima !== null && void responder(ultima)}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text-primary">{TEXTO_PREGUNTA_UTILIDAD}</p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={estado === "enviando"} onClick={() => void responder(true)}>
              Sí
            </Button>
            <Button variant="secondary" disabled={estado === "enviando"} onClick={() => void responder(false)}>
              No
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
