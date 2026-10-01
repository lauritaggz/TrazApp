import { createContext, useContext } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastApi {
  notify: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Fuera de un ToastProvider devuelve una función vacía, así los componentes se prueban sin proveedor. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { notify: () => {} };
}
