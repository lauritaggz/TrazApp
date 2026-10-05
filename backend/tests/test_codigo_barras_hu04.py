"""Barcode normalization and validation (HU04 / T04-03)."""

import pytest

from app.core.codigo_barras import (
    MENSAJE_DIGITO_VERIFICADOR,
    MENSAJE_FORMATO,
    digito_verificador_valido,
    normalizar_codigo_barras,
    validar_codigo_barras,
)

# Real-world codes, one per accepted format.
EAN_13 = ["7802910000971", "4006381333931", "5901234123457"]
UPC_A = ["036000291452", "012345678905"]
EAN_8 = ["96385074", "73513537", "12345670"]


def _con_digito(cuerpo: str) -> str:
    suma = sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(cuerpo)))
    return cuerpo + str((10 - suma % 10) % 10)


@pytest.mark.parametrize("codigo", EAN_13 + UPC_A + EAN_8)
def test_acepta_ean_13_upc_a_y_ean_8_con_digito_verificador_valido(codigo: str) -> None:
    assert validar_codigo_barras(codigo) == codigo


def test_el_digito_verificador_se_calcula_con_gs1() -> None:
    assert _con_digito("780291000097") == "7802910000971"
    assert digito_verificador_valido("7802910000971")
    for ultimo in "023456789":
        assert not digito_verificador_valido("780291000097" + ultimo)


@pytest.mark.parametrize("codigo", EAN_13 + UPC_A + EAN_8)
def test_rechaza_un_digito_verificador_incorrecto(codigo: str) -> None:
    incorrecto = codigo[:-1] + str((int(codigo[-1]) + 1) % 10)

    with pytest.raises(ValueError, match=MENSAJE_DIGITO_VERIFICADOR):
        validar_codigo_barras(incorrecto)


@pytest.mark.parametrize("largo", [1, 7, 9, 10, 11, 14, 15])
def test_rechaza_largos_distintos_de_8_12_o_13(largo: int) -> None:
    codigo = _con_digito("1" * (largo - 1)) if largo > 1 else "5"

    with pytest.raises(ValueError, match=MENSAJE_FORMATO):
        validar_codigo_barras(codigo)


@pytest.mark.parametrize("codigo", ["78029100009A1", "ABCDEFGH", "7802-9100-0097", "٧٨٠٢٩١٠٠٠٠٩٧١", "7802910000.71"])
def test_rechaza_caracteres_que_no_son_digitos_ascii(codigo: str) -> None:
    with pytest.raises(ValueError, match=MENSAJE_FORMATO):
        validar_codigo_barras(codigo)


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        (" 7802910000971 ", "7802910000971"),
        ("780 291 0000971", "7802910000971"),
        ("7802910000971\n", "7802910000971"),
        ("\t7802 910000971", "7802910000971"),
        ("", None),
        ("   ", None),
        (None, None),
    ],
)
def test_normaliza_quitando_todos_los_espacios_y_la_cadena_vacia_es_nula(
    entrada: str | None, esperado: str | None
) -> None:
    assert normalizar_codigo_barras(entrada) == esperado
