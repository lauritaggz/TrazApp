"""HU14 / T14-04: the pure arithmetic of the cost calculator. No database, no float."""

import ast
import inspect
from decimal import Decimal

import pytest

from app.core import costos_calculo
from app.core.costos_calculo import (
    UnidadesIncompatiblesError,
    costo_linea,
    dividir,
    redondear_pesos,
    son_compatibles,
    sumar,
)

D = Decimal


# --- PT14-08: the three mandatory examples ------------------------------------------------------


@pytest.mark.parametrize(
    ("cantidad", "unidad", "precio", "contenido", "unidad_contenido", "esperado"),
    [
        ("250", "g", "1000", "1", "kg", "250"),
        ("200", "ml", "1100", "1", "L", "220"),
        ("3", "unidad", "3000", "12", "unidad", "750"),
    ],
)
def test_los_tres_ejemplos_obligatorios_dan_el_decimal_exacto(
    cantidad: str, unidad: str, precio: str, contenido: str, unidad_contenido: str, esperado: str
) -> None:
    resultado = costo_linea(D(cantidad), unidad, D(precio), D(contenido), unidad_contenido)

    assert isinstance(resultado, Decimal)
    assert resultado == D(esperado)
    assert resultado == D(esperado).quantize(D("0.0001"))


@pytest.mark.parametrize(
    ("cantidad", "unidad", "contenido", "unidad_contenido", "esperado"),
    [
        ("1", "kg", "1000", "g", "1000"),  # a kilo in a 1000 g pack costs the whole pack
        ("1", "L", "500", "ml", "2000"),
        ("500", "g", "2", "kg", "250"),
        ("2", "unidad", "1", "unidad", "2000"),
    ],
)
def test_convierte_dentro_de_la_misma_magnitud_en_los_dos_sentidos(
    cantidad: str, unidad: str, contenido: str, unidad_contenido: str, esperado: str
) -> None:
    assert costo_linea(D(cantidad), unidad, D("1000"), D(contenido), unidad_contenido) == D(esperado)


# --- precision: cases where float gives a different answer ---------------------------------------


def test_un_tercio_de_un_peso_no_se_pierde_ni_se_inventa() -> None:
    assert costo_linea(D(1), "unidad", D(100), D(3), "unidad") == D("33.3333")
    assert costo_linea(D(2), "unidad", D(100), D(3), "unidad") == D("66.6667")


def test_el_medio_exacto_sube_con_half_up_donde_float_lo_hace_bajar() -> None:
    # 0.03 / 8 = 0.00375 exactly: half up gives 0.0038. A binary float 0.03 is slightly below 0.03 and gives 0.0037.
    assert costo_linea(D(1), "unidad", D("0.03"), D(8), "unidad") == D("0.0038")
    assert costo_linea(D(1), "unidad", D("0.09"), D(8), "unidad") == D("0.0113")


def test_multiplica_antes_de_dividir() -> None:
    # (7 x 1 x 100) / (3 x 1) = 233.3333. Dividing first (7 / 3 = 2.3333) and rounding there would lose cents.
    assert costo_linea(D(7), "unidad", D(100), D(3), "unidad") == D("233.3333")


def test_sumar_no_acumula_error_binario() -> None:
    assert sumar([D("0.1"), D("0.2")]) == D("0.3000")
    assert sumar([D("0.1")] * 10) == D("1.0000")
    assert sumar([]) == D("0.0000")


def test_dividir_el_total_entre_el_rendimiento() -> None:
    assert dividir(D("1000"), 8) == D("125.0000")
    assert dividir(D("100"), 3) == D("33.3333")
    assert dividir(D("1"), 16) == D("0.0625")


def test_los_valores_de_dinero_quedan_con_cuatro_decimales() -> None:
    assert costo_linea(D(1), "unidad", D(1), D(1), "unidad").as_tuple().exponent == -4
    assert sumar([D(1)]).as_tuple().exponent == -4
    assert dividir(D(1), 3).as_tuple().exponent == -4


# --- pesos enteros, solo al mostrar -------------------------------------------------------------


@pytest.mark.parametrize(
    ("valor", "esperado"),
    [
        ("0.4999", "0"),
        ("0.5", "1"),
        ("1.5", "2"),
        ("2.5", "3"),  # half up, not banker's rounding
        ("249.9999", "250"),
        ("1234.5", "1235"),
        ("0", "0"),
    ],
)
def test_redondear_pesos_es_half_up(valor: str, esperado: str) -> None:
    assert redondear_pesos(D(valor)) == D(esperado)


def test_el_redondeo_a_pesos_es_una_funcion_aparte_que_el_calculo_no_usa() -> None:
    assert costo_linea(D("0.5"), "unidad", D(1), D(1), "unidad") == D("0.5000")
    assert redondear_pesos(D("0.5000")) == D(1)


# --- magnitudes ----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("unidad_a", "unidad_b", "compatibles"),
    [
        ("g", "kg", True),
        ("ml", "L", True),
        ("unidad", "unidad", True),
        ("ml", "g", False),
        ("kg", "L", False),
        ("unidad", "g", False),
        ("g", "oz", False),
    ],
)
def test_solo_son_compatibles_las_unidades_de_la_misma_magnitud(
    unidad_a: str, unidad_b: str, compatibles: bool
) -> None:
    assert son_compatibles(unidad_a, unidad_b) is compatibles
    assert son_compatibles(unidad_b, unidad_a) is compatibles


@pytest.mark.parametrize(("unidad", "unidad_contenido"), [("ml", "g"), ("g", "L"), ("unidad", "kg")])
def test_no_convierte_entre_magnitudes_distintas(unidad: str, unidad_contenido: str) -> None:
    with pytest.raises(UnidadesIncompatiblesError):
        costo_linea(D(100), unidad, D(1000), D(1), unidad_contenido)


def test_un_contenido_cero_no_divide() -> None:
    with pytest.raises(ValueError, match="contenido"):
        costo_linea(D(1), "g", D(1), D(0), "g")


def test_el_precio_cero_es_un_costo_cero_valido() -> None:
    assert costo_linea(D(100), "g", D(0), D(1), "kg") == D("0.0000")


# --- sin float -----------------------------------------------------------------------------------


def test_el_modulo_no_usa_float_en_ninguna_parte() -> None:
    fuente = inspect.getsource(costos_calculo)
    arbol = ast.parse(fuente)
    usos_de_float = [
        nodo
        for nodo in ast.walk(arbol)
        if (isinstance(nodo, ast.Name) and nodo.id == "float")
        or (isinstance(nodo, ast.Constant) and type(nodo.value).__name__ == "float")
    ]
    assert usos_de_float == []


def test_este_archivo_de_pruebas_tampoco_usa_float() -> None:
    with open(__file__, encoding="utf-8") as archivo:
        arbol = ast.parse(archivo.read())
    usos = [
        nodo
        for nodo in ast.walk(arbol)
        if (isinstance(nodo, ast.Name) and nodo.id == "float")
        or (isinstance(nodo, ast.Constant) and type(nodo.value).__name__ == "float")
    ]
    assert usos == []
