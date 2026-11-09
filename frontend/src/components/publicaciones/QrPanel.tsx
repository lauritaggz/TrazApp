import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/toastContext";
import { nombreArchivoQr, type FormatoQr } from "@/lib/qrArchivo";
import { obtenerQr } from "@/services/qrService";
import { ApiError } from "@/types/auth";
import type { Product } from "@/types/product";

const NOTA_DESCARGA =
  "Si la descarga no comienza, mantén presionada la imagen del QR y elige «Guardar imagen».";

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError && error.status === 0) {
    return "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  if (error instanceof ApiError && error.status === 409) {
    return "El producto no está publicado: habilita la publicación para descargar su QR.";
  }
  if (error instanceof ApiError && error.status === 500) {
    return "El servidor no pudo generar el QR. Avisa a quien lo administra.";
  }
  return "No pudimos obtener el QR. Inténtalo de nuevo.";
}

/**
 * The permanent QR of a product (HU09): a PNG preview, the public link and id, and the PNG and SVG
 * downloads. The link and the id are permanent, so they show even when the publication is off; the
 * image and the downloads need the product to be published right now.
 */
export default function QrPanel({ product }: { product: Product }) {
  const { notify } = useToast();
  const idPublico = product.id_publico ?? null;
  const urlPublica = product.url_publica ?? null;
  const publicado = product.publicado === true;
  // The id exists but the server cannot build the link: nothing here can work.
  const faltaConfiguracion = idPublico !== null && urlPublica === null;
  const puedeDescargar = publicado && idPublico !== null && urlPublica !== null;

  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorVista, setErrorVista] = useState("");
  const [descargando, setDescargando] = useState<FormatoQr | null>(null);
  const enDescarga = useRef(false);
  const [errorDescarga, setErrorDescarga] = useState("");
  const [errorCopia, setErrorCopia] = useState("");

  const cargarVista = useCallback(async (esVigente: () => boolean) => {
    setCargando(true);
    setErrorVista("");
    try {
      const { blob } = await obtenerQr(product.id, "png");
      if (!esVigente()) return;
      setVistaPrevia(URL.createObjectURL(blob));
    } catch (err) {
      if (esVigente()) setErrorVista(mensajeDeError(err));
    } finally {
      if (esVigente()) setCargando(false);
    }
  }, [product.id]);

  // The preview is the PNG, as a blob; it is released when the panel goes away or the QR changes.
  useEffect(() => {
    if (!puedeDescargar) {
      setVistaPrevia(null);
      return;
    }
    let vigente = true;
    void cargarVista(() => vigente);
    return () => {
      vigente = false;
    };
  }, [puedeDescargar, idPublico, cargarVista]);

  useEffect(() => {
    if (!vistaPrevia) return;
    return () => URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  async function descargar(formato: FormatoQr) {
    if (enDescarga.current) return;
    enDescarga.current = true;
    setDescargando(formato);
    setErrorDescarga("");
    try {
      const { blob, nombre } = await obtenerQr(product.id, formato);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombre ?? nombreArchivoQr(product.codigo_interno, product.id, formato);
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      // Releasing right away can cancel the download in some browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setErrorDescarga(mensajeDeError(err));
    } finally {
      enDescarga.current = false;
      setDescargando(null);
    }
  }

  async function copiar() {
    if (!urlPublica) return;
    setErrorCopia("");
    try {
      await navigator.clipboard.writeText(urlPublica);
      notify("Enlace copiado.");
    } catch {
      setErrorCopia("No pudimos copiar el enlace. Selecciónalo y cópialo manualmente.");
    }
  }

  return (
    <section aria-labelledby="qr-titulo" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4 sm:p-5">
        <h2 id="qr-titulo" className="text-sm font-semibold text-text-primary">
          Código QR permanente
        </h2>
        <p className="mt-1 text-[13px] text-text-secondary">Listo para etiquetas y material impreso.</p>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {idPublico === null && (
          <p className="text-sm text-text-secondary">
            El código QR se genera al habilitar la publicación y no cambia nunca más.
          </p>
        )}

        {faltaConfiguracion && (
          <Alert type="error">
            No se puede mostrar el enlace ni el QR: la dirección pública de TrazApp no está configurada en el
            servidor.
          </Alert>
        )}

        {puedeDescargar && (
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            {vistaPrevia ? (
              <img
                src={vistaPrevia}
                alt={`Código QR de ${product.nombre}`}
                className="mx-auto aspect-square w-full max-w-[18rem]"
              />
            ) : (
              <div
                role="status"
                className="mx-auto flex aspect-square w-full max-w-[18rem] items-center justify-center text-sm text-text-secondary"
              >
                {cargando ? "Generando el QR…" : "El QR no está disponible."}
              </div>
            )}
          </div>
        )}

        {errorVista && (
          <Alert type="error">
            <p>{errorVista}</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => void cargarVista(() => true)}
            >
              Reintentar
            </Button>
          </Alert>
        )}

        {idPublico !== null && !publicado && !faltaConfiguracion && (
          <p className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-text-secondary">
            La publicación está deshabilitada: el QR solo se puede ver y descargar mientras el producto está
            publicado. Tu enlace y tu ID no cambian.
          </p>
        )}

        {urlPublica !== null && idPublico !== null && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-text-secondary">Enlace público</p>
              <p className="mt-1 break-all font-mono text-[13px] text-text-primary">{urlPublica}</p>
              <Button type="button" variant="secondary" className="mt-2 w-full sm:w-auto" onClick={() => void copiar()}>
                Copiar enlace
              </Button>
              {errorCopia && (
                <p role="alert" className="mt-2 text-[13px] font-medium text-error">
                  {errorCopia}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary">ID público</p>
              <p className="mt-1 break-all font-mono text-[13px] text-text-primary">{idPublico}</p>
            </div>
          </div>
        )}

        {idPublico !== null && (
          <div className="space-y-2">
            <Button
              type="button"
              className="w-full"
              disabled={!puedeDescargar || descargando !== null}
              loading={descargando === "png"}
              onClick={() => void descargar("png")}
            >
              {descargando === "png" ? "Descargando…" : "Descargar PNG"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!puedeDescargar || descargando !== null}
              loading={descargando === "svg"}
              onClick={() => void descargar("svg")}
            >
              {descargando === "svg" ? "Descargando…" : "Descargar SVG"}
            </Button>
            {errorDescarga && (
              <Alert type="error">
                <p>{errorDescarga}</p>
              </Alert>
            )}
            <p className="text-[13px] leading-relaxed text-text-secondary sm:hidden">{NOTA_DESCARGA}</p>
          </div>
        )}

        <p className="border-t border-border pt-4 text-[13px] leading-relaxed text-text-secondary">
          El QR no cambia al ocultar elaboraciones o deshabilitar la publicación. El PNG es de alta resolución y el
          SVG es vectorial, aptos para cualquier tamaño de impresión.
        </p>
      </div>
    </section>
  );
}
