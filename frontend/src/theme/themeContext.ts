import { createContext, useContext } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "trazapp_tema";

export interface ThemeApi {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeApi | null>(null);

/** Fuera de un ThemeProvider devuelve el modo claro sin efecto, así los componentes se prueban solos. */
export function useTheme(): ThemeApi {
  return (
    useContext(ThemeContext) ?? {
      theme: "light",
      setTheme: () => {},
      toggleTheme: () => {},
    }
  );
}
