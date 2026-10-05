import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/apiClient";
import {
  digitoVerificadorValido,
  MENSAJE_CODIGO_DIGITO_VERIFICADOR,
  MENSAJE_CODIGO_FORMATO,
  normalizarCodigoBarras,
  validarCodigoBarras,
} from "@/lib/codigoBarras";
import {
  buildUpdatePayload,
  isInsumoFormDirty,
  isInsumoFormDirtyComparedTo,
  toCreatePayload,
  validateInsumoForm,
} from "@/lib/insumoFormValidation";
import {
  filterInsumos,
  formatFechaHora,
  groupDeclarados,
  ingredienteFilterOptions,
  insumoCountLabel,
} from "@/lib/insumoUtils";
import { ApiError } from "@/types/auth";
import {
  DEFAULT_INSUMO_LIST_FILTERS,
  EMPTY_INSUMO_FORM_VALUES,
  type AlergenoDeclarado,
  type Insumo,
  type InsumoFormValues,
} from "@/types/insumo";

const EAN_13 = "7802910000971";
const UPC_A = "036000291452";
const EAN_8 = "96385074";

function formValues(overrides: Partial<InsumoFormValues> = {}): InsumoFormValues {
  return {
    ...EMPTY_INSUMO_FORM_VALUES,
    nombre: "Leche Colun 1 L",
    marca_origen: "Colun",
    ingrediente_id: "1",
    ...overrides,
  };
}

function insumo(overrides: Partial<Insumo> = {}): Insumo {
  return {
    id: 1,
    productor_id: 1,
    ingrediente_id: 1,
    ingrediente: { id: 1, nombre: "Leche" },
    nombre: "Leche Colun 1 L",
    marca_origen: "Colun",
    presentacion: null,
    codigo_barras: EAN_13,
    ingredientes_declarados: null,
    advertencias: null,
    ficha: null,
    fuente: "manual",
    fecha_recuperacion: null,
    habitual: false,
    activo: true,
    created_at: "2026-10-04T12:00:00Z",
    updated_at: "2026-10-04T12:00:00Z",
    alergenos_declarados: [],
    ...overrides,
  };
}

describe("código de barras", () => {
  it("normaliza quitando todos los espacios y la cadena vacía es nula", () => {
    expect(normalizarCodigoBarras(" 780 291 0000971 ")).toBe(EAN_13);
    expect(normalizarCodigoBarras("\t7802910000971\n")).toBe(EAN_13);
    expect(normalizarCodigoBarras("   ")).toBeNull();
    expect(normalizarCodigoBarras("")).toBeNull();
  });

  it.each([EAN_13, UPC_A, EAN_8, " 780 291 0000971 ", ""])("acepta %j", (codigo) => {
    expect(validarCodigoBarras(codigo)).toBeNull();
  });

  it("rechaza un dígito verificador incorrecto con el mismo mensaje que el backend", () => {
    expect(validarCodigoBarras("7802910000972")).toBe(MENSAJE_CODIGO_DIGITO_VERIFICADOR);
    expect(digitoVerificadorValido(EAN_13)).toBe(true);
    expect(digitoVerificadorValido("7802910000972")).toBe(false);
  });

  it.each(["1234567", "123456789", "12345678901", "12345678901234", "78029100009AB", "7802-9100"])(
    "rechaza %j por formato",
    (codigo) => {
      expect(validarCodigoBarras(codigo)).toBe(MENSAJE_CODIGO_FORMATO);
    },
  );
});

describe("validación y cargas útiles del formulario de insumos", () => {
  it("exige nombre, marca u origen e ingrediente", () => {
    const errors = validateInsumoForm(EMPTY_INSUMO_FORM_VALUES);

    expect(Object.keys(errors).sort()).toEqual(["ingrediente_id", "marca_origen", "nombre"]);
  });

  it("informa el código de barras inválido en su campo", () => {
    const errors = validateInsumoForm(formValues({ codigo_barras: "7802910000972" }));

    expect(errors).toEqual({ codigo_barras: MENSAJE_CODIGO_DIGITO_VERIFICADOR });
  });

  it("no marca errores en un formulario válido", () => {
    expect(validateInsumoForm(formValues({ codigo_barras: " 780 291 0000971 " }))).toEqual({});
  });

  it("arma la carga de creación con textos recortados, código normalizado y vacíos nulos", () => {
    const payload = toCreatePayload(
      formValues({
        nombre: "  Leche  ",
        presentacion: "   ",
        codigo_barras: " 780 291 0000971 ",
        advertencias: " Contiene leche ",
        habitual: true,
      }),
    );

    expect(payload).toEqual({
      ingrediente_id: 1,
      nombre: "Leche",
      marca_origen: "Colun",
      presentacion: null,
      codigo_barras: EAN_13,
      ingredientes_declarados: null,
      advertencias: "Contiene leche",
      habitual: true,
    });
  });

  it("permite agregar campos de una fuente externa a la carga (HU13)", () => {
    const payload = toCreatePayload(formValues(), {
      fuente: "open_food_facts",
      ficha: { product_name: "Leche" },
      fecha_recuperacion: "2026-10-04T15:30:00Z",
    });

    expect(payload.fuente).toBe("open_food_facts");
    expect(payload.ficha).toEqual({ product_name: "Leche" });
    expect(payload.fecha_recuperacion).toBe("2026-10-04T15:30:00Z");
    expect(payload.nombre).toBe("Leche Colun 1 L");
  });

  it("al editar envía solo lo que cambió", () => {
    const base = formValues({ presentacion: "1 L", codigo_barras: EAN_13 });

    expect(buildUpdatePayload(base, base)).toEqual({});
    expect(
      buildUpdatePayload(base, { ...base, nombre: "Leche entera", habitual: true }),
    ).toEqual({ nombre: "Leche entera", habitual: true });
  });

  it("al editar, borrar un campo opcional lo envía como null", () => {
    const base = formValues({ presentacion: "1 L", codigo_barras: EAN_13 });

    expect(buildUpdatePayload(base, { ...base, presentacion: "  ", codigo_barras: "" })).toEqual({
      presentacion: null,
      codigo_barras: null,
    });
  });

  it("un código con otro formato de espacios no cuenta como cambio", () => {
    const base = formValues({ codigo_barras: EAN_13 });

    expect(buildUpdatePayload(base, { ...base, codigo_barras: "780 291 0000971" })).toEqual({});
  });

  it("detecta formularios con cambios", () => {
    expect(isInsumoFormDirty(EMPTY_INSUMO_FORM_VALUES)).toBe(false);
    expect(isInsumoFormDirty({ ...EMPTY_INSUMO_FORM_VALUES, habitual: true })).toBe(true);
    expect(isInsumoFormDirtyComparedTo(formValues(), formValues())).toBe(false);
    expect(isInsumoFormDirtyComparedTo(formValues({ nombre: "Otro" }), formValues())).toBe(true);
  });
});

describe("utilidades del listado", () => {
  const leche = insumo({ id: 1, nombre: "Leche Colun 1 L", marca_origen: "Colun" });
  const chocolate = insumo({
    id: 2,
    ingrediente_id: 2,
    ingrediente: { id: 2, nombre: "Chocolate" },
    nombre: "Chocolate Ambrosoli",
    marca_origen: "Ambrosoli",
    codigo_barras: null,
  });

  it("filtra por ingrediente y busca por nombre, marca o código", () => {
    const todos = [leche, chocolate];

    expect(filterInsumos(todos, DEFAULT_INSUMO_LIST_FILTERS)).toHaveLength(2);
    expect(filterInsumos(todos, { ...DEFAULT_INSUMO_LIST_FILTERS, ingredienteId: "2" })).toEqual([
      chocolate,
    ]);
    expect(filterInsumos(todos, { ...DEFAULT_INSUMO_LIST_FILTERS, search: "ambro" })).toEqual([
      chocolate,
    ]);
    expect(filterInsumos(todos, { ...DEFAULT_INSUMO_LIST_FILTERS, search: "78029" })).toEqual([
      leche,
    ]);
    expect(filterInsumos(todos, { ...DEFAULT_INSUMO_LIST_FILTERS, search: "zzz" })).toEqual([]);
  });

  it("arma las opciones del filtro de ingrediente sin repetidos y por nombre", () => {
    const otraLeche = insumo({ id: 3 });

    expect(ingredienteFilterOptions([leche, chocolate, otraLeche])).toEqual([
      { id: 2, nombre: "Chocolate" },
      { id: 1, nombre: "Leche" },
    ]);
  });

  it("separa los alérgenos declarados por tipo", () => {
    const declarados: AlergenoDeclarado[] = [
      { alergeno_id: 1, codigo: "lacteos", nombre: "Leche", obligatorio_chile: true, tipo: "contiene" },
      { alergeno_id: 2, codigo: "sesamo", nombre: "Sésamo", obligatorio_chile: false, tipo: "trazas" },
    ];

    const grupos = groupDeclarados(declarados);

    expect(grupos.contiene.map((a) => a.codigo)).toEqual(["lacteos"]);
    expect(grupos.trazas.map((a) => a.codigo)).toEqual(["sesamo"]);
  });

  it("formatea el conteo y la fecha en hora de Chile con 24 horas", () => {
    expect(insumoCountLabel(1, true)).toBe("1 insumo registrado");
    expect(insumoCountLabel(3, true)).toBe("3 insumos registrados");
    expect(insumoCountLabel(2, false)).toBe("2 insumos inactivos registrados");
    expect(formatFechaHora("2026-10-04T18:30:00Z")).toMatch(/15:30/);
    expect(formatFechaHora(null)).toBe("—");
  });
});

describe("apiClient: errores de insumos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function respond(status: number, body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: () => Promise.resolve(body),
      }),
    );
  }

  async function failure(): Promise<ApiError> {
    try {
      await apiRequest("/gestion/insumos", { method: "POST", body: "{}" }, false);
    } catch (error) {
      return error as ApiError;
    }
    throw new Error("Se esperaba un error");
  }

  it("409 con detail objeto: usa detail.mensaje y conserva el detalle", async () => {
    respond(409, {
      detail: { mensaje: "Ya existe un insumo con ese código de barras.", insumo_id: 7, activo: true },
    });

    const error = await failure();

    expect(error.status).toBe(409);
    expect(error.message).toBe("Ya existe un insumo con ese código de barras.");
    expect(error.detail).toEqual({
      mensaje: "Ya existe un insumo con ese código de barras.",
      insumo_id: 7,
      activo: true,
    });
  });

  it("409 con detail texto sigue funcionando como antes", async () => {
    respond(409, { detail: "Ya existe un ingrediente con ese código interno." });

    const error = await failure();

    expect(error.message).toBe("Ya existe un ingrediente con ese código interno.");
    expect(error.detail).toBeUndefined();
  });

  it("409 con objeto sin mensaje o sin detalle usa el mensaje genérico", async () => {
    respond(409, { detail: { insumo_id: 7 } });
    expect((await failure()).message).toBe("El recurso ya existe");

    respond(409, {});
    expect((await failure()).message).toBe("El recurso ya existe");
  });

  it("422 de código de barras muestra el mensaje específico del backend, sin el prefijo técnico", async () => {
    respond(422, {
      detail: [
        {
          loc: ["body", "codigo_barras"],
          msg: "Value error, El dígito verificador del código de barras no es válido.",
        },
        { loc: ["body", "nombre"], msg: "Field required" },
      ],
    });

    const error = await failure();

    expect(error.status).toBe(422);
    expect(error.fieldErrors.codigo_barras).toBe(
      "El dígito verificador del código de barras no es válido.",
    );
    expect(error.fieldErrors.nombre).toBe("Revisa el nombre.");
  });

  it("422 de los demás campos sigue usando los mensajes amigables", async () => {
    respond(422, {
      detail: [
        { loc: ["body", "marca_origen"], msg: "String should have at least 1 character" },
        { loc: ["body", "ingrediente_id"], msg: "Input should be greater than 0" },
        { loc: ["body", "campo_desconocido"], msg: "Extra inputs are not permitted" },
      ],
    });

    const error = await failure();

    expect(error.fieldErrors).toEqual({
      marca_origen: "Revisa la marca u origen.",
      ingrediente_id: "Revisa el ingrediente seleccionado.",
      campo_desconocido: "Revisa este campo.",
    });
  });

  it("422 con detail texto conserva el mensaje (p. ej. Ingrediente no válido)", async () => {
    respond(422, { detail: "Ingrediente no válido" });

    const error = await failure();

    expect(error.message).toBe("Ingrediente no válido");
    expect(error.fieldErrors).toEqual({});
  });

  it("otros errores no cambian", async () => {
    respond(500, { detail: { mensaje: "no debe verse" } });

    const error = await failure();

    expect(error.status).toBe(500);
    expect(error.message).toBe("No se pudo completar la operación. Intenta de nuevo más tarde.");
    expect(error.detail).toBeUndefined();
  });
});
