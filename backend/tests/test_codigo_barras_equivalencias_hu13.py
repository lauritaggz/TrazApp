"""UPC-A / EAN-13 equivalence helper (T13-03 / HU13)."""

import pytest

from app.core.codigo_barras import formas_equivalentes, validar_codigo_barras

UPC_A = "036000291452"
EAN_13_DEL_UPC = "0036000291452"
EAN_13 = "7802910000971"
EAN_8 = "96385074"


def test_un_upc_a_tambien_se_escribe_como_ean_13_con_cero_inicial() -> None:
    assert formas_equivalentes(UPC_A) == (UPC_A, EAN_13_DEL_UPC)


def test_un_ean_13_con_cero_inicial_tambien_se_escribe_como_upc_a() -> None:
    assert formas_equivalentes(EAN_13_DEL_UPC) == (EAN_13_DEL_UPC, UPC_A)


@pytest.mark.parametrize("codigo", [EAN_13, EAN_8])
def test_un_ean_13_sin_cero_inicial_y_un_ean_8_no_tienen_equivalente(codigo) -> None:
    assert formas_equivalentes(codigo) == (codigo,)


def test_el_digito_verificador_es_el_mismo_en_ambas_formas() -> None:
    for forma in formas_equivalentes(UPC_A):
        assert validar_codigo_barras(forma) == forma
