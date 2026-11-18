import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as ingredientService from "@/services/ingredientService";
import * as insumoService from "@/services/insumoService";
import { mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { Insumo } from "@/types/insumo";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  listInsumos: vi.fn(),
  getInsumo: vi.fn(),
  createInsumo: vi.fn(),
  updateInsumo: vi.fn(),
  deactivateInsumo: vi.fn(),
  reactivateInsumo: vi.fn(),
  actualizarPrecioDesdeJumbo: vi.fn(),
  listInsumoAlergenos: vi.fn(),
  addInsumoAlergeno: vi.fn(),
  updateInsumoAlergenoTipo: vi.fn(),
  deleteInsumoAlergeno: vi.fn(),
  replaceInsumoAlergenos: vi.fn(),
}));

vi.mock("@/services/ingredientService", () => ({
  listIngredients: vi.fn(),
  getIngredient: vi.fn(),
  createIngredient: vi.fn(),
  listAlergenosCatalog: vi.fn(),
}));

function insumo(overrides: Partial<Insumo> = {}): Insumo {
  return {
    id: 10,
    productor_id: 1,
    ingrediente_id: 1,
    ingrediente: { id: 1, nombre: "Leche" },
    nombre: "Leche Colun 1 L",
    marca_origen: "Colun",
    presentacion: "Caja de 1 L",
    codigo_barras: null,
    ingredientes_declarados: null,
    advertencias: null,
    ficha: null,
    fuente: "manual",
    fecha_recuperacion: null,
    habitual: true,
    activo: true,
    created_at: "2026-10-04T12:00:00Z",
    updated_at: "2026-10-04T12:00:00Z",
    alergenos_revisados: true,
    alergenos_revisados_at: "2026-10-01T12:00:00Z",
    alergenos_declarados: [],
    precio_referencia: "1250.00",
    precio_fuente: "jumbo",
    precio_fecha: "2026-11-12T15:00:00Z",
    contenido_cantidad: "1.000",
    contenido_unidad: "L",
    contenido_fuente: "open_food_facts",
    ...overrides,
  };
}

const CON_FICHA_JUMBO = { jumbo: { slug: "leche-colun-1l" } };

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(ingredientService.listIngredients).mockResolvedValue([]);
  vi.mocked(ingredientService.listAlergenosCatalog).mockResolvedValue([]);
  vi.mocked(insumoService.listInsumoAlergenos).mockResolvedValue([]);
});

function abrir(path: string) {
  return renderWithProviders(<App />, { initialEntries: [path] });
}

function conInsumo(i: Insumo) {
  vi.mocked(insumoService.getInsumo).mockResolvedValue(i);
}

// ---------------------------------------------------------------------------------------------

describe("HU14 — detalle del insumo: precio y contenido", () => {
  it("muestra el precio y el contenido con su fuente y fecha", async () => {
    conInsumo(insumo());
    abrir("/insumos/10");

    const seccion = await screen.findByRole("region", { name: "Precio y contenido" });
    expect(within(seccion).getByText("$1.250")).toBeInTheDocument();
    expect(within(seccion).getByText("Jumbo · 12-11-2026")).toBeInTheDocument();
    expect(within(seccion).getByText("1 L")).toBeInTheDocument();
    expect(within(seccion).getByText("Open Food Facts")).toBeInTheDocument();
  });

  it("un precio manual dice «Manual · fecha»; los centavos solo si existen", async () => {
    conInsumo(insumo({ precio_referencia: "990.50", precio_fuente: "manual", precio_fecha: "2026-11-14T09:00:00Z" }));
    abrir("/insumos/10");

    const seccion = await screen.findByRole("region", { name: "Precio y contenido" });
    expect(within(seccion).getByText("$990,50")).toBeInTheDocument();
    expect(within(seccion).getByText("Manual · 14-11-2026")).toBeInTheDocument();
  });

  it("sin precio ni contenido lo dice con texto", async () => {
    conInsumo(
      insumo({
        precio_referencia: null,
        precio_fuente: null,
        precio_fecha: null,
        contenido_cantidad: null,
        contenido_unidad: null,
        contenido_fuente: null,
      }),
    );
    abrir("/insumos/10");

    const seccion = await screen.findByRole("region", { name: "Precio y contenido" });
    expect(within(seccion).getByText("Sin precio")).toBeInTheDocument();
    expect(within(seccion).getByText("Sin contenido")).toBeInTheDocument();
  });

  it("un insumo anterior a HU14 (sin los campos) no rompe la pantalla", async () => {
    const antiguo = insumo();
    for (const campo of [
      "precio_referencia",
      "precio_fuente",
      "precio_fecha",
      "contenido_cantidad",
      "contenido_unidad",
      "contenido_fuente",
    ] as const) {
      delete antiguo[campo];
    }
    conInsumo(antiguo);
    abrir("/insumos/10");

    const seccion = await screen.findByRole("region", { name: "Precio y contenido" });
    expect(within(seccion).getByText("Sin precio")).toBeInTheDocument();
  });
});

describe("HU14 — botón «Actualizar precio desde Jumbo»", () => {
  it("no aparece si la ficha no tiene slug de Jumbo", async () => {
    conInsumo(insumo({ ficha: null }));
    abrir("/insumos/10");

    await screen.findByRole("region", { name: "Precio y contenido" });
    expect(screen.queryByRole("button", { name: /Actualizar precio desde Jumbo/ })).not.toBeInTheDocument();
  });

  it("no aparece en un insumo inactivo", async () => {
    conInsumo(insumo({ ficha: CON_FICHA_JUMBO, activo: false }));
    abrir("/insumos/10");

    await screen.findByRole("region", { name: "Precio y contenido" });
    expect(screen.queryByRole("button", { name: /Actualizar precio desde Jumbo/ })).not.toBeInTheDocument();
  });

  it("con un precio de Jumbo actualiza sin pedir confirmación y muestra el precio nuevo", async () => {
    const user = userEvent.setup();
    conInsumo(insumo({ ficha: CON_FICHA_JUMBO }));
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockResolvedValue(
      insumo({ ficha: CON_FICHA_JUMBO, precio_referencia: "1390.00", precio_fecha: "2026-11-16T10:00:00Z" }),
    );
    abrir("/insumos/10");

    await user.click(await screen.findByRole("button", { name: "Actualizar precio desde Jumbo" }));

    expect(insumoService.actualizarPrecioDesdeJumbo).toHaveBeenCalledWith(10);
    expect(await screen.findByText("$1.390")).toBeInTheDocument();
    expect(screen.getByText("Jumbo · 16-11-2026")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("con un precio manual pide confirmación antes de sobrescribirlo", async () => {
    const user = userEvent.setup();
    const manual = insumo({
      ficha: CON_FICHA_JUMBO,
      precio_fuente: "manual",
      precio_fecha: "2026-11-14T09:00:00Z",
    });
    conInsumo(manual);
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockResolvedValue(
      insumo({ ficha: CON_FICHA_JUMBO, precio_referencia: "1390.00" }),
    );
    abrir("/insumos/10");

    await user.click(await screen.findByRole("button", { name: "Actualizar precio desde Jumbo" }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText(/El precio actual es manual \(Manual · 14-11-2026\)/)).toBeInTheDocument();
    expect(insumoService.actualizarPrecioDesdeJumbo).not.toHaveBeenCalled();

    await user.click(within(dialogo).getByRole("button", { name: "Reemplazar precio" }));

    await waitFor(() => expect(insumoService.actualizarPrecioDesdeJumbo).toHaveBeenCalledWith(10));
    expect(await screen.findByText("$1.390")).toBeInTheDocument();
  });

  it("si el productor conserva su precio manual no se consulta Jumbo", async () => {
    const user = userEvent.setup();
    conInsumo(insumo({ ficha: CON_FICHA_JUMBO, precio_fuente: "manual" }));
    abrir("/insumos/10");

    await user.click(await screen.findByRole("button", { name: "Actualizar precio desde Jumbo" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Conservar mi precio" }));

    expect(insumoService.actualizarPrecioDesdeJumbo).not.toHaveBeenCalled();
    expect(screen.getByText("$1.250")).toBeInTheDocument();
  });

  it("el 409 muestra su mensaje y no cambia la ficha", async () => {
    const user = userEvent.setup();
    conInsumo(insumo({ ficha: CON_FICHA_JUMBO }));
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockRejectedValue(
      new ApiError("Jumbo no informa un precio utilizable para este producto.", 409, {}, {
        mensaje: "Jumbo no informa un precio utilizable para este producto.",
      }),
    );
    abrir("/insumos/10");

    await user.click(await screen.findByRole("button", { name: "Actualizar precio desde Jumbo" }));

    expect(await screen.findByText("Jumbo no informa un precio utilizable para este producto.")).toBeInTheDocument();
    expect(screen.getByText("$1.250")).toBeInTheDocument();
  });

  it("un error de red muestra un mensaje general", async () => {
    const user = userEvent.setup();
    conInsumo(insumo({ ficha: CON_FICHA_JUMBO }));
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockRejectedValue(new ApiError("sin red", 0));
    abrir("/insumos/10");

    await user.click(await screen.findByRole("button", { name: "Actualizar precio desde Jumbo" }));

    expect(await screen.findByText(/No pudimos actualizar el precio desde Jumbo/)).toBeInTheDocument();
  });

  it("avisa que el precio de Jumbo puede ser una oferta", async () => {
    conInsumo(insumo({ ficha: CON_FICHA_JUMBO }));
    abrir("/insumos/10");

    expect(await screen.findByText(/puede corresponder a una oferta/)).toBeInTheDocument();
  });
});

describe("HU14 — formulario de edición: precio y contenido", () => {
  it("carga los valores guardados con su fuente y fecha", async () => {
    conInsumo(insumo());
    abrir("/insumos/10/editar");

    expect(await screen.findByLabelText("Precio de compra")).toHaveValue("1250");
    expect(screen.getByLabelText("Cantidad del contenido")).toHaveValue("1");
    expect(screen.getByLabelText("Unidad del contenido")).toHaveValue("L");
    expect(screen.getByText("Jumbo · 12-11-2026")).toBeInTheDocument();
    expect(screen.getByText("Open Food Facts")).toBeInTheDocument();
    expect(screen.getByText(/la fuente pasa a Manual con la fecha de hoy/)).toBeInTheDocument();
  });

  it("sin cambios no se envía nada", async () => {
    const user = userEvent.setup();
    conInsumo(insumo());
    abrir("/insumos/10/editar");
    await screen.findByLabelText("Precio de compra");

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(insumoService.updateInsumo).not.toHaveBeenCalled();
  });

  it("cambiar solo el precio envía solo precio_referencia, con punto decimal", async () => {
    const user = userEvent.setup();
    conInsumo(insumo());
    vi.mocked(insumoService.updateInsumo).mockResolvedValue(insumo({ precio_referencia: "1390.50" }));
    abrir("/insumos/10/editar");

    const precio = await screen.findByLabelText("Precio de compra");
    await user.clear(precio);
    await user.type(precio, "1390,5");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(insumoService.updateInsumo).toHaveBeenCalledWith(10, { precio_referencia: "1390.5" }),
    );
  });

  it("cambiar el contenido envía el par cantidad y unidad", async () => {
    const user = userEvent.setup();
    conInsumo(insumo());
    vi.mocked(insumoService.updateInsumo).mockResolvedValue(insumo());
    abrir("/insumos/10/editar");

    const cantidad = await screen.findByLabelText("Cantidad del contenido");
    await user.clear(cantidad);
    await user.type(cantidad, "500");
    await user.selectOptions(screen.getByLabelText("Unidad del contenido"), "g");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(insumoService.updateInsumo).toHaveBeenCalledWith(10, {
        contenido_cantidad: "500",
        contenido_unidad: "g",
      }),
    );
  });

  it("vaciar el precio envía null; vaciar el contenido envía el par en null", async () => {
    const user = userEvent.setup();
    conInsumo(insumo());
    vi.mocked(insumoService.updateInsumo).mockResolvedValue(insumo());
    abrir("/insumos/10/editar");

    await user.clear(await screen.findByLabelText("Precio de compra"));
    await user.clear(screen.getByLabelText("Cantidad del contenido"));
    await user.selectOptions(screen.getByLabelText("Unidad del contenido"), "");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(insumoService.updateInsumo).toHaveBeenCalledWith(10, {
        precio_referencia: null,
        contenido_cantidad: null,
        contenido_unidad: null,
      }),
    );
  });

  it.each([
    ["Precio de compra", "-5", /monto en pesos/],
    ["Precio de compra", "12,345", /monto en pesos/],
    ["Cantidad del contenido", "0", /mayor que 0/],
    ["Cantidad del contenido", "1,2345", /hasta 3 decimales/],
  ])("%s = %s se rechaza en el cliente sin llamar a la API", async (campo, valor, mensaje) => {
    const user = userEvent.setup();
    conInsumo(insumo());
    abrir("/insumos/10/editar");

    const input = await screen.findByLabelText(campo);
    await user.clear(input);
    await user.type(input, valor);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(insumoService.updateInsumo).not.toHaveBeenCalled();
  });

  it("una cantidad sin unidad se rechaza: van juntas", async () => {
    const user = userEvent.setup();
    conInsumo(insumo({ contenido_cantidad: null, contenido_unidad: null, contenido_fuente: null }));
    abrir("/insumos/10/editar");

    await user.type(await screen.findByLabelText("Cantidad del contenido"), "500");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Indica la unidad del contenido.")).toBeInTheDocument();
    expect(insumoService.updateInsumo).not.toHaveBeenCalled();
  });

  it("un insumo sin ficha de Jumbo lo dice en el formulario", async () => {
    conInsumo(insumo({ ficha: null }));
    abrir("/insumos/10/editar");

    expect(await screen.findByText(/no viene de una ficha de Jumbo; puedes ingresar el precio a mano/)).toBeInTheDocument();
  });

  it("un 422 de la API se muestra como aviso general", async () => {
    const user = userEvent.setup();
    conInsumo(insumo());
    vi.mocked(insumoService.updateInsumo).mockRejectedValue(new ApiError("Revisa los datos enviados.", 422));
    abrir("/insumos/10/editar");

    const precio = await screen.findByLabelText("Precio de compra");
    await user.clear(precio);
    await user.type(precio, "100");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Revisa los datos enviados.")).toBeInTheDocument();
  });
});

describe("HU14 — «Editar insumo» desde la calculadora (?volver=)", () => {
  const VOLVER = "?volver=%2Fcalculadora%3Fproducto%3D3";

  it("con un destino válido ofrece «Volver a la calculadora»", async () => {
    conInsumo(insumo());
    abrir(`/insumos/10/editar${VOLVER}`);

    const enlace = await screen.findByRole("link", { name: /Volver a la calculadora/ });
    expect(enlace).toHaveAttribute("href", "/calculadora?producto=3");
  });

  it("con un destino que no es la calculadora lo ignora", async () => {
    conInsumo(insumo());
    abrir("/insumos/10/editar?volver=%2Fproductos");

    expect(await screen.findByRole("link", { name: /Volver al insumo/ })).toHaveAttribute("href", "/insumos/10");
    expect(screen.queryByRole("link", { name: /Volver a la calculadora/ })).not.toBeInTheDocument();
  });

  it("un destino externo se ignora", async () => {
    conInsumo(insumo());
    abrir("/insumos/10/editar?volver=https%3A%2F%2Fmalo.test%2Fcalculadora");

    expect(await screen.findByRole("link", { name: /Volver al insumo/ })).toBeInTheDocument();
  });

  it("al guardar vuelve a la calculadora, no al detalle del insumo", async () => {
    const user = userEvent.setup();
    conInsumo(insumo());
    vi.mocked(insumoService.updateInsumo).mockResolvedValue(insumo({ precio_referencia: "1500.00" }));
    abrirConDestino(`/insumos/10/editar${VOLVER}`);

    const precio = await screen.findByLabelText("Precio de compra");
    await user.clear(precio);
    await user.type(precio, "1500");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Destino: /calculadora?producto=3")).toBeInTheDocument();
    expect(insumoService.updateInsumo).toHaveBeenCalledWith(10, { precio_referencia: "1500" });
  });

  it("sin cambios, «Guardar cambios» también vuelve a la calculadora", async () => {
    const user = userEvent.setup();
    conInsumo(insumo());
    abrirConDestino(`/insumos/10/editar${VOLVER}`);

    await screen.findByLabelText("Precio de compra");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Destino: /calculadora?producto=3")).toBeInTheDocument();
    expect(insumoService.updateInsumo).not.toHaveBeenCalled();
  });

  it("sin ?volver= guardar lleva al detalle del insumo, como antes", async () => {
    const user = userEvent.setup();
    conInsumo(insumo());
    vi.mocked(insumoService.updateInsumo).mockResolvedValue(insumo({ precio_referencia: "1500.00" }));
    abrir("/insumos/10/editar");

    const precio = await screen.findByLabelText("Precio de compra");
    await user.clear(precio);
    await user.type(precio, "1500");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("heading", { name: "Leche Colun 1 L", level: 1 })).toBeInTheDocument();
  });
});

/** La pantalla de la calculadora llega en la entrega 2: aquí un destino de prueba muestra a dónde se navegó. */
function abrirConDestino(path: string) {
  function Destino() {
    const location = useLocation();
    return <p>Destino: {location.pathname + location.search}</p>;
  }
  return renderWithProviders(
    <Routes>
      <Route path="/calculadora" element={<Destino />} />
      <Route path="*" element={<App />} />
    </Routes>,
    { initialEntries: [path] },
  );
}
