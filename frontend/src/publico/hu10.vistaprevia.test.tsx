import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import { fichaDePrueba } from "@/publico/fichaPublicaDatos";
import * as authService from "@/services/authService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { FichaPublica } from "@/types/consultaPublica";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

const fetchFalso = vi.fn();

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
}

interface Escenario {
  publicado?: boolean;
  ficha?: FichaPublica;
  /** Status of the preview request; anything but 200 answers the API's 404 body. */
  statusPrevia?: number;
}

/** Answers like the API: the product, the productor's preview and the public consultation. */
function responder({ publicado = false, ficha = fichaDePrueba(), statusPrevia = 200 }: Escenario = {}) {
  fetchFalso.mockImplementation(async (url: string) => {
    if (url.includes("/vista-publica")) {
      return statusPrevia === 200 ? json(ficha) : json({ detail: "Producto no encontrado" }, statusPrevia);
    }
    if (url.includes("/publico/productos/")) return json(ficha);
    if (/\/gestion\/productos\/7(\?|$)/.test(url)) {
      return json({ id: 7, nombre: ficha.producto.nombre, publicado, id_publico: publicado ? "tok123" : null });
    }
    return json({ detail: "No encontrado" }, 404);
  });
}

const llamadasA = (fragmento: string) => fetchFalso.mock.calls.filter(([url]) => String(url).includes(fragmento));
const cabecerasDe = (llamada: unknown[]) => new Headers((llamada[1] as RequestInit).headers);
const barra = () => screen.queryByRole("region", { name: "Vista previa pública" });

function iniciarSesion() {
  setAccessToken("token-del-productor");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
}

describe("previsualización de la ficha pública por el productor (HU10, T10-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFalso.mockReset();
    vi.stubGlobal("fetch", fetchFalso);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("la previsualización envía Authorization y no usa la consulta pública", async () => {
    iniciarSesion();
    responder();
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/7/vista-previa"] });

    expect(await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" })).toBeInTheDocument();
    const previa = llamadasA("/gestion/productos/7/vista-publica");
    expect(previa).toHaveLength(1);
    expect(cabecerasDe(previa[0]).get("Authorization")).toBe("Bearer token-del-productor");
    expect(llamadasA("/publico/productos/")).toHaveLength(0);
  });

  it("la vista pública sigue sin enviar Authorization aunque haya sesión del productor", async () => {
    iniciarSesion();
    responder();
    renderWithProviders(<App />, { initialEntries: ["/p/tok123"] });

    expect(await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" })).toBeInTheDocument();
    const publica = llamadasA("/publico/productos/tok123");
    expect(publica).toHaveLength(1);
    expect(cabecerasDe(publica[0]).has("Authorization")).toBe(false);
    expect(llamadasA("/vista-publica")).toHaveLength(0);
  });

  it("la barra de vista previa aparece en la previsualización y nunca en /p/:idPublico", async () => {
    iniciarSesion();
    responder();
    const { unmount } = renderWithProviders(<App />, { initialEntries: ["/publicaciones/7/vista-previa"] });
    await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" });
    expect(barra()).toBeInTheDocument();
    unmount();

    renderWithProviders(<App />, { initialEntries: ["/p/tok123"] });
    await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" });
    expect(barra()).not.toBeInTheDocument();
    expect(screen.queryByText(/Vista previa pública|Volver a la publicación/)).not.toBeInTheDocument();
  });

  it("la barra indica «No publicado» y ofrece volver a la publicación", async () => {
    iniciarSesion();
    responder({ publicado: false, ficha: { ...fichaDePrueba(), producto: { ...fichaDePrueba().producto, id_publico: null } } });
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/7/vista-previa"] });

    const region = await screen.findByRole("region", { name: "Vista previa pública" });
    expect(await within(region).findByText("No publicado")).toBeInTheDocument();
    expect(region).toHaveTextContent("Así verá el consumidor esta ficha");
    expect(region).toHaveTextContent("información no disponible");
    const volver = within(region).getByRole("link", { name: "Volver a la publicación" });
    expect(volver).toHaveAttribute("href", "/publicaciones/7");
    expect(volver.className).toMatch(/min-h-11/);
  });

  it("la barra indica «Publicado» cuando el producto lo está", async () => {
    iniciarSesion();
    responder({ publicado: true });
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/7/vista-previa"] });

    const region = await screen.findByRole("region", { name: "Vista previa pública" });
    expect(await within(region).findByText("Publicado")).toBeInTheDocument();
    expect(within(region).queryByText("No publicado")).not.toBeInTheDocument();
  });

  it("muestra la ficha de un producto sin publicar, con el aviso al consumidor y la selección", async () => {
    iniciarSesion();
    responder({ publicado: false });
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/7/vista-previa"] });

    expect(await screen.findByRole("region", { name: "Elaboración consultada" })).toHaveTextContent("MFRU-042");
    expect(screen.getByRole("combobox", { name: "¿Qué elaboración tienes?" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Aviso al consumidor" })).toBeVisible();
  });

  it("la selección vive en la URL de la previsualización: ?codigo= se envía al servidor", async () => {
    iniciarSesion();
    responder();
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/7/vista-previa?codigo=MFRU-037"] });

    await screen.findByRole("heading", { level: 1, name: "Mermelada de frutilla" });
    expect(String(llamadasA("/vista-publica")[0][0])).toBe(
      "http://localhost:8000/gestion/productos/7/vista-publica?codigo=MFRU-037",
    );
  });

  it("un producto que no existe o no es del productor muestra «No encontramos este producto»", async () => {
    iniciarSesion();
    responder({ statusPrevia: 404 });
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/7/vista-previa"] });

    expect(await screen.findByRole("heading", { name: "No encontramos este producto" })).toBeInTheDocument();
    expect(screen.queryByText("Información no disponible")).not.toBeInTheDocument();
    expect(barra()).toBeInTheDocument();
  });

  it("la ruta de previsualización es privada: sin sesión lleva al acceso y no pide la ficha", async () => {
    vi.mocked(authService.getCurrentProductor).mockRejectedValue(new ApiError("No autenticado", 401));
    responder();
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/7/vista-previa"] });

    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(llamadasA("/vista-publica")).toHaveLength(0);
  });
});
