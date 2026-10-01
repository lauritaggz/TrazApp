import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";

vi.stubEnv("VITE_API_URL", "http://localhost:8000");

// Con el equipo cargado, los render de formularios largos pueden pasar de 1 s.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
