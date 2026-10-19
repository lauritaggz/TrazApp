import { useCallback, useEffect, useRef, useState } from "react";
import { normalizarCodigoBarras, validarCodigoBarras } from "@/lib/codigoBarras";
import {
  crearDetector,
  FORMATOS_CODIGO_BARRAS,
  type CodigoLeido,
} from "@/lib/lectorCodigoBarras";

export type EstadoEscaner = "iniciando" | "escaneando" | "reconocido" | "error" | "detenido";

/** The detector runs every 250 ms, not on every frame. */
export const INTERVALO_DETECCION_MS = 250;
/** The same code is not reported again for 4 s (for example when the scanner is restarted). */
export const VENTANA_REPETIDOS_MS = 4000;

const RESTRICCIONES_IDEALES: MediaStreamConstraints = {
  video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
};
const RESTRICCIONES_MINIMAS: MediaStreamConstraints = { video: { facingMode: "environment" } };

/** A second request would only ask the user again for something they already refused. */
const ERRORES_SIN_REINTENTO = new Set(["NotAllowedError", "PermissionDeniedError", "SecurityError"]);

function nombreDelError(error: unknown): string {
  return error instanceof Error || error instanceof DOMException ? error.name : "";
}

/**
 * Rear camera. iOS Safari rejects the whole request when it cannot satisfy every constraint (Chrome
 * ignores the ones it cannot), so the richer constraints are tried first and the minimal ones after.
 */
async function pedirCamara(): Promise<MediaStream> {
  const medios = navigator.mediaDevices;
  if (!medios?.getUserMedia) {
    throw new DOMException("La cámara no está disponible en este navegador.", "NotSupportedError");
  }
  try {
    return await medios.getUserMedia(RESTRICCIONES_IDEALES);
  } catch (error) {
    if (ERRORES_SIN_REINTENTO.has(nombreDelError(error))) throw error;
    return medios.getUserMedia(RESTRICCIONES_MINIMAS);
  }
}

function detenerPistas(stream: MediaStream) {
  stream.getTracks().forEach((pista) => pista.stop());
}

interface Options {
  /** Called once with a valid code. The camera is already stopped when it is called. */
  onDetectado: (codigo: string) => void;
}

/**
 * The camera and the reading loop of the barcode scanner. It starts when the component that uses it
 * mounts, and releases the camera when a code is recognized, on `cerrar` and on unmount (CA13).
 * `error` is the raw error of the camera or of the reader; classifying it is up to the screen.
 */
export function useEscanerCodigoBarras({ onDetectado }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Each start takes a number; anything that belongs to an older one is ignored.
  const sesionVigenteRef = useRef(0);
  const ultimoRef = useRef<{ codigo: string; en: number } | null>(null);
  const onDetectadoRef = useRef(onDetectado);

  const [sesion, setSesion] = useState(0);
  const [estado, setEstado] = useState<EstadoEscaner>("iniciando");
  const [error, setError] = useState<unknown>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [linternaDisponible, setLinternaDisponible] = useState(false);
  const [linternaEncendida, setLinternaEncendida] = useState(false);

  useEffect(() => {
    onDetectadoRef.current = onDetectado;
  });

  const liberarCamara = useCallback(() => {
    if (temporizadorRef.current !== null) {
      clearTimeout(temporizadorRef.current);
      temporizadorRef.current = null;
    }
    if (streamRef.current) {
      detenerPistas(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    const numero = ++sesionVigenteRef.current;
    const vigente = () => numero === sesionVigenteRef.current;

    /** The first valid reading that is not the code just reported. */
    function elegir(lecturas: CodigoLeido[]): string | null {
      for (const lectura of lecturas) {
        if (!(FORMATOS_CODIGO_BARRAS as readonly string[]).includes(lectura.format)) continue;
        const candidato = normalizarCodigoBarras(lectura.rawValue);
        if (candidato === null || validarCodigoBarras(candidato) !== null) continue;
        const ultimo = ultimoRef.current;
        if (ultimo && ultimo.codigo === candidato && Date.now() - ultimo.en < VENTANA_REPETIDOS_MS) {
          continue;
        }
        return candidato;
      }
      return null;
    }

    function reconocer(reconocido: string) {
      ultimoRef.current = { codigo: reconocido, en: Date.now() };
      // Anything still in flight from this session must not report again.
      sesionVigenteRef.current += 1;
      liberarCamara();
      setLinternaEncendida(false);
      setCodigo(reconocido);
      setEstado("reconocido");
      onDetectadoRef.current(reconocido);
    }

    async function iniciar() {
      setEstado("iniciando");
      setError(null);
      setCodigo(null);
      setLinternaDisponible(false);
      setLinternaEncendida(false);
      try {
        const { detector } = await crearDetector();
        if (!vigente()) return;

        const stream = await pedirCamara();
        if (!vigente()) {
          // Closed while the browser was asking for permission: do not keep the camera.
          detenerPistas(stream);
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) throw new Error("No se encontró el elemento de video del escáner.");
        video.srcObject = stream;
        await video.play();
        if (!vigente()) return;

        const pista = stream.getVideoTracks()[0];
        const capacidades = pista?.getCapabilities?.() as { torch?: boolean } | undefined;
        setLinternaDisponible(Boolean(capacidades?.torch));
        setEstado("escaneando");

        const revisar = async () => {
          if (!vigente()) return;
          let lecturas: CodigoLeido[] = [];
          try {
            lecturas = await detector.detect(video);
          } catch {
            // The video may not have a frame yet: the next turn tries again.
          }
          if (!vigente()) return;
          const reconocido = elegir(lecturas);
          if (reconocido !== null) {
            reconocer(reconocido);
            return;
          }
          temporizadorRef.current = setTimeout(revisar, INTERVALO_DETECCION_MS);
        };
        temporizadorRef.current = setTimeout(revisar, INTERVALO_DETECCION_MS);
      } catch (causa) {
        if (!vigente()) return;
        liberarCamara();
        setError(causa);
        setEstado("error");
      }
    }

    void iniciar();

    return () => {
      sesionVigenteRef.current += 1;
      liberarCamara();
    };
  }, [sesion, liberarCamara]);

  /** Closes the scanner: stops the camera for good. */
  const cerrar = useCallback(() => {
    sesionVigenteRef.current += 1;
    liberarCamara();
    setLinternaEncendida(false);
    setEstado("detenido");
  }, [liberarCamara]);

  /** Opens the camera again, for example to read another code. */
  const reiniciar = useCallback(() => {
    setSesion((actual) => actual + 1);
  }, []);

  const alternarLinterna = useCallback(async () => {
    const pista = streamRef.current?.getVideoTracks()[0];
    if (!pista) return;
    const siguiente = !linternaEncendida;
    try {
      await pista.applyConstraints({
        advanced: [{ torch: siguiente } as MediaTrackConstraintSet],
      });
      setLinternaEncendida(siguiente);
    } catch {
      // The device did not accept the torch: the button stays as it was.
    }
  }, [linternaEncendida]);

  return {
    videoRef,
    estado,
    error,
    codigo,
    linternaDisponible,
    linternaEncendida,
    alternarLinterna,
    cerrar,
    reiniciar,
  };
}
