"""Allergen detection: labels and ingredient text (T13-04 / HU13).

`detectar_alergenos` is a pure function, so these tests need no database and no network.
Each text case states what must be suggested as «contiene», as «trazas» and what goes to manual
assignment (`sin_reconocer`).
"""

import pytest

from app.core.alergenos_palabras import ETIQUETAS_OFF
from app.services.recuperacion.alergenos import (
    ORIGEN_ETIQUETA,
    ORIGEN_TEXTO,
    detectar_alergenos,
    normalizar_texto,
)


def _detectar(texto, contiene=(), trazas=()):
    return detectar_alergenos(tuple(contiene), tuple(trazas), texto)


def _codigos(items) -> set[str]:
    return {item.codigo for item in items}


def _resumen(texto):
    deteccion = _detectar(texto)
    return _codigos(deteccion.contiene), _codigos(deteccion.trazas), list(deteccion.sin_reconocer)


NADA = (set(), set(), [])

# (text, contiene, trazas, sin_reconocer)
CASOS_DE_TEXTO = [
    # --- empty and noise ---
    pytest.param(None, *NADA, id="nulo"),
    pytest.param("", *NADA, id="vacio"),
    pytest.param("   \n\t ", *NADA, id="solo-espacios"),
    pytest.param("Azúcar, sal, agua", *NADA, id="sin-alergenos"),
    pytest.param(
        "Azúcar. Elaborado y envasado por Industrias Sur S.A., Av. Las Condes 1234, piso 5, "
        "Santiago, Región Metropolitana. Tel. +56 2 2345 6789",
        *NADA,
        id="direccion-y-telefono-del-fabricante",
    ),
    pytest.param("Cloruro de sodio, yodato de potasio y prusiato amarillo de soda", *NADA, id="soda-no-es-soja"),
    pytest.param("Maltodextrina, bicarbonato sódico (E-500ii)", *NADA, id="malta-dentro-de-maltodextrina"),
    pytest.param("Aroma natural, color claramente visible, maniobra", *NADA, id="palabras-que-contienen-otras"),
    # --- each allergen ---
    pytest.param("Harina de trigo, azúcar, sal", {"gluten"}, set(), [], id="gluten-trigo"),
    pytest.param("Avena, cebada, centeno, sémola, extracto de malta", {"gluten"}, set(), [], id="gluten-cereales"),
    pytest.param("Leche descremada", {"lacteos"}, set(), [], id="lacteos-leche"),
    pytest.param("Crema, manjar y queso", {"lacteos"}, set(), [], id="lacteos-crema-manjar-queso"),
    pytest.param("Suero de leche en polvo, caseinato de sodio", {"lacteos"}, set(), [], id="lacteos-suero-caseinato"),
    pytest.param("Yema de huevo, clara, albúmina", {"huevos"}, set(), [], id="huevos"),
    pytest.param("Maní tostado y cacahuates", {"cacahuetes"}, set(), [], id="cacahuetes"),
    pytest.param("Lecitina de soya, proteína de soja", {"soja"}, set(), [], id="soja"),
    pytest.param("Nueces, almendras, avellanas, pistachos, castañas de cajú", {"frutos_cascara"}, set(), [], id="frutos-de-cascara"),
    pytest.param("Atún, merluza y salmón", {"pescado"}, set(), [], id="pescado"),
    pytest.param("Camarones y langostinos", {"crustaceos"}, set(), [], id="crustaceos"),
    pytest.param("Calamares, mejillones y almejas", {"moluscos"}, set(), [], id="moluscos"),
    pytest.param("Conservante: dióxido de azufre (E-220)", {"sulfitos"}, set(), [], id="sulfitos-aditivo"),
    pytest.param("Metabisulfito de sodio", {"sulfitos"}, set(), [], id="sulfitos-metabisulfito"),
    pytest.param("Apio deshidratado y mostaza", {"apio", "mostaza"}, set(), [], id="apio-y-mostaza"),
    pytest.param("Aceite de sésamo, tahini, ajonjolí", {"sesamo"}, set(), [], id="sesamo"),
    pytest.param("Harina de altramuz y lupino", {"altramuces"}, set(), [], id="altramuces"),
    # --- normalization ---
    pytest.param("LECHE DESCREMADA", {"lacteos"}, set(), [], id="mayusculas"),
    pytest.param("MANÍ", {"cacahuetes"}, set(), [], id="tilde-mayuscula"),
    pytest.param("mani", {"cacahuetes"}, set(), [], id="sin-tilde"),
    pytest.param("Leche;huevo,(soya)", {"lacteos", "huevos", "soja"}, set(), [], id="puntuacion-pegada"),
    pytest.param("leche\n\nhuevo   yema", {"lacteos", "huevos"}, set(), [], id="espacios-y-saltos"),
    pytest.param("Huevos y nueces", {"huevos", "frutos_cascara"}, set(), [], id="plurales"),
    # --- negation ---
    pytest.param("Sin gluten", *NADA, id="sin-gluten"),
    pytest.param("Producto libre de gluten", *NADA, id="libre-de-gluten"),
    pytest.param("No contiene gluten", *NADA, id="no-contiene-gluten"),
    pytest.param("Sin contenido de huevo", *NADA, id="sin-contenido-de"),
    pytest.param("Sin ningún gluten", *NADA, id="sin-ningun"),
    pytest.param("Sin huevo ni leche", *NADA, id="sin-a-ni-b"),
    pytest.param("Sin sulfitos", *NADA, id="sin-sulfitos"),
    pytest.param("Sin gluten, con leche", {"lacteos"}, set(), [], id="la-negacion-termina-en-la-coma"),
    pytest.param("Sin azúcar refinada, harina de trigo", {"gluten"}, set(), [], id="sin-no-alcanza-una-palabra-lejana"),
    # --- «leche sin lactosa» is still milk ---
    pytest.param("Leche sin lactosa", {"lacteos"}, set(), [], id="leche-sin-lactosa"),
    pytest.param("Sin lactosa", {"lacteos"}, set(), [], id="sin-lactosa-no-se-niega"),
    pytest.param("Sin gluten ni lactosa", {"lacteos"}, set(), [], id="sin-gluten-ni-lactosa"),
    # --- traces ---
    pytest.param("Harina de trigo. Puede contener trazas de soya y huevo.", {"gluten"}, {"soja", "huevos"}, [], id="puede-contener-trazas-de"),
    pytest.param("Azúcar. PUEDE CONTENER SOJA. PUEDE CONTENER CACAHUETE.", set(), {"soja", "cacahuetes"}, [], id="una-frase-por-alergeno"),
    pytest.param("Contiene trazas de nueces", set(), {"frutos_cascara"}, [], id="contiene-trazas-de"),
    pytest.param("Trazas de leche", set(), {"lacteos"}, [], id="trazas-de"),
    pytest.param("Elaborado en una línea que procesa maní y soya.", set(), {"cacahuetes", "soja"}, [], id="elaborado-en-una-linea-que-procesa"),
    pytest.param("Elaborado en líneas de producción que también procesan leche y gluten", set(), {"lacteos", "gluten"}, [], id="elaborado-en-lineas-que-procesan"),
    pytest.param("Harina de trigo. Puede contener leche. Sal.", {"gluten"}, {"lacteos"}, [], id="solo-llega-hasta-el-punto"),
    pytest.param("Puede contener trigo. Harina de trigo", {"gluten"}, set(), [], id="contiene-gana-aunque-venga-despues"),
    pytest.param("Leche. Puede contener leche.", {"lacteos"}, set(), [], id="un-alergeno-aparece-una-sola-vez"),
    pytest.param("Puede contener leche, huevo y soya", set(), {"lacteos", "huevos", "soja"}, [], id="lista-de-trazas"),
    # --- ambiguous cases ---
    pytest.param("Leche de coco", set(), set(), ["leche de coco"], id="leche-de-coco"),
    pytest.param("Leche de almendras", {"frutos_cascara"}, set(), ["leche de almendras"], id="leche-de-almendras"),
    pytest.param("Bebida de avena y leche de avena", {"gluten"}, set(), ["leche de avena"], id="leche-de-avena"),
    pytest.param("Leche de coco y leche entera", {"lacteos"}, set(), [], id="la-duda-se-resuelve-si-hay-leche-de-verdad"),
    pytest.param("Mantequilla de maní", {"cacahuetes"}, set(), [], id="mantequilla-de-mani-no-es-lacteo"),
    pytest.param("Crema de almendras", {"frutos_cascara"}, set(), [], id="crema-de-almendras"),
    pytest.param("Mantequilla de cacao", set(), set(), ["mantequilla de cacao"], id="mantequilla-de-cacao"),
    pytest.param("Mantequilla y mantequilla de maní", {"lacteos", "cacahuetes"}, set(), [], id="mantequilla-de-verdad-y-de-mani"),
    pytest.param("Crema de leche", {"lacteos"}, set(), [], id="crema-de-leche"),
    pytest.param("Harina", set(), set(), ["harina"], id="harina-sola"),
    pytest.param("Harina, sal y azúcar", set(), set(), ["harina"], id="harina-sin-especificar"),
    pytest.param("Harina enriquecida", set(), set(), ["harina"], id="harina-enriquecida"),
    pytest.param("Harina de maíz", *NADA, id="harina-de-maiz-es-especifica"),
    pytest.param("Harina de trigo", {"gluten"}, set(), [], id="harina-de-trigo"),
    pytest.param("Trigo y harina", {"gluten"}, set(), [], id="la-harina-ya-esta-cubierta-por-el-trigo"),
    pytest.param("Nuez moscada", *NADA, id="nuez-moscada-es-una-especia"),
    pytest.param("Nuez moscada y nueces", {"frutos_cascara"}, set(), [], id="nuez-moscada-y-nueces"),
]


@pytest.mark.parametrize(("texto", "contiene", "trazas", "sin_reconocer"), CASOS_DE_TEXTO)
def test_deteccion_desde_el_texto(texto, contiene, trazas, sin_reconocer) -> None:
    assert _resumen(texto) == (contiene, trazas, sin_reconocer)


def test_hay_al_menos_treinta_casos_de_texto() -> None:
    assert len(CASOS_DE_TEXTO) >= 30


def test_lo_detectado_en_el_texto_lleva_origen_texto() -> None:
    deteccion = _detectar("Leche descremada. Puede contener soya.")

    assert [(a.codigo, a.origen) for a in deteccion.contiene] == [("lacteos", ORIGEN_TEXTO)]
    assert [(a.codigo, a.origen) for a in deteccion.trazas] == [("soja", ORIGEN_TEXTO)]


def test_sin_nada_que_detectar_devuelve_la_estructura_completa_vacia() -> None:
    deteccion = _detectar(None)

    assert (deteccion.contiene, deteccion.trazas, deteccion.sin_reconocer) == ((), (), ())


def test_los_alergenos_salen_en_el_orden_del_texto() -> None:
    deteccion = _detectar("Soya, huevo y leche")

    assert [a.codigo for a in deteccion.contiene] == ["soja", "huevos", "lacteos"]


# --- labels of the source ---


@pytest.mark.parametrize(("etiqueta", "codigo"), sorted(ETIQUETAS_OFF.items()))
def test_cada_etiqueta_de_contiene_se_traduce_a_su_alergeno(etiqueta, codigo) -> None:
    deteccion = _detectar(None, contiene=[etiqueta])

    assert [(a.codigo, a.origen) for a in deteccion.contiene] == [(codigo, ORIGEN_ETIQUETA)]
    assert deteccion.trazas == ()
    assert deteccion.sin_reconocer == ()


@pytest.mark.parametrize(("etiqueta", "codigo"), sorted(ETIQUETAS_OFF.items()))
def test_cada_etiqueta_de_trazas_se_traduce_a_trazas(etiqueta, codigo) -> None:
    deteccion = _detectar(None, trazas=[etiqueta])

    assert deteccion.contiene == ()
    assert [(a.codigo, a.origen) for a in deteccion.trazas] == [(codigo, ORIGEN_ETIQUETA)]


def test_las_etiquetas_pedidas_por_la_historia_estan_en_la_tabla() -> None:
    assert ETIQUETAS_OFF == {
        "en:milk": "lacteos",
        "en:gluten": "gluten",
        "en:eggs": "huevos",
        "en:peanuts": "cacahuetes",
        "en:soybeans": "soja",
        "en:nuts": "frutos_cascara",
        "en:sulphur-dioxide-and-sulphites": "sulfitos",
        "en:sesame-seeds": "sesamo",
        "en:lupin": "altramuces",
        "en:fish": "pescado",
        "en:crustaceans": "crustaceos",
        "en:molluscs": "moluscos",
        "en:celery": "apio",
        "en:mustard": "mostaza",
    }


@pytest.mark.parametrize("etiqueta", ["en:tree-nuts", "es:leche", "en:novel-food", "fr:lait"])
def test_una_etiqueta_sin_mapeo_va_a_asignacion_manual(etiqueta) -> None:
    deteccion = _detectar("Azúcar", contiene=[etiqueta])

    assert deteccion.contiene == ()
    assert deteccion.sin_reconocer == (etiqueta,)


def test_una_etiqueta_sin_mapeo_de_trazas_tambien_va_a_asignacion_manual() -> None:
    deteccion = _detectar(None, trazas=["en:something-odd"])

    assert deteccion.trazas == ()
    assert deteccion.sin_reconocer == ("en:something-odd",)


def test_las_etiquetas_con_mapeo_y_sin_mapeo_conviven() -> None:
    deteccion = _detectar(None, contiene=["en:milk", "en:tree-nuts"], trazas=["en:soybeans", "en:raro"])

    assert _codigos(deteccion.contiene) == {"lacteos"}
    assert _codigos(deteccion.trazas) == {"soja"}
    assert deteccion.sin_reconocer == ("en:tree-nuts", "en:raro")


def test_una_etiqueta_sin_mapeo_repetida_aparece_una_vez() -> None:
    deteccion = _detectar(None, contiene=["en:raro", "en:raro"], trazas=["en:raro"])

    assert deteccion.sin_reconocer == ("en:raro",)


def test_las_etiquetas_se_comparan_sin_importar_mayusculas_ni_espacios() -> None:
    deteccion = _detectar(None, contiene=[" EN:MILK "])

    assert _codigos(deteccion.contiene) == {"lacteos"}


@pytest.mark.parametrize("vacias", [(), [], None])
def test_sin_etiquetas_no_hay_nada_que_traducir(vacias) -> None:
    deteccion = detectar_alergenos(vacias, vacias, None)

    assert (deteccion.contiene, deteccion.trazas, deteccion.sin_reconocer) == ((), (), ())


# --- priority: «contiene» beats «trazas», wherever each one comes from ---


def test_si_la_etiqueta_dice_contiene_y_trazas_gana_contiene() -> None:
    deteccion = _detectar(None, contiene=["en:milk"], trazas=["en:milk"])

    assert _codigos(deteccion.contiene) == {"lacteos"}
    assert deteccion.trazas == ()


def test_una_traza_de_la_etiqueta_pasa_a_contiene_si_el_texto_dice_contiene() -> None:
    deteccion = _detectar("Leche descremada", trazas=["en:milk"])

    assert [(a.codigo, a.origen) for a in deteccion.contiene] == [("lacteos", ORIGEN_TEXTO)]
    assert deteccion.trazas == ()


def test_un_contiene_de_la_etiqueta_no_baja_a_trazas_porque_el_texto_diga_puede_contener() -> None:
    deteccion = _detectar("Puede contener soya", contiene=["en:soybeans"])

    assert [(a.codigo, a.origen) for a in deteccion.contiene] == [("soja", ORIGEN_ETIQUETA)]
    assert deteccion.trazas == ()


def test_la_traza_del_texto_se_suma_a_la_de_la_etiqueta_sin_duplicarse() -> None:
    deteccion = _detectar("Puede contener soya y huevo", trazas=["en:soybeans"])

    assert [(a.codigo, a.origen) for a in deteccion.trazas] == [
        ("soja", ORIGEN_ETIQUETA),
        ("huevos", ORIGEN_TEXTO),
    ]


def test_si_etiqueta_y_texto_coinciden_en_contiene_queda_una_sola_vez_con_origen_etiqueta() -> None:
    deteccion = _detectar("Harina de trigo", contiene=["en:gluten"])

    assert [(a.codigo, a.origen) for a in deteccion.contiene] == [("gluten", ORIGEN_ETIQUETA)]


def test_un_alergeno_nunca_esta_a_la_vez_en_contiene_y_en_trazas() -> None:
    deteccion = _detectar(
        "Leche. Puede contener leche, soya, trigo. Trigo.",
        contiene=["en:soybeans"],
        trazas=["en:milk", "en:gluten", "en:eggs"],
    )

    assert _codigos(deteccion.contiene) & _codigos(deteccion.trazas) == set()
    assert _codigos(deteccion.contiene) == {"lacteos", "soja", "gluten"}
    assert _codigos(deteccion.trazas) == {"huevos"}


# --- normalization ---


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        ("Maní", "mani"),
        ("SÉMOLA", "semola"),
        ("  Leche   entera \n", "leche entera"),
        ("Cajú, Ñandú", "caju, nandu"),
    ],
)
def test_normalizar_texto(entrada, esperado) -> None:
    assert normalizar_texto(entrada) == esperado
