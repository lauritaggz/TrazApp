/**
 * The state machine of the lookup, without any screen (T13-05 / HU13): the hook alone.
 * The screens block the second search with a disabled button; the hook must block it by itself.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBusquedaCodigoBarras } from "@/hooks/useBusquedaCodigoBarras";
import * as insumoService from "@/services/insumoService";
import { ApiError } from "@/types/auth";
import type { ConsultaCodigo } from "@/types/consultaCodigo";

vi.mock("@/services/insumoService", () => ({
  consultarCodigoBarras: vi.fn(),
}));

const CODIGO = "7802910000971";
const OTRO = "4006381333931";

const ENCONTRADO: ConsultaCodigo = {
  codigo_barras: CODIGO,
  encontrado: true,
  fuente: "open_food_facts",
  fecha_recuperacion: "2026-10-19T15:00:00Z",
  producto: { nombre: "Leche", marca_origen: "Colun", presentacion: null, ingredientes_declarados: null },
  alergenos: { contiene: [], trazas: [], sin_reconocer: [] },
  ficha: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function pendiente() {
  let resolver: (consulta: ConsultaCodigo) => void = () => {};
  let rechazar: (error: unknown) => void = () => {};
  vi.mocked(insumoService.consultarCodigoBarras).mockImplementation(
    () =>
      new Promise<ConsultaCodigo>((resolve, reject) => {
        resolver = resolve;
        rechazar = reject;
      }),
  );
  return { resolver: (c: ConsultaCodigo) => resolver(c), rechazar: (e: unknown) => rechazar(e) };
}

describe("Máquina de estados de la búsqueda", () => {
  it("empieza inactivo, abre el escáner (escaneando) y lo cierra", () => {
    const { result } = renderHook(() => useBusquedaCodigoBarras());
    expect(result.current.estado).toBe("inactivo");

    act(() => result.current.abrirEscaner());
    expect(result.current.estado).toBe("escaneando");

    act(() => result.current.cerrarEscaner());
    expect(result.current.estado).toBe("inactivo");
  });

  it("al recibir un código cierra el escáner y pasa a buscando", async () => {
    pendiente();
    const { result } = renderHook(() => useBusquedaCodigoBarras());
    act(() => result.current.abrirEscaner());

    act(() => void result.current.buscar(CODIGO));

    expect(result.current.estado).toBe("buscando");
    expect(result.current.escanerAbierto).toBe(false);
    expect(result.current.codigo).toBe(CODIGO);
  });

  it("mientras busca no acepta otro código: la segunda búsqueda se ignora", async () => {
    const { resolver } = pendiente();
    const { result } = renderHook(() => useBusquedaCodigoBarras());
    act(() => void result.current.buscar(CODIGO));

    act(() => void result.current.buscar(OTRO));

    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledTimes(1);
    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledWith(CODIGO);
    expect(result.current.codigo).toBe(CODIGO);
    await act(async () => resolver(ENCONTRADO));
  });

  it("mientras busca no se abre el escáner", async () => {
    const { resolver } = pendiente();
    const { result } = renderHook(() => useBusquedaCodigoBarras());
    act(() => void result.current.buscar(CODIGO));

    act(() => result.current.abrirEscaner());

    expect(result.current.estado).toBe("buscando");
    expect(result.current.escanerAbierto).toBe(false);
    await act(async () => resolver(ENCONTRADO));
  });

  it("al terminar vuelve a aceptar otro código", async () => {
    const onResultado = vi.fn();
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(ENCONTRADO);
    const { result } = renderHook(() => useBusquedaCodigoBarras({ onResultado }));

    await act(async () => result.current.buscar(CODIGO));
    expect(result.current.estado).toBe("encontrado");
    await act(async () => result.current.buscar(OTRO));

    expect(insumoService.consultarCodigoBarras).toHaveBeenCalledTimes(2);
    expect(onResultado).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["encontrado", () => vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(ENCONTRADO), "encontrado"],
    [
      "no encontrado",
      () => vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue({ ...ENCONTRADO, encontrado: false, producto: null }),
      "no_encontrado",
    ],
    ["503", () => vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(new ApiError("x", 503)), "no_disponible"],
    ["sin red", () => vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(new TypeError("red")), "no_disponible"],
    [
      "409",
      () =>
        vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(
          new ApiError("Ya existe", 409, {}, { mensaje: "Ya existe", insumo_id: 10, activo: false }),
        ),
      "duplicado",
    ],
    ["422", () => vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(new ApiError("Código mal", 422)), "invalido"],
  ])("%s lleva al estado %s", async (_caso, preparar, esperado) => {
    preparar();
    const { result } = renderHook(() => useBusquedaCodigoBarras());

    await act(async () => result.current.buscar(CODIGO));

    expect(result.current.estado).toBe(esperado);
  });

  it("un 409 entrega el insumo que ya existe, con su estado", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(
      new ApiError("Ya existe", 409, {}, { mensaje: "Ya existe", insumo_id: 10, activo: false }),
    );
    const onResultado = vi.fn();
    const { result } = renderHook(() => useBusquedaCodigoBarras({ onResultado }));

    await act(async () => result.current.buscar(CODIGO));

    expect(result.current.duplicado).toEqual({ insumoId: 10, activo: false, mensaje: "Ya existe" });
    // A duplicate is not a result for the form: nothing is loaded.
    expect(onResultado).not.toHaveBeenCalled();
  });

  it("un 409 que no trae el insumo existente es un error de la búsqueda, no una fuente caída", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValue(new ApiError("Conflicto", 409));
    const onResultado = vi.fn();
    const { result } = renderHook(() => useBusquedaCodigoBarras({ onResultado }));

    await act(async () => result.current.buscar(CODIGO));

    expect(result.current.estado).toBe("error");
    expect(result.current.duplicado).toBeNull();
    // Nothing is loaded into the form: the productor decides what to do.
    expect(onResultado).not.toHaveBeenCalled();
  });

  it("después de un error de la búsqueda se acepta otro código", async () => {
    vi.mocked(insumoService.consultarCodigoBarras).mockRejectedValueOnce(new ApiError("Conflicto", 409));
    const { result } = renderHook(() => useBusquedaCodigoBarras());
    await act(async () => result.current.buscar(CODIGO));
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(ENCONTRADO);

    await act(async () => result.current.buscar(OTRO));

    expect(result.current.estado).toBe("encontrado");
  });

  it("un código inválido no se consulta", async () => {
    const { result } = renderHook(() => useBusquedaCodigoBarras());

    await act(async () => result.current.buscar("7802910000972"));

    expect(result.current.estado).toBe("invalido");
    expect(insumoService.consultarCodigoBarras).not.toHaveBeenCalled();
  });

  it("limpiar vuelve al principio y descarta la respuesta que llega después", async () => {
    const { resolver } = pendiente();
    const onResultado = vi.fn();
    const { result } = renderHook(() => useBusquedaCodigoBarras({ onResultado }));
    act(() => void result.current.buscar(CODIGO));

    act(() => result.current.limpiar());
    await act(async () => resolver(ENCONTRADO));

    expect(result.current.estado).toBe("inactivo");
    expect(onResultado).not.toHaveBeenCalled();
    // And a new search is accepted right away.
    vi.mocked(insumoService.consultarCodigoBarras).mockResolvedValue(ENCONTRADO);
    await act(async () => result.current.buscar(OTRO));
    expect(result.current.estado).toBe("encontrado");
  });

  it("una respuesta que llega después de desmontar no hace nada", async () => {
    const { resolver } = pendiente();
    const onResultado = vi.fn();
    const { result, unmount } = renderHook(() => useBusquedaCodigoBarras({ onResultado }));
    act(() => void result.current.buscar(CODIGO));

    unmount();
    await act(async () => resolver(ENCONTRADO));

    expect(onResultado).not.toHaveBeenCalled();
  });
});
