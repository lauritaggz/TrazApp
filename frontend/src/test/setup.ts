import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.stubEnv("VITE_API_URL", "http://localhost:8000");

afterEach(() => {
  cleanup();
  localStorage.clear();
});
