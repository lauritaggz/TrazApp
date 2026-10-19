/**
 * Fakes for testing the barcode scanner without a camera (HU13): a track that records `stop`, a
 * stream, camera errors, the secure-context flag and the fake clock helper.
 */
import { act } from "@testing-library/react";
import { vi } from "vitest";

export type Lectura = { rawValue: string; format: string };

export const lectura = (rawValue: string, format = "ean_13"): Lectura => ({ rawValue, format });

export function crearPista(capacidades?: Record<string, unknown>) {
  return {
    kind: "video",
    stop: vi.fn(),
    getCapabilities: capacidades === undefined ? undefined : vi.fn(() => capacidades),
    applyConstraints: vi.fn(async () => undefined),
  };
}

export function crearStream(pista: ReturnType<typeof crearPista>) {
  return {
    getTracks: () => [pista],
    getVideoTracks: () => [pista],
  } as unknown as MediaStream;
}

/** An error like the ones getUserMedia rejects with: only its `name` matters to the scanner. */
export function errorDeCamara(name: string) {
  const error = new Error(`falla simulada: ${name}`);
  error.name = name;
  return error;
}

/** jsdom does not declare a secure context; real browsers do on HTTPS and on localhost. */
export function definirContextoSeguro(seguro: boolean) {
  Object.defineProperty(window, "isSecureContext", { value: seguro, configurable: true });
}

export function quitarContextoSeguro() {
  Reflect.deleteProperty(window, "isSecureContext");
}

/** Advances the fake clock and lets the promises that were waiting on it settle. */
export async function avanzar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
