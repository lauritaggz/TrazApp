import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import { fichaDePrueba } from "@/publico/fichaPublicaDatos";
import { renderFicha } from "@/publico/renderFicha";
import * as authService from "@/services/authService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
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

const TOKEN_A = "token-firmado-a";
const TOKEN_B = "token-firmado-b";

const ficha = (codigo = "MFRU-042", token: string | null = TOKEN_A): FichaPublica => {
  const base = fichaDePrueba({ token_evaluacion: token });
  return { ...base, elaboracion: { ...base.elaboracion!, codigo } };
};

/** Answers the GET of the ficha (by code) and the POST of the evaluation with `statusPost`. */
function responder(statusPost: number | "red" = 201) {
  fetchFalso.mockImplementation(async (url: string) => {
    if (String(url).endsWith("/evaluaciones")) {
      if (statusPost === "red") throw new TypeError("fetch failed");
      return statusPost === 201
        ? json({ registrada: true }, 201)
        : json({ detail: { mensaje: "x" } }, statusPost);
    }
    if (String(url).includes("codigo=MFRU-037")) return json(ficha("MFRU-037", TOKEN_B));
    if (String(url).includes("/publico/productos/")) return json(ficha());
    return json({ detail: "No encontrado" }, 404);
  });
}

const posts = () => fetchFalso.mock.calls.filter(([url]) => String(url).endsWith("/evaluaciones"));
const cuerpoDe = (llamada: unknown[]) => JSON.parse(String((llamada[1] as RequestInit).body));
const cabecerasDe = (llamada: unknown[]) => new Headers((llamada[1] as RequestInit).headers);
const pregunta = () => screen.queryByText("¿Esta información te resultó útil?");
const esperarPregunta = () => screen.findByText("¿Esta información te resultó útil?");
const GRACIAS = "¡Gracias por tu respuesta!";

describe("pregunta «¿Esta información te resultó útil?» (HU11, T11-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFalso.mockReset();
    vi.stubGlobal("fetch", fetchFalso);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  // --- PT11-01: dónde aparece ---------------------------------------------------------------------

  it("PT11-01: con token aparece al final, después de los insumos y antes del aviso", async () => {
    responder();
    renderFicha();

    await esperarPregunta();
    const insumos = screen.getByText("Pectina cítrica");
    const aviso = screen.getByRole("complementary", { name: "Aviso al consumidor" });
    const bloque = screen.getByRole("region", { name: "Evaluación de la información" });
    expect(insumos.compareDocumentPosition(bloque) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bloque.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sí" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "No" })).toBeEnabled();
  });

  it("PT11-01: con token null no aparece (otros estados de la elaboración)", async () => {
    fetchFalso.mockImplementation(async () => json(ficha("MFRU-042", null)));
    renderFicha();

    await screen.findByRole("region", { name: "Elaboración consultada" });
    expect(pregunta()).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Aviso al consumidor" })).toBeInTheDocument();
  });

  it("PT11-01: ni siquiera con un token en la respuesta, la previsualización muestra la pregunta", async () => {
    setAccessToken("token-del-productor");
    vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
    fetchFalso.mockImplementation(async (url: string) => {
      if (String(url).includes("/vista-publica")) return json(ficha());
      if (/\/gestion\/productos\/7(\?|$)/.test(String(url))) return json({ id: 7, publicado: true });
      return json({ detail: "No encontrado" }, 404);
    });
    renderWithProviders(<App />, { initialEntries: ["/publicaciones/7/vista-previa"] });

    await screen.findByRole("region", { name: "Elaboración consultada" });
    expect(pregunta()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sí" })).not.toBeInTheDocument();
  });

  // --- envío ---------------------------------------------------------------------------------------

  it("«Sí» envía util=true con el token, sin Authorization aunque haya sesión; «No» envía util=false", async () => {
    setAccessToken("token-del-productor");
    const user = userEvent.setup();
    responder();
    const { unmount } = renderFicha();
    await esperarPregunta();

    await user.click(screen.getByRole("button", { name: "Sí" }));
    await screen.findByText(GRACIAS);

    expect(posts()).toHaveLength(1);
    const [url, init] = posts()[0] as [string, RequestInit];
    expect(url).toMatch(/\/publico\/productos\/tok123\/evaluaciones$/);
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(cuerpoDe(posts()[0])).toEqual({ token: TOKEN_A, util: true });
    expect(cabecerasDe(posts()[0]).has("Authorization")).toBe(false);
    expect(JSON.stringify(fetchFalso.mock.calls)).not.toContain("token-del-productor");

    unmount();
    window.localStorage.clear();
    fetchFalso.mockClear();
    responder();
    renderFicha();
    await esperarPregunta();
    await user.click(screen.getByRole("button", { name: "No" }));
    await screen.findByText(GRACIAS);
    expect(cuerpoDe(posts()[0])).toEqual({ token: TOKEN_A, util: false });
  });

  it("201 y 409 muestran el agradecimiento y los botones desaparecen", async () => {
    for (const status of [201, 409] as const) {
      window.localStorage.clear();
      fetchFalso.mockReset();
      responder(status);
      const user = userEvent.setup();
      const { unmount } = renderFicha();
      await esperarPregunta();

      await user.click(screen.getByRole("button", { name: "Sí" }));

      expect(await screen.findByText(GRACIAS)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Sí" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "No" })).not.toBeInTheDocument();
      expect(pregunta()).not.toBeInTheDocument();
      unmount();
    }
  });

  it("422 muestra el mensaje de recargar y no ofrece reintentar con el mismo token", async () => {
    const user = userEvent.setup();
    responder(422);
    renderFicha();
    await esperarPregunta();

    await user.click(screen.getByRole("button", { name: "Sí" }));

    expect(await screen.findByText("El enlace para evaluar venció. Recarga la página para responder.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sí" })).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it.each([404, "red"] as const)("%s muestra «Reintentar» y reenvía lo mismo con el mismo token", async (falla) => {
    const user = userEvent.setup();
    responder(falla);
    renderFicha();
    await esperarPregunta();
    await user.click(screen.getByRole("button", { name: "No" }));

    await user.click(await screen.findByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(cuerpoDe(posts()[1])).toEqual({ token: TOKEN_A, util: false });
    expect(window.localStorage.length).toBe(0);

    responder(201);
    await user.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(GRACIAS)).toBeInTheDocument();
  });

  it("un doble clic envía una sola vez y deshabilita los botones mientras se envía", async () => {
    const user = userEvent.setup();
    let liberar: (r: Response) => void = () => {};
    fetchFalso.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/evaluaciones")) return new Promise<Response>((resolver) => (liberar = resolver));
      return json(ficha());
    });
    renderFicha();
    await esperarPregunta();

    await user.dblClick(screen.getByRole("button", { name: "Sí" }));

    expect(screen.getByRole("button", { name: "Sí" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "No" })).toBeDisabled();
    liberar(json({ registrada: true }, 201));
    await screen.findByText(GRACIAS);
    expect(posts()).toHaveLength(1);
  });

  it("los botones miden al menos 44 px de alto (min-h-11) y tienen texto", async () => {
    responder();
    renderFicha();
    await esperarPregunta();

    for (const nombre of ["Sí", "No"]) {
      expect(screen.getByRole("button", { name: nombre })).toHaveClass("min-h-11");
    }
  });

  // --- cambio de elaboración -----------------------------------------------------------------------

  it("cambiar de elaboración reinicia la pregunta y usa el token nuevo", async () => {
    const user = userEvent.setup();
    responder();
    renderFicha();
    await esperarPregunta();
    await user.click(screen.getByRole("button", { name: "Sí" }));
    await screen.findByText(GRACIAS);

    await user.selectOptions(screen.getByRole("combobox", { name: "¿Qué elaboración tienes?" }), "MFRU-037");

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Elaboración consultada" })).toHaveTextContent("MFRU-037"),
    );
    await esperarPregunta();
    expect(screen.queryByText(GRACIAS)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "No" }));
    await screen.findByText(GRACIAS);
    expect(cuerpoDe(posts()[1])).toEqual({ token: TOKEN_B, util: false });
  });

  // --- localStorage --------------------------------------------------------------------------------

  it("tras responder guarda solo la marca del par; al recargar muestra el agradecimiento", async () => {
    const user = userEvent.setup();
    responder();
    const { unmount } = renderFicha();
    await esperarPregunta();
    await user.click(screen.getByRole("button", { name: "Sí" }));
    await screen.findByText(GRACIAS);

    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.key(0)).toBe("trazapp:evaluado:tok123:MFRU-042");
    expect(window.localStorage.getItem("trazapp:evaluado:tok123:MFRU-042")).toBe("1");
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TOKEN_A);

    unmount();
    responder();
    renderFicha();
    expect(await screen.findByText(GRACIAS)).toBeInTheDocument();
    expect(pregunta()).not.toBeInTheDocument();
  });

  it("un 409 también deja la marca, y otra elaboración del mismo producto sí muestra la pregunta", async () => {
    const user = userEvent.setup();
    responder(409);
    const { unmount } = renderFicha();
    await esperarPregunta();
    await user.click(screen.getByRole("button", { name: "No" }));
    await screen.findByText(GRACIAS);
    expect(window.localStorage.getItem("trazapp:evaluado:tok123:MFRU-042")).toBe("1");
    unmount();

    responder();
    renderFicha("/p/tok123?codigo=MFRU-037");
    expect(await esperarPregunta()).toBeInTheDocument();
    expect(screen.queryByText(GRACIAS)).not.toBeInTheDocument();
  });

  it("con localStorage que lanza excepción la pregunta funciona igual", async () => {
    // Only the evaluation keys fail: the app's own session storage is not part of this test.
    const getOriginal = Storage.prototype.getItem;
    const setOriginal = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, clave: string) {
      if (clave.startsWith("trazapp:evaluado:")) throw new Error("bloqueado");
      return getOriginal.call(this, clave);
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, clave: string, valor: string) {
      if (clave.startsWith("trazapp:evaluado:")) throw new Error("bloqueado");
      setOriginal.call(this, clave, valor);
    });
    const user = userEvent.setup();
    responder();
    renderFicha();
    await esperarPregunta();

    await user.click(screen.getByRole("button", { name: "Sí" }));

    expect(await screen.findByText(GRACIAS)).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });
});
