import { createContext, useContext } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  to: string;
}

export interface ToastApi {
  notify: (message: string, type?: ToastType, action?: ToastAction) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Fuera de un ToastProvider devuelve una función vacía, así los componentes se prueban sin proveedor. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { notify: () => {} };
}
