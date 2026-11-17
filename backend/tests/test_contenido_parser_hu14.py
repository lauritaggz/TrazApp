"""Net content parser (HU14 / T14-03): a pure function, no database and no network."""

from decimal import Decimal

import pytest

from app.core.contenido import parsear_contenido

D = Decimal


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        # unidades de masa
        ("500 g", (D("500"), "g")),
        ("116g", (D("116"), "g")),
        ("108 gr.", (D("108"), "g")),
        ("250 grs", (D("250"), "g")),
        ("200 gramos", (D("200"), "g")),
        ("1 kg", (D("1"), "kg")),
        ("2 KGS", (D("2"), "kg")),
        ("1 kilo", (D("1"), "kg")),
        ("3 kilos", (D("3"), "kg")),
        ("1 kilogramo", (D("1"), "kg")),
        # unidades de volumen
        ("900 ml", (D("900"), "ml")),
        ("330 cc", (D("330"), "ml")),
        ("250 mililitros", (D("250"), "ml")),
        ("1L", (D("1"), "L")),
        ("1 l", (D("1"), "L")),
        ("1 Litro", (D("1"), "L")),
        ("2 lt", (D("2"), "L")),
        ("2 lts", (D("2"), "L")),
        ("1,5 litros", (D("1.5"), "L")),
        # unidades
        ("12 un", (D("12"), "unidad")),
        ("6 unid", (D("6"), "unidad")),
        ("1 unidad", (D("1"), "unidad")),
        ("30 unidades", (D("30"), "unidad")),
        # decimales con coma o punto
        ("1,5 kg", (D("1.5"), "kg")),
        ("1.5 kg", (D("1.5"), "kg")),
        ("0,25 kg", (D("0.25"), "kg")),
        ("1,500 kg", (D("1.5"), "kg")),
        ("2.25 L", (D("2.25"), "L")),
        # espacios de más y mayúsculas
        ("  500   G  ", (D("500"), "g")),
        ("500 g", (D("500"), "g")),
        # N x Q: se normaliza a N·Q
        ("6 x 200 ml", (D("1200"), "ml")),
        ("6x200ml", (D("1200"), "ml")),
        ("6 X 200 ML", (D("1200"), "ml")),
        ("Pack 3 x 1 L", (D("3"), "L")),
        ("pack 12 x 1 un", (D("12"), "unidad")),
        ("2 x 1,5 L", (D("3"), "L")),
        ("2 x 500 g", (D("1000"), "g")),
        ("100 x 1 un", (D("100"), "unidad")),
    ],
)
def test_entiende_el_contenido_inequivoco(texto: str, esperado: tuple[Decimal, str]) -> None:
    assert parsear_contenido(texto) == esperado


@pytest.mark.parametrize(
    "texto",
    [
        # un punto seguido de exactamente 3 dígitos es ambiguo: no se adivina
        "1.000 g",
        "1.250 kg",
        "0.250 kg",
        "2.500 ml",
        "6 x 1.000 ml",
        # N fuera de 2 a 100
        "1 x 200 ml",
        "0 x 200 ml",
        "101 x 1 un",
        # presentaciones que no son el patrón N x Q
        "900 g (6 x 150 g)",
        "6 x 200 ml + 1 gratis",
        "2 packs de 6 x 200 ml",
        "Pack de 3 x 1 L",
        "3 x 2 x 1 L",
        "6 × 200 ml",
        # solo una cifra o solo una unidad
        "500",
        "g",
        "kg",
        "un",
        # unidades que no se reconocen
        "1 oz",
        "2 lb",
        "500 mg",
        "1 galón",
        "3 docenas",
        "1 paquete",
        # cifras que no son un número sencillo
        "1.000,5 g",
        "1,000.5 g",
        "1,5,2 kg",
        "-5 g",
        "abc kg",
        "1e3 g",
        # cero o con más decimales de los que guarda la base
        "0 g",
        "0,0 kg",
        "1,2345 kg",
        "2000000000 g",
        # nada que leer
        "",
        "   ",
        "aprox. 500 g",
        "500 g aprox.",
        "Granel",
    ],
)
def test_lo_que_no_entiende_o_es_ambiguo_es_none_nunca_adivinado(texto: str) -> None:
    assert parsear_contenido(texto) is None


@pytest.mark.parametrize("valor", [None, 500, 1.5, ["500 g"], {"q": "500 g"}, b"500 g"])
def test_un_valor_que_no_es_texto_es_none(valor: object) -> None:
    assert parsear_contenido(valor) is None


def test_el_resultado_es_decimal_exacto_no_flotante() -> None:
    cantidad, unidad = parsear_contenido("0,1 L")

    assert isinstance(cantidad, Decimal)
    assert cantidad == Decimal("0.1")
    assert unidad == "L"
    assert parsear_contenido("3 x 0,1 L") == (Decimal("0.3"), "L")
