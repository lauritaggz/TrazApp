"""Restricted-circulation numbers (GS1 General Specifications), used by HU07 to tell bulk items apart."""

import pytest

from app.core.codigo_barras import es_circulacion_restringida, validar_codigo_barras


def _con_digito(cuerpo: str) -> str:
    suma = sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(cuerpo)))
    return cuerpo + str((10 - suma % 10) % 10)


@pytest.mark.parametrize(
    "cuerpo",
    ["020000000000", "021234567890", "200000000000", "245678901234", "299999999999"],
)
def test_ean13_con_prefijo_02_o_20_a_29_es_restringido(cuerpo: str) -> None:
    codigo = validar_codigo_barras(_con_digito(cuerpo))
    assert len(codigo) == 13 and es_circulacion_restringida(codigo)


@pytest.mark.parametrize("codigo", ["7802900001193", "7805000324674", "0012345678905", "3017620422003"])
def test_ean13_comunes_no_son_restringidos(codigo: str) -> None:
    assert not es_circulacion_restringida(validar_codigo_barras(codigo))


def test_ean13_con_0_inicial_que_no_es_02_no_es_restringido() -> None:
    # 0 + UPC-A normal (la fila 01, p. ej.): no es el rango 02.
    assert not es_circulacion_restringida(validar_codigo_barras(_con_digito("001234567890")))


def test_upca_con_2_es_el_rango_02_del_ean13() -> None:
    upc = validar_codigo_barras(_con_digito("21234567890"))
    assert len(upc) == 12 and es_circulacion_restringida(upc)
    assert es_circulacion_restringida("0" + upc)
    normal = validar_codigo_barras(_con_digito("01234567890"))
    assert not es_circulacion_restringida(normal)


@pytest.mark.parametrize("cuerpo", ["0000000", "0123456", "2000000", "2492735"])
def test_ean8_con_prefijo_0_o_2_es_restringido(cuerpo: str) -> None:
    codigo = validar_codigo_barras(_con_digito(cuerpo))
    assert len(codigo) == 8 and es_circulacion_restringida(codigo)


@pytest.mark.parametrize("cuerpo", ["1234567", "7801234", "9638507"])
def test_ean8_con_otro_prefijo_no_es_restringido(cuerpo: str) -> None:
    assert not es_circulacion_restringida(validar_codigo_barras(_con_digito(cuerpo)))


@pytest.mark.parametrize("codigo", ["", "abc", "12345", "2" * 11])
def test_formas_invalidas_no_son_restringidas(codigo: str) -> None:
    assert not es_circulacion_restringida(codigo)
