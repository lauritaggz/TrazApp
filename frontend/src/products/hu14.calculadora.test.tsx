import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setAccessToken } from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import * as costosService from "@/services/costosService";
import * as insumoService from "@/services/insumoService";
import * as productService from "@/services/productService";
import { EMPTY_PRODUCT_COMMERCIAL_FIELDS, mockProductor, renderWithProviders } from "@/test/testUtils";
import { ApiError } from "@/types/auth";
import type { CostosProducto, InsumoCosto, LineaCosto } from "@/types/costos";
import type { Insumo } from "@/types/insumo";
import type { Product } from "@/types/product";

vi.mock("@/services/authService", () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentProductor: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@/services/productService", () => ({
  listProducts: vi.fn(),
  listCategories: vi.fn(),
  getProduct: vi.fn(),
}));

vi.mock("@/services/costosService", () => ({
  obtenerCostos: vi.fn(),
  guardarCostos: vi.fn(),
}));

vi.mock("@/services/insumoService", () => ({
  getInsumo: vi.fn(),
  actualizarPrecioDesdeJumbo: vi.fn(),
}));

// --- datos -------------------------------------------------------------------------------------------

function producto(id: number, nombre: string): Product {
  return {
    id,
    productor_id: 1,
    codigo_interno: null,
    nombre,
    descripcion: null,
    contenido_neto: null,
    unidad_medida: null,
    presentacion: null,
    ...EMPTY_PRODUCT_COMMERCIAL_FIELDS,
    activo: true,
    created_at: "2026-08-23T12:00:00Z",
    tiene_formulacion: true,
  };
}

const PRODUCTOS = [producto(1, "Mermelada de frutilla"), producto(2, "Queso crema")];

function insumo(id: number, nombre: string, extra: Partial<InsumoCosto> = {}): InsumoCosto {
  return {
    id,
    nombre,
    marca_origen: "Marca",
    presentacion: null,
    habitual: false,
    precio_referencia: "1000.00",
    precio_fuente: "jumbo",
    precio_fecha: "2026-11-12T15:00:00Z",
    contenido_cantidad: "1.000",
    contenido_unidad: "kg",
    contenido_fuente: "open_food_facts",
    ...extra,
  };
}

const HARINA = insumo(10, "Harina Selecta 1 kg", { habitual: true, marca_origen: "Selecta" });
const HARINA_B = insumo(11, "Harina Pan 1 kg", { marca_origen: "Pan" });

function linea(id: number, nombre: string, extra: Partial<LineaCosto> = {}): LineaCosto {
  return {
    ingrediente_id: id,
    ingrediente_nombre: nombre,
    orden: id,
    cantidad: "500.000",
    unidad: "g",
    insumo: HARINA,
    origen_insumo: "habitual",
    aviso_insumo: null,
    insumos_disponibles: [HARINA, HARINA_B],
    costo: "500.0000",
    faltantes: [],
    ...extra,
  };
}

function costos(extra: Partial<CostosProducto> = {}): CostosProducto {
  return {
    producto_id: 1,
    producto_nombre: "Mermelada de frutilla",
    tiene_formulacion: true,
    version_id: 7,
    rendimiento: 10,
    lineas: [linea(1, "Harina"), linea(2, "Azúcar", { costo: "250.0000", cantidad: "250.000" })],
    otros_costos: [],
    resumen: {
      completo: true,
      lineas_incompletas: 0,
      total_ingredientes: "750.0000",
      total_otros_costos: "0.0000",
      costo_tanda: "750.0000",
      costo_unidad: "75.0000",
      precio_mas_antiguo: "2026-11-12T15:00:00Z",
    },
    ...extra,
  };
}

/** Un cálculo con una línea sin cantidad: el total no se puede calcular. */
function incompleto(): CostosProducto {
  return costos({
    lineas: [
      linea(1, "Harina"),
      linea(2, "Azúcar", {
        cantidad: null,
        unidad: null,
        insumo: null,
        origen_insumo: null,
        costo: null,
        faltantes: [
          { codigo: "sin_cantidad", mensaje: "Falta la cantidad del ingrediente en la tanda" },
          { codigo: "sin_insumo", mensaje: "Falta elegir un insumo" },
        ],
      }),
    ],
    resumen: {
      completo: false,
      lineas_incompletas: 1,
      total_ingredientes: null,
      total_otros_costos: "0.0000",
      costo_tanda: null,
      costo_unidad: null,
      precio_mas_antiguo: "2026-11-12T15:00:00Z",
    },
  });
}

function Sonda() {
  const ubicacion = useLocation();
  return <output data-testid="ubicacion">{`${ubicacion.pathname}${ubicacion.search}`}</output>;
}

function abrir(ruta = "/calculadora?producto=1") {
  return renderWithProviders(
    <>
      <App />
      <Sonda />
    </>,
    { initialEntries: [ruta] },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken("valid-token");
  vi.mocked(authService.getCurrentProductor).mockResolvedValue(mockProductor);
  vi.mocked(productService.listProducts).mockResolvedValue(PRODUCTOS);
  vi.mocked(productService.listCategories).mockResolvedValue([]);
  vi.mocked(costosService.obtenerCostos).mockResolvedValue(costos());
  // Por defecto ningún insumo viene de una ficha de Jumbo: no hay botón «Actualizar desde Jumbo».
  conFichaDeJumbo([]);
});

/** Los insumos con estos ids tienen ficha con slug de Jumbo; `inactivos` no están activos. */
function conFichaDeJumbo(ids: number[], inactivos: number[] = []) {
  vi.mocked(insumoService.getInsumo).mockImplementation(
    async (id: number) =>
      ({ id, activo: !inactivos.includes(id), ficha: ids.includes(id) ? { jumbo: { slug: `slug-${id}` } } : null }) as Insumo,
  );
}

async function esperarCalculo() {
  return screen.findByRole("heading", { name: "Ingredientes de la formulación vigente", level: 2 });
}

/** El valor de una fila del resumen lateral («Ingredientes», «Costo por tanda»…). */
function valorDe(etiqueta: string): HTMLElement {
  const resumen = screen.getByRole("region", { name: "Resumen del cálculo" });
  return within(within(resumen).getByText(etiqueta).closest("div") as HTMLElement).getByText(/^(\$|Pendiente|—)/);
}

function cantidadDe(nombre: string) {
  return screen.getByLabelText(`Cantidad de ${nombre}`) as HTMLInputElement;
}

// ---------------------------------------------------------------------------------------------

describe("HU14 — calculadora: lectura", () => {
  it("muestra los totales en pesos, el rendimiento y el costo por unidad", async () => {
    abrir();
    await esperarCalculo();

    const resumen = screen.getByRole("region", { name: "Resumen del cálculo" });
    const tanda = within(resumen).getByText("Costo por tanda").closest("div") as HTMLElement;
    expect(within(tanda).getByText("$750")).toBeInTheDocument();
    const unidad = within(resumen).getByText("Costo por unidad").closest("div") as HTMLElement;
    expect(within(unidad).getByText("$75")).toBeInTheDocument();
    expect(screen.getByLabelText("Rendimiento por tanda")).toHaveValue("10");
    expect(costosService.obtenerCostos).toHaveBeenCalledWith(1, {}, expect.anything());
  });

  it("el encabezado trae la etiqueta, el título, el subtítulo y el selector de producto", async () => {
    abrir();
    await esperarCalculo();

    const titulo = screen.getByRole("heading", { name: "Calculadora de costos", level: 1 });
    expect(within(titulo.parentElement as HTMLElement).getByText("Herramientas")).toBeInTheDocument();
    expect(screen.getByText("Estima el costo de producir una tanda y cada unidad.")).toBeInTheDocument();
    expect(screen.getByLabelText("Producto")).toHaveValue("1");
  });

  it("la tarjeta de ingredientes dice «Guardado» y pasa a «Cambios sin guardar» al editar", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    const tarjeta = screen.getByRole("region", { name: "Ingredientes de la formulación vigente" });
    expect(within(tarjeta).getByText("Formulación vigente")).toBeInTheDocument();
    expect(within(tarjeta).getByRole("status")).toHaveTextContent("Guardado");

    await user.type(cantidadDe("Harina"), "1");
    expect(within(tarjeta).getByRole("status")).toHaveTextContent("Cambios sin guardar");
  });

  it("con el cálculo completo la tarjeta verde trae «Calculado»; abajo, el acceso al producto y la nota de privacidad", async () => {
    abrir();
    await esperarCalculo();

    const resumen = screen.getByRole("region", { name: "Resumen del cálculo" });
    expect(within(resumen).getByText("Calculado")).toBeInTheDocument();
    expect(within(resumen).getByRole("link", { name: "Ver detalle del producto" })).toHaveAttribute(
      "href",
      "/productos/1",
    );
    expect(screen.queryByText("No se puede calcular el total")).not.toBeInTheDocument();
    expect(
      screen.getByText("La selección temporal de insumos no se guarda ni altera elaboraciones finalizadas."),
    ).toBeInTheDocument();
    expect(within(resumen).getByText("Cantidad de productos terminados")).toBeInTheDocument();
  });

  it("«Otros costos por tanda» trae su subtítulo y el monto con «$»", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    const tarjeta = screen.getByRole("region", { name: "Otros costos por tanda" });
    expect(within(tarjeta).getByText("Agrega energía, envases u otros costos directos.")).toBeInTheDocument();
    await user.click(within(tarjeta).getByRole("button", { name: "Agregar otro costo" }));
    expect(within(tarjeta).getByLabelText("Nombre del otro costo 1")).toBeInTheDocument();
    expect(within(tarjeta).getByText("$")).toBeInTheDocument();
    expect(within(tarjeta).getByRole("button", { name: "Quitar el otro costo 1" })).toBeInTheDocument();
  });

  it("cada línea muestra su cantidad, su unidad y su costo", async () => {
    abrir();
    await esperarCalculo();

    expect(cantidadDe("Harina")).toHaveValue("500");
    expect(screen.getByLabelText("Unidad de Harina")).toHaveValue("g");
    const fila = document.getElementById("linea-1") as HTMLElement;
    expect(within(fila).getByText("$500")).toBeInTheDocument();
    expect(within(fila).getByText("Insumo habitual")).toBeInTheDocument();
    expect(within(fila).getByText("$1.000 / 1 kg")).toBeInTheDocument();
    expect(within(fila).getByText("Jumbo")).toBeInTheDocument();
    expect(within(fila).getByText("12 nov 2026")).toBeInTheDocument();
  });

  it("sin cálculo completo no muestra ningún total (CA9)", async () => {
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(incompleto());
    abrir();
    await esperarCalculo();

    expect(screen.getByText("No se puede calcular el total")).toBeInTheDocument();
    expect(screen.queryByText("Costo por tanda")).not.toBeInTheDocument();
    expect(screen.queryByText("Costo por unidad")).not.toBeInTheDocument();
    expect(screen.queryByText("Calculado")).not.toBeInTheDocument();
    expect(valorDe("Ingredientes")).toHaveTextContent("Pendiente");
  });

  it("lo que falta se lista con texto en SU línea, todos los faltantes de esa línea (CA9)", async () => {
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(incompleto());
    abrir();
    await esperarCalculo();

    const incompleta = document.getElementById("linea-2") as HTMLElement;
    expect(within(incompleta).getByText("Falta la cantidad del ingrediente en la tanda")).toBeInTheDocument();
    expect(within(incompleta).getByText("Falta elegir un insumo")).toBeInTheDocument();
    expect(within(incompleta).getByText("Pendiente")).toBeInTheDocument();
    const completa = document.getElementById("linea-1") as HTMLElement;
    expect(within(completa).queryByText(/Falta/)).not.toBeInTheDocument();
    expect(within(completa).queryByText("Pendiente")).not.toBeInTheDocument();
  });

  it("el recuadro «No se puede calcular el total» lista «Ingrediente: mensaje» y cada uno enlaza con su línea", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(incompleto());
    abrir();
    await esperarCalculo();

    const enlace = screen.getByRole("link", { name: "Azúcar: Falta la cantidad del ingrediente en la tanda" });
    expect(enlace).toHaveAttribute("href", "#linea-2");
    expect(screen.getByRole("link", { name: "Azúcar: Falta elegir un insumo" })).toHaveAttribute("href", "#linea-2");
    await user.click(enlace);
    expect(document.getElementById("linea-2")).toHaveFocus();
  });

  it("con faltantes en varias líneas, el recuadro los lista todos", async () => {
    const base = incompleto();
    vi.mocked(costosService.obtenerCostos).mockResolvedValue({
      ...base,
      lineas: [
        linea(1, "Harina", {
          costo: null,
          faltantes: [{ codigo: "insumo_sin_precio", mensaje: "El insumo no tiene precio" }],
        }),
        base.lineas[1],
      ],
    });
    abrir();
    await esperarCalculo();

    const recuadro = screen.getByText("No se puede calcular el total").closest("div") as HTMLElement;
    expect(within(recuadro).getAllByRole("listitem")).toHaveLength(3);
    expect(within(recuadro).getByRole("link", { name: "Harina: El insumo no tiene precio" })).toHaveAttribute(
      "href",
      "#linea-1",
    );
  });

  it("el costo de la tanda se ve aunque falte el rendimiento, y dice cómo ver el de la unidad", async () => {
    const base = costos();
    vi.mocked(costosService.obtenerCostos).mockResolvedValue({
      ...base,
      rendimiento: null,
      resumen: { ...base.resumen, costo_unidad: null },
    });
    abrir();
    await esperarCalculo();

    expect(valorDe("Costo por tanda")).toHaveTextContent("$750");
    expect(screen.getByText("Indica el rendimiento para ver el costo por unidad.")).toBeInTheDocument();
    expect(screen.queryByText("Costo por unidad")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Rendimiento por tanda")).toHaveValue("");
  });

  it("dice de dónde sale cada insumo y avisa si el de la última elaboración ya no está activo", async () => {
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(
      costos({
        lineas: [
          linea(1, "Harina", { origen_insumo: "ultima_elaboracion" }),
          linea(2, "Azúcar", { origen_insumo: "elegido" }),
          linea(3, "Sal", { origen_insumo: "habitual", aviso_insumo: "ultimo_inactivo" }),
        ],
      }),
    );
    abrir();
    await esperarCalculo();

    expect(within(document.getElementById("linea-1") as HTMLElement).getByText("Última elaboración")).toBeInTheDocument();
    expect(
      within(document.getElementById("linea-2") as HTMLElement).getByText("Elegido ahora (no se guarda)"),
    ).toBeInTheDocument();
    expect(
      within(document.getElementById("linea-3") as HTMLElement).getByText(
        "El insumo de la última elaboración ya no está activo",
      ),
    ).toBeInTheDocument();
  });

  it("el aviso de estimación explica que no toca elaboraciones y habla de las ofertas de Jumbo", async () => {
    abrir();
    await esperarCalculo();

    expect(screen.getByText("Esta es una estimación con precios vigentes")).toBeInTheDocument();
    const aviso = screen.getByText("Esta es una estimación con precios vigentes").parentElement as HTMLElement;
    expect(aviso).toHaveTextContent("No modifica elaboraciones ni versiones");
    expect(aviso).toHaveTextContent("El precio de Jumbo puede ser una oferta");
  });

  it("el precio más antiguo se muestra como en el diseño y en hora de Chile", async () => {
    const base = costos();
    vi.mocked(costosService.obtenerCostos).mockResolvedValue({
      ...base,
      resumen: { ...base.resumen, precio_mas_antiguo: "2026-11-13T01:30:00Z" },
    });
    abrir();
    await esperarCalculo();

    expect(screen.getByText(/Precio más antiguo considerado/)).toHaveTextContent(
      "Precio más antiguo considerado: 12 nov 2026.",
    );
  });

  it("sin precios no se muestra el precio más antiguo", async () => {
    const base = costos();
    vi.mocked(costosService.obtenerCostos).mockResolvedValue({
      ...base,
      resumen: { ...base.resumen, precio_mas_antiguo: null },
    });
    abrir();
    await esperarCalculo();
    expect(screen.queryByText(/Precio más antiguo considerado/)).not.toBeInTheDocument();
  });

  it("un ingrediente sin insumos disponibles lo dice y ofrece crear uno", async () => {
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(
      costos({
        lineas: [
          linea(1, "Harina", {
            insumo: null,
            origen_insumo: null,
            insumos_disponibles: [],
            costo: null,
            faltantes: [{ codigo: "sin_insumo", mensaje: "Falta elegir un insumo" }],
          }),
        ],
      }),
    );
    abrir();
    await esperarCalculo();

    const fila = document.getElementById("linea-1") as HTMLElement;
    expect(within(fila).getByText(/no tiene insumos disponibles/)).toBeInTheDocument();
    expect(within(fila).getByRole("link", { name: "Crear insumo" })).toHaveAttribute("href", "/insumos/nuevo");
    expect(within(fila).queryByLabelText("Insumo de Harina")).not.toBeInTheDocument();
  });

  it("«Editar insumo» lleva a la edición y vuelve a la calculadora del mismo producto", async () => {
    abrir();
    await esperarCalculo();

    const fila = document.getElementById("linea-1") as HTMLElement;
    expect(within(fila).getByRole("link", { name: /Editar insumo/ })).toHaveAttribute(
      "href",
      "/insumos/10/editar?volver=%2Fcalculadora%3Fproducto%3D1",
    );
  });
});

describe("HU14 — calculadora: estados", () => {
  it("sin productos lo dice y ofrece crear uno", async () => {
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    abrir("/calculadora");

    expect(await screen.findByText("Aún no tienes productos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nuevo producto" })).toHaveAttribute("href", "/productos/nuevo");
    expect(costosService.obtenerCostos).not.toHaveBeenCalled();
  });

  it("sin ?producto= pide elegir uno y no calcula nada", async () => {
    abrir("/calculadora");

    expect(await screen.findByText("Elige un producto para calcular su costo.")).toBeInTheDocument();
    expect(costosService.obtenerCostos).not.toHaveBeenCalled();
  });

  it("un ?producto= que no es un número se trata como si no hubiera producto", async () => {
    abrir("/calculadora?producto=abc");
    expect(await screen.findByText("Elige un producto para calcular su costo.")).toBeInTheDocument();
    expect(costosService.obtenerCostos).not.toHaveBeenCalled();
  });

  it("mientras calcula muestra un indicador de carga", async () => {
    vi.mocked(costosService.obtenerCostos).mockReturnValue(new Promise(() => {}));
    abrir();
    expect(await screen.findByText("Calculando los costos...")).toBeInTheDocument();
  });

  it("un producto sin formulación explica qué hacer y no muestra la calculadora", async () => {
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(
      costos({ tiene_formulacion: false, lineas: [], version_id: null }),
    );
    abrir();

    expect(await screen.findByText("Este producto aún no tiene formulación")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Definir la formulación" })).toHaveAttribute(
      "href",
      "/productos/1#product-detail-formulation",
    );
    expect(screen.queryByLabelText("Rendimiento por tanda")).not.toBeInTheDocument();
  });

  it("un producto que no existe (404) muestra «Producto no encontrado»", async () => {
    vi.mocked(costosService.obtenerCostos).mockRejectedValue(new ApiError("Producto no encontrado", 404));
    abrir("/calculadora?producto=99");

    expect(await screen.findByText("Producto no encontrado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Elegir otro producto" })).toHaveAttribute("href", "/calculadora");
  });

  it("un error de red o del servidor ofrece «Reintentar» y al reintentar calcula", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.obtenerCostos)
      .mockRejectedValueOnce(new ApiError("sin red", 0))
      .mockResolvedValueOnce(costos());
    abrir();

    expect(await screen.findByText(/No pudimos calcular los costos/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await esperarCalculo();
    expect(costosService.obtenerCostos).toHaveBeenCalledTimes(2);
  });

  it("un 500 también ofrece «Reintentar»", async () => {
    vi.mocked(costosService.obtenerCostos).mockRejectedValue(new ApiError("Error interno", 500));
    abrir();
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("no se pueden cargar los productos: avisa y reintenta", async () => {
    const user = userEvent.setup();
    vi.mocked(productService.listProducts).mockRejectedValueOnce(new ApiError("sin red", 0));
    abrir("/calculadora");

    expect(await screen.findByText(/No pudimos cargar tus productos/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Elige un producto para calcular su costo.")).toBeInTheDocument();
  });
});

describe("HU14 — calculadora: edición y guardado", () => {
  it("sin cambios no hay barra de guardado", async () => {
    abrir();
    await esperarCalculo();
    expect(screen.queryByText("Tienes cambios sin guardar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
  });

  it("al editar aparece la barra «Tienes cambios sin guardar» y el resumen avisa que aún no cambió", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Harina"));
    await user.type(cantidadDe("Harina"), "600");

    expect(screen.getByText("Tienes cambios sin guardar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeInTheDocument();
    expect(screen.getByText("Estos valores se recalculan cuando guardas los cambios.")).toBeInTheDocument();
  });

  it("guarda solo la línea que cambió, con punto decimal, y muestra el cálculo nuevo", async () => {
    const user = userEvent.setup();
    const nuevo = costos({
      lineas: [linea(1, "Harina", { cantidad: "600.500", costo: "600.5000" }), linea(2, "Azúcar", { costo: "250.0000" })],
      resumen: { ...costos().resumen, total_ingredientes: "850.5000", costo_tanda: "850.5000", costo_unidad: "85.0500" },
    });
    vi.mocked(costosService.guardarCostos).mockResolvedValue(nuevo);
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Harina"));
    await user.type(cantidadDe("Harina"), "600,5");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(costosService.guardarCostos).toHaveBeenCalledTimes(1));
    expect(costosService.guardarCostos).toHaveBeenCalledWith(
      1,
      { cantidades: [{ ingrediente_id: 1, cantidad: "600.5", unidad: "g" }] },
      {},
    );
    await waitFor(() => expect(valorDe("Costo por tanda")).toHaveTextContent("$851"));
    expect(screen.queryByText("Tienes cambios sin guardar")).not.toBeInTheDocument();
    expect(cantidadDe("Harina")).toHaveValue("600,5");
  });

  it("cambiar el rendimiento envía solo el rendimiento; vaciarlo envía null", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.guardarCostos).mockResolvedValue(costos({ rendimiento: 12 }));
    abrir();
    await esperarCalculo();

    await user.clear(screen.getByLabelText("Rendimiento por tanda"));
    await user.type(screen.getByLabelText("Rendimiento por tanda"), "12");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(costosService.guardarCostos).toHaveBeenCalledWith(1, { rendimiento: 12 }, {}));

    await user.clear(screen.getByLabelText("Rendimiento por tanda"));
    vi.mocked(costosService.guardarCostos).mockResolvedValue(costos({ rendimiento: null }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(costosService.guardarCostos).toHaveBeenLastCalledWith(1, { rendimiento: null }, {}));
  });

  it("agregar un otro costo envía la lista completa", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.guardarCostos).mockResolvedValue(
      costos({ otros_costos: [{ id: 5, nombre: "Frascos", monto: "1500.00", orden: 1 }] }),
    );
    abrir();
    await esperarCalculo();

    await user.click(screen.getByRole("button", { name: "Agregar otro costo" }));
    await user.type(screen.getByLabelText("Nombre del otro costo 1"), "Frascos");
    await user.type(screen.getByLabelText("Monto del otro costo 1"), "1500");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(costosService.guardarCostos).toHaveBeenCalledWith(1, { otros_costos: [{ nombre: "Frascos", monto: "1500" }] }, {}),
    );
    expect(await screen.findByLabelText("Nombre del otro costo 1")).toHaveValue("Frascos");
  });

  it("quitar el último otro costo envía la lista vacía", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(
      costos({ otros_costos: [{ id: 5, nombre: "Frascos", monto: "1500.00", orden: 1 }] }),
    );
    vi.mocked(costosService.guardarCostos).mockResolvedValue(costos());
    abrir();
    await esperarCalculo();

    await user.click(screen.getByRole("button", { name: /Quitar/ }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(costosService.guardarCostos).toHaveBeenCalledWith(1, { otros_costos: [] }, {}));
  });

  it("borrar la cantidad la quita: se envían cantidad y unidad en null", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.guardarCostos).mockResolvedValue(costos());
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Azúcar"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(costosService.guardarCostos).toHaveBeenCalledWith(
        1,
        { cantidades: [{ ingrediente_id: 2, cantidad: null, unidad: null }] },
        {},
      ),
    );
  });

  it("«Descartar» vuelve a lo guardado y quita la barra", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Harina"));
    await user.type(cantidadDe("Harina"), "999");
    await user.click(screen.getByRole("button", { name: "Descartar" }));

    expect(cantidadDe("Harina")).toHaveValue("500");
    expect(screen.queryByText("Tienes cambios sin guardar")).not.toBeInTheDocument();
    expect(costosService.guardarCostos).not.toHaveBeenCalled();
  });

  it.each([
    ["una cantidad en cero", "0", /mayor que 0/],
    ["una cantidad con 4 decimales", "1,2345", /hasta 3 decimales/],
    ["una cantidad negativa", "-5", /mayor que 0/],
    ["una cantidad con letras", "abc", /mayor que 0/],
  ])("%s se rechaza en el cliente sin llamar a la API", async (_nombre, valor, mensaje) => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Harina"));
    await user.type(cantidadDe("Harina"), valor);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(costosService.guardarCostos).not.toHaveBeenCalled();
  });

  it.each([["0"], ["1000001"], ["2,5"], ["abc"]])(
    "el rendimiento «%s» se rechaza en el cliente",
    async (valor) => {
      const user = userEvent.setup();
      abrir();
      await esperarCalculo();

      await user.clear(screen.getByLabelText("Rendimiento por tanda"));
      await user.type(screen.getByLabelText("Rendimiento por tanda"), valor);
      await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

      expect(await screen.findByText("Indica un número entero de 1 a 1.000.000.")).toBeInTheDocument();
      expect(costosService.guardarCostos).not.toHaveBeenCalled();
    },
  );

  it("un otro costo sin nombre, sin monto o con monto inválido se rechaza en el cliente", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    await user.click(screen.getByRole("button", { name: "Agregar otro costo" }));
    await user.type(screen.getByLabelText("Monto del otro costo 1"), "12,345");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Indica el nombre del costo.")).toBeInTheDocument();
    expect(screen.getByText(/hasta 2 decimales/)).toBeInTheDocument();
    expect(costosService.guardarCostos).not.toHaveBeenCalled();
  });

  it("un nombre de más de 100 caracteres se rechaza", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    await user.click(screen.getByRole("button", { name: "Agregar otro costo" }));
    await user.type(screen.getByLabelText("Nombre del otro costo 1"), "x".repeat(101));
    await user.type(screen.getByLabelText("Monto del otro costo 1"), "10");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("El nombre admite hasta 100 caracteres.")).toBeInTheDocument();
    expect(costosService.guardarCostos).not.toHaveBeenCalled();
  });

  it("un 422 con ingrediente_id se muestra junto a su línea", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.guardarCostos).mockRejectedValue(
      new ApiError("El ingrediente no pertenece a la formulación del producto", 422, {}, {
        mensaje: "El ingrediente no pertenece a la formulación del producto",
        ingrediente_id: 2,
      }),
    );
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Azúcar"));
    await user.type(cantidadDe("Azúcar"), "5");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const fila = document.getElementById("linea-2") as HTMLElement;
    expect(await within(fila).findByText("El ingrediente no pertenece a la formulación del producto")).toBeInTheDocument();
    expect(cantidadDe("Azúcar")).toHaveValue("5");
    expect(screen.getByText("Tienes cambios sin guardar")).toBeInTheDocument();
  });

  it("un 422 estándar (sin ingrediente) se muestra como aviso general arriba de la tabla", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.guardarCostos).mockRejectedValue(new ApiError("Revisa los datos enviados.", 422));
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Harina"));
    await user.type(cantidadDe("Harina"), "5");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Revisa los datos enviados.")).toBeInTheDocument();
    expect(cantidadDe("Harina")).toHaveValue("5");
  });

  it("si falla la red al guardar conserva lo escrito y «Reintentar» vuelve a guardar", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.guardarCostos)
      .mockRejectedValueOnce(new ApiError("sin red", 0))
      .mockResolvedValueOnce(costos());
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Harina"));
    await user.type(cantidadDe("Harina"), "5");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(/No pudimos conectar con el servidor/)).toBeInTheDocument();
    expect(cantidadDe("Harina")).toHaveValue("5");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(costosService.guardarCostos).toHaveBeenCalledTimes(2));
  });

  it("si el producto desaparece (404) al guardar muestra «Producto no encontrado»", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.guardarCostos).mockRejectedValue(new ApiError("Producto no encontrado", 404));
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Harina"));
    await user.type(cantidadDe("Harina"), "5");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Producto no encontrado")).toBeInTheDocument();
  });
});

describe("HU14 — calculadora: insumo alternativo", () => {
  it("elegir otro insumo recalcula con ?insumo=<ingrediente>:<insumo> y no toca la URL", async () => {
    const user = userEvent.setup();
    vi.mocked(costosService.obtenerCostos).mockResolvedValueOnce(costos());
    abrir();
    await esperarCalculo();

    vi.mocked(costosService.obtenerCostos).mockResolvedValueOnce(
      costos({
        lineas: [
          linea(1, "Harina", { insumo: HARINA_B, origen_insumo: "elegido", costo: "600.0000" }),
          linea(2, "Azúcar"),
        ],
      }),
    );
    await user.selectOptions(screen.getByLabelText("Insumo de Harina"), "11");

    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenLastCalledWith(1, { 1: 11 }, expect.anything()));
    expect(await screen.findByText("Elegido ahora (no se guarda)")).toBeInTheDocument();
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/calculadora?producto=1");
    expect(screen.getByTestId("ubicacion").textContent).not.toMatch(/insumo/);
    const guardado = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? "");
    expect(guardado.filter((k) => /insumo|calculadora/i.test(`${k}${localStorage.getItem(k)}`))).toEqual([]);
  });

  it("al guardar mantiene el insumo elegido en el cálculo (se manda en la misma consulta)", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();
    vi.mocked(costosService.obtenerCostos).mockResolvedValueOnce(costos());
    await user.selectOptions(screen.getByLabelText("Insumo de Harina"), "11");
    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenCalledTimes(2));

    vi.mocked(costosService.guardarCostos).mockResolvedValue(costos());
    await user.clear(cantidadDe("Azúcar"));
    await user.type(cantidadDe("Azúcar"), "300");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(costosService.guardarCostos).toHaveBeenCalledWith(
        1,
        { cantidades: [{ ingrediente_id: 2, cantidad: "300", unidad: "g" }] },
        { 1: 11 },
      ),
    );
  });

  it("cambiar de insumo no pierde lo que se estaba escribiendo", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Azúcar"));
    await user.type(cantidadDe("Azúcar"), "300");
    vi.mocked(costosService.obtenerCostos).mockResolvedValueOnce(costos());
    await user.selectOptions(screen.getByLabelText("Insumo de Harina"), "11");
    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenCalledTimes(2));

    expect(cantidadDe("Azúcar")).toHaveValue("300");
    expect(screen.getByText("Tienes cambios sin guardar")).toBeInTheDocument();
  });

  it("si falla al recalcular con otro insumo conserva el último cálculo y ofrece reintentar", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    vi.mocked(costosService.obtenerCostos).mockRejectedValueOnce(new ApiError("sin red", 0));
    await user.selectOptions(screen.getByLabelText("Insumo de Harina"), "11");

    expect(await screen.findByText(/No pudimos recalcular los costos/)).toBeInTheDocument();
    expect(screen.getByText("Se muestra el último cálculo.")).toBeInTheDocument();
    expect(valorDe("Costo por tanda")).toHaveTextContent("$750");

    vi.mocked(costosService.obtenerCostos).mockResolvedValueOnce(costos());
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenLastCalledWith(1, { 1: 11 }, expect.anything()));
    await waitFor(() => expect(screen.queryByText(/No pudimos recalcular/)).not.toBeInTheDocument());
  });

  it("al cambiar de producto el insumo alternativo se olvida", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();
    vi.mocked(costosService.obtenerCostos).mockResolvedValueOnce(costos());
    await user.selectOptions(screen.getByLabelText("Insumo de Harina"), "11");
    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenCalledTimes(2));

    vi.mocked(costosService.obtenerCostos).mockResolvedValueOnce(
      costos({ producto_id: 2, producto_nombre: "Queso crema" }),
    );
    await user.selectOptions(screen.getByLabelText("Producto"), "2");

    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenLastCalledWith(2, {}, expect.anything()));
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/calculadora?producto=2");
  });
});

describe("HU14 — calculadora: cambios sin guardar", () => {
  it("cambiar de producto sin cambios no pregunta nada", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    vi.mocked(costosService.obtenerCostos).mockResolvedValueOnce(
      costos({ producto_id: 2, producto_nombre: "Queso crema" }),
    );
    await user.selectOptions(screen.getByLabelText("Producto"), "2");

    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenLastCalledWith(2, {}, expect.anything()));
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/calculadora?producto=2");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("cambiar de producto con cambios pide confirmación; «Seguir editando» conserva todo", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Harina"));
    await user.type(cantidadDe("Harina"), "999");
    await user.selectOptions(screen.getByLabelText("Producto"), "2");

    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByRole("heading", { name: "Salir sin guardar" })).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Seguir editando" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(cantidadDe("Harina")).toHaveValue("999");
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/calculadora?producto=1");
  });

  it("confirmar el cambio de producto descarta lo escrito y carga el otro", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Harina"));
    await user.type(cantidadDe("Harina"), "999");
    await user.selectOptions(screen.getByLabelText("Producto"), "2");
    vi.mocked(costosService.obtenerCostos).mockResolvedValueOnce(
      costos({ producto_id: 2, producto_nombre: "Queso crema" }),
    );
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Salir sin guardar" }));

    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenLastCalledWith(2, {}, expect.anything()));
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/calculadora?producto=2");
    await waitFor(() => expect(screen.queryByText("Tienes cambios sin guardar")).not.toBeInTheDocument());
    expect(costosService.guardarCostos).not.toHaveBeenCalled();
  });

  it("pulsar un enlace del menú con cambios pide confirmación antes de salir", async () => {
    const user = userEvent.setup();
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Harina"));
    await user.type(cantidadDe("Harina"), "999");
    await user.click(within(screen.getByRole("navigation", { name: "Secciones" })).getByRole("link", { name: "Productos" }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/calculadora?producto=1");
  });
});

describe("HU14 — calculadora: «Actualizar desde Jumbo» en la línea (CA13)", () => {
  function fila(id: number): HTMLElement {
    return document.getElementById(`linea-${id}`) as HTMLElement;
  }

  const botonDe = (id: number) => within(fila(id)).queryByRole("button", { name: /Actualizar desde Jumbo/ });

  it("aparece solo si el insumo está activo y su ficha tiene slug de Jumbo", async () => {
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(
      costos({ lineas: [linea(1, "Harina"), linea(2, "Azúcar", { insumo: HARINA_B })] }),
    );
    conFichaDeJumbo([10]);
    abrir();
    await esperarCalculo();

    expect(await within(fila(1)).findByRole("button", { name: /Actualizar desde Jumbo/ })).toBeInTheDocument();
    expect(botonDe(2)).not.toBeInTheDocument();
  });

  it("no aparece si el insumo está inactivo, ni si no se puede consultar su ficha", async () => {
    conFichaDeJumbo([10], [10]);
    abrir();
    await esperarCalculo();
    await waitFor(() => expect(insumoService.getInsumo).toHaveBeenCalled());
    expect(botonDe(1)).not.toBeInTheDocument();
  });

  it("si falla la consulta de la ficha, el botón no se ofrece", async () => {
    vi.mocked(insumoService.getInsumo).mockRejectedValue(new ApiError("sin red", 0));
    abrir();
    await esperarCalculo();
    await waitFor(() => expect(insumoService.getInsumo).toHaveBeenCalled());
    expect(botonDe(1)).not.toBeInTheDocument();
  });

  it("con un precio de Jumbo actualiza sin confirmar, queda «Actualizando…» y luego recalcula", async () => {
    const user = userEvent.setup();
    conFichaDeJumbo([10]);
    let terminar: (v: Insumo) => void = () => {};
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockReturnValue(
      new Promise<Insumo>((resolver) => {
        terminar = resolver;
      }),
    );
    abrir();
    await esperarCalculo();

    await user.click(await within(fila(1)).findByRole("button", { name: /Actualizar desde Jumbo/ }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(insumoService.actualizarPrecioDesdeJumbo).toHaveBeenCalledTimes(1);
    expect(insumoService.actualizarPrecioDesdeJumbo).toHaveBeenCalledWith(10);
    expect(within(fila(1)).getByRole("button", { name: /Actualizando…/ })).toBeDisabled();
    expect(costosService.obtenerCostos).toHaveBeenCalledTimes(1);

    vi.mocked(costosService.obtenerCostos).mockResolvedValueOnce(
      costos({ lineas: [linea(1, "Harina", { costo: "900.0000" }), linea(2, "Azúcar")] }),
    );
    terminar({} as Insumo);

    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenCalledTimes(2));
    expect(await within(fila(1)).findByText("$900")).toBeInTheDocument();
    expect(await within(fila(1)).findByRole("button", { name: /Actualizar desde Jumbo/ })).toBeEnabled();
  });

  it("cada clic hace una sola consulta, solo del insumo de esa línea", async () => {
    const user = userEvent.setup();
    conFichaDeJumbo([10]);
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockResolvedValue({} as Insumo);
    abrir();
    await esperarCalculo();

    await user.click(await within(fila(2)).findByRole("button", { name: /Actualizar desde Jumbo/ }));
    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenCalledTimes(2));

    expect(insumoService.actualizarPrecioDesdeJumbo).toHaveBeenCalledTimes(1);
  });

  it("si el precio actual es manual pide confirmación; «Conservar mi precio» no consulta Jumbo", async () => {
    const user = userEvent.setup();
    conFichaDeJumbo([10]);
    const manual = insumo(10, "Harina Selecta 1 kg", { precio_fuente: "manual", precio_fecha: "2026-11-14T09:00:00Z" });
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(
      costos({ lineas: [linea(1, "Harina", { insumo: manual })] }),
    );
    abrir();
    await esperarCalculo();

    await user.click(await within(fila(1)).findByRole("button", { name: /Actualizar desde Jumbo/ }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText(/El precio actual es manual \(Manual · 14-11-2026\)/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Conservar mi precio" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(insumoService.actualizarPrecioDesdeJumbo).not.toHaveBeenCalled();
    expect(costosService.obtenerCostos).toHaveBeenCalledTimes(1);
  });

  it("con precio manual, «Reemplazar precio» actualiza y recalcula", async () => {
    const user = userEvent.setup();
    conFichaDeJumbo([10]);
    const manual = insumo(10, "Harina Selecta 1 kg", { precio_fuente: "manual", precio_fecha: "2026-11-14T09:00:00Z" });
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(
      costos({ lineas: [linea(1, "Harina", { insumo: manual })] }),
    );
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockResolvedValue({} as Insumo);
    abrir();
    await esperarCalculo();

    await user.click(await within(fila(1)).findByRole("button", { name: /Actualizar desde Jumbo/ }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Reemplazar precio" }));

    await waitFor(() => expect(insumoService.actualizarPrecioDesdeJumbo).toHaveBeenCalledWith(10));
    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenCalledTimes(2));
  });

  it("recalcula conservando el insumo alternativo elegido", async () => {
    const user = userEvent.setup();
    conFichaDeJumbo([10, 11]);
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockResolvedValue({} as Insumo);
    abrir();
    await esperarCalculo();

    const conAlternativo = costos({
      lineas: [linea(1, "Harina", { insumo: HARINA_B, origen_insumo: "elegido" }), linea(2, "Azúcar")],
    });
    vi.mocked(costosService.obtenerCostos).mockResolvedValue(conAlternativo);
    await user.selectOptions(screen.getByLabelText("Insumo de Harina"), "11");
    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenCalledTimes(2));

    await user.click(await within(fila(1)).findByRole("button", { name: /Actualizar desde Jumbo/ }));

    // Se actualiza el insumo que se ve (el alternativo, 11) y el GET lleva la misma elección.
    await waitFor(() => expect(insumoService.actualizarPrecioDesdeJumbo).toHaveBeenCalledWith(11));
    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenCalledTimes(3));
    expect(costosService.obtenerCostos).toHaveBeenLastCalledWith(1, { 1: 11 }, expect.anything());
  });

  it("un 409 se muestra junto a la línea y no cambia nada ni recalcula", async () => {
    const user = userEvent.setup();
    conFichaDeJumbo([10]);
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockRejectedValue(
      new ApiError("Jumbo no informa un precio para este producto", 409, {}, {
        mensaje: "Jumbo no informa un precio para este producto",
      }),
    );
    abrir();
    await esperarCalculo();

    await user.click(await within(fila(1)).findByRole("button", { name: /Actualizar desde Jumbo/ }));

    expect(await within(fila(1)).findByText("Jumbo no informa un precio para este producto")).toBeInTheDocument();
    expect(within(fila(2)).queryByText("Jumbo no informa un precio para este producto")).not.toBeInTheDocument();
    expect(costosService.obtenerCostos).toHaveBeenCalledTimes(1);
    expect(within(fila(1)).getByRole("button", { name: /Actualizar desde Jumbo/ })).toBeEnabled();
  });

  it("un error de red lo dice en la línea y permite volver a intentar", async () => {
    const user = userEvent.setup();
    conFichaDeJumbo([10]);
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockRejectedValue(new ApiError("sin red", 0));
    abrir();
    await esperarCalculo();

    await user.click(await within(fila(1)).findByRole("button", { name: /Actualizar desde Jumbo/ }));
    expect(await within(fila(1)).findByText(/No pudimos actualizar el precio desde Jumbo/)).toBeInTheDocument();
    expect(costosService.obtenerCostos).toHaveBeenCalledTimes(1);
  });

  it("los cambios sin guardar no se pierden: solo se recalcula el resultado", async () => {
    const user = userEvent.setup();
    conFichaDeJumbo([10]);
    vi.mocked(insumoService.actualizarPrecioDesdeJumbo).mockResolvedValue({} as Insumo);
    abrir();
    await esperarCalculo();

    await user.clear(cantidadDe("Azúcar"));
    await user.type(cantidadDe("Azúcar"), "300");
    await user.click(screen.getByRole("button", { name: "Agregar otro costo" }));
    await user.type(screen.getByLabelText("Nombre del otro costo 1"), "Frascos");

    await user.click(await within(fila(1)).findByRole("button", { name: /Actualizar desde Jumbo/ }));
    await waitFor(() => expect(costosService.obtenerCostos).toHaveBeenCalledTimes(2));

    expect(cantidadDe("Azúcar")).toHaveValue("300");
    expect(screen.getByLabelText("Nombre del otro costo 1")).toHaveValue("Frascos");
    expect(screen.getByText("Tienes cambios sin guardar")).toBeInTheDocument();
    expect(costosService.guardarCostos).not.toHaveBeenCalled();
  });
});
