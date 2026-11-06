"""The measurement of HU07 (T07-09, CA13): the metrics, the reference and the cache, with simulated data.

Nothing here reaches the network: the sources answer with the recorded fixtures of tests/fixtures/jumbo.
"""

import importlib.util
import sys
from pathlib import Path

import httpx
import pytest

from app.services.recuperacion.modelos import ProductoFuente

RUTA = Path(__file__).resolve().parents[1] / "scripts" / "medir_hu07.py"
FIXTURES = Path(__file__).parent / "fixtures" / "jumbo"


def _cargar():
    especificacion = importlib.util.spec_from_file_location("medir_hu07", RUTA)
    modulo = importlib.util.module_from_spec(especificacion)
    sys.modules["medir_hu07"] = modulo
    especificacion.loader.exec_module(modulo)
    return modulo


m = _cargar()

ENCABEZADO = "id,nombre,marca,codigo_barras,contiene,puede_contener,tiene_ingredientes,tipo_referencia,fecha,notas\n"


def _csv(tmp_path: Path, *filas: str) -> Path:
    ruta = tmp_path / "referencia.csv"
    ruta.write_text(ENCABEZADO + "\n".join(filas) + "\n", encoding="utf-8")
    return ruta


def _fila(id: str, contiene=(), puede=(), ingredientes=True, codigo="7802900001193"):
    return m.FilaReferencia(
        id=id, nombre=f"Producto {id}", marca="Marca", codigo_barras=codigo,
        contiene=frozenset(contiene), puede_contener=frozenset(puede), tiene_ingredientes=ingredientes,
        tipo_referencia="envase", fecha="2026-11-06", notas="",
    )  # fmt: skip


def _resultado(id: str, contiene=(), trazas=(), tiempo=2.0, encontrado=True, ingredientes=True, error="", fuente="combinada"):
    return m.Resultado(
        id=id, encontrado=encontrado, fuente=fuente, contiene=frozenset(contiene), trazas=frozenset(trazas),
        ingredientes=ingredientes, tiempo=tiempo, error=error,
    )  # fmt: skip


# --- el cálculo de las métricas ---


def test_percentil_por_rango_mas_cercano() -> None:
    assert m.percentil([], 90) == 0.0
    assert m.percentil([5.0], 90) == 5.0
    assert m.percentil([float(n) for n in range(1, 11)], 90) == 9.0
    assert m.percentil([float(n) for n in range(1, 11)], 100) == 10.0
    assert m.percentil([3.0, 1.0, 2.0], 50) == 2.0


def test_metricas_con_datos_simulados() -> None:
    filas = [
        _fila("a", ["lacteos"], []),
        _fila("b", ["lacteos", "huevos"], ["soja"]),
        _fila("c", ["gluten"], []),
        _fila("d", [], ["sesamo"], ingredientes=False),
    ]
    resultados = [
        _resultado("a", ["lacteos"], [], tiempo=3.0),  # correcta
        _resultado("b", ["lacteos"], ["soja"], tiempo=12.5),  # falta «huevos» en contiene
        _resultado("c", encontrado=False, tiempo=9.0, error="fuente no disponible: timeout", ingredientes=False),
        _resultado("d", [], ["sesamo"], tiempo=4.0, ingredientes=False),  # correcta, sin ingredientes (no esperaba)
    ]

    metricas, discrepancias = m.calcular_metricas(filas, resultados)

    assert metricas["productos"] == 4 and metricas["encontrados"] == 3
    assert metricas["correctas"] == 2 and metricas["pct_correctas"] == 50.0
    # Of the three products whose reference has ingredients, two were found with them… and «c» was not found.
    assert metricas["referencia_con_ingredientes"] == 3
    assert metricas["con_ingredientes"] == 2 and metricas["pct_con_ingredientes"] == 66.7
    assert metricas["p90_segundos"] == 12.5
    assert metricas["en_tiempo"] == 3 and metricas["pct_en_tiempo"] == 75.0
    assert metricas["cumple_correctas"] is False and metricas["cumple_tiempo"] is False
    assert [(d.id, d.campo, d.esperado, d.obtenido) for d in discrepancias] == [
        ("b", "contiene", "huevos;lacteos", "lacteos"),
        ("c", "producto", "encontrado", "fuente no disponible: timeout"),
    ]


def test_exigir_contiene_y_puede_contener_exactos() -> None:
    filas = [_fila("a", ["lacteos"], [])]

    sobra_una_traza, _ = m.calcular_metricas(filas, [_resultado("a", ["lacteos"], ["soja"])])
    exacta, _ = m.calcular_metricas(filas, [_resultado("a", ["lacteos"], [])])

    assert sobra_una_traza["correctas"] == 0
    assert exacta["correctas"] == 1


def test_no_indica_equivale_a_sin_trazas_y_las_metas_se_evaluan() -> None:
    filas = [_fila(f"p{n}", ["lacteos"], []) for n in range(10)]
    resultados = [_resultado(f"p{n}", ["lacteos"], [], tiempo=1.0 + n) for n in range(10)]

    metricas, discrepancias = m.calcular_metricas(filas, resultados)

    assert discrepancias == []
    assert metricas["pct_correctas"] == 100.0 and metricas["cumple_correctas"] is True
    assert metricas["p90_segundos"] == 9.0
    assert metricas["pct_en_tiempo"] == 100.0 and metricas["cumple_tiempo"] is True


def test_las_metas_son_70_por_ciento_correctas_y_90_por_ciento_en_10_segundos() -> None:
    filas = [_fila(f"p{n}", ["lacteos"]) for n in range(10)]
    # 7 correct (70 %: meets), 9 within 10 s (90 %: meets).
    resultados = [_resultado(f"p{n}", ["lacteos"] if n < 7 else [], tiempo=11.0 if n == 9 else 5.0) for n in range(10)]

    metricas, _ = m.calcular_metricas(filas, resultados)

    assert metricas["pct_correctas"] == 70.0 and metricas["cumple_correctas"] is True
    assert metricas["pct_en_tiempo"] == 90.0 and metricas["cumple_tiempo"] is True


def test_el_resumen_trae_la_tabla_de_discrepancias() -> None:
    filas = [_fila("a", ["lacteos"])]
    metricas, discrepancias = m.calcular_metricas(filas, [_resultado("a", ["huevos"])])

    texto = m.resumen_md(metricas, discrepancias, {"reales": 3, "cache": 1})

    assert "| a · Producto a | contiene | lacteos | huevos | combinada |" in texto
    assert "Consultas reales: 3" in texto and "NO cumple" in texto


# --- la referencia ---


def test_la_referencia_omite_los_ejemplos_y_lee_no_indica(tmp_path) -> None:
    ruta = _csv(
        tmp_path,
        "ejemplo-1,Queso,Quilque,7802900001193,lacteos,no_indica,si,envase,2026-11-06,ejemplo",
        "p01,Leche,Colun,,lacteos;huevos,soja;gluten,si,foto,2026-11-06,",
        "p02,Agua,Cachantun,,,no_indica,no,envase,2026-11-06,",
    )

    filas = m.leer_referencia(ruta)

    assert [f.id for f in filas] == ["p01", "p02"]
    assert filas[0].contiene == {"lacteos", "huevos"} and filas[0].puede_contener == {"soja", "gluten"}
    assert filas[1].contiene == frozenset() and filas[1].puede_contener == frozenset()
    assert filas[1].tiene_ingredientes is False
    assert len(m.leer_referencia(ruta, incluir_ejemplos=True)) == 3


@pytest.mark.parametrize(
    ("fila", "mensaje"),
    [
        ("p01,Leche,Colun,,leche,no_indica,si,envase,2026-11-06,", "fuera del catálogo"),
        ("p01,Leche,Colun,,lacteos,,si,envase,2026-11-06,", "puede_contener"),
        ("p01,Leche,Colun,,lacteos,no_indica,quizas,envase,2026-11-06,", "tiene_ingredientes"),
        ("p01,Leche,Colun,7802910000972,lacteos,no_indica,si,envase,2026-11-06,", "código de barras"),
        (",Leche,Colun,,lacteos,no_indica,si,envase,2026-11-06,", "id o el nombre"),
    ],
)
def test_una_fila_mal_hecha_detiene_la_medicion(tmp_path, fila, mensaje) -> None:
    with pytest.raises(ValueError, match=mensaje):
        m.leer_referencia(_csv(tmp_path, fila))


def test_ids_repetidos_y_columnas_que_faltan_se_rechazan(tmp_path) -> None:
    repetidos = _csv(
        tmp_path,
        "p01,Leche,Colun,,lacteos,no_indica,si,envase,2026-11-06,",
        "p01,Agua,Cachantun,,,no_indica,no,envase,2026-11-06,",
    )
    with pytest.raises(ValueError, match="repetidos"):
        m.leer_referencia(repetidos)
    sin_columna = tmp_path / "otra.csv"
    sin_columna.write_text("id,nombre\np01,Leche\n", encoding="utf-8")
    with pytest.raises(ValueError, match="Faltan columnas"):
        m.leer_referencia(sin_columna)


def test_la_referencia_de_ejemplo_del_repositorio_es_valida() -> None:
    ruta = Path(__file__).resolve().parents[2] / "docs" / "validacion_hu07" / "referencia.csv"
    assert len(m.leer_referencia(ruta, incluir_ejemplos=True)) >= 2
    assert all(f.es_ejemplo for f in m.leer_referencia(ruta, incluir_ejemplos=True))


# --- cuántas consultas como máximo ---


def test_estimacion_maxima_de_consultas_reales() -> None:
    filas = [
        _fila("a", codigo="7802900001193"),  # EAN-13: OFF once + search + 3 sheets = 5
        _fila("b", codigo="036000291452"),  # UPC-A: OFF twice + search + 3 sheets = 6
        _fila("c", codigo=""),  # by name: search + 1 sheet = 2
    ]

    estimacion = m.estimar_consultas(filas)

    assert estimacion == {"productos": 3, "con_codigo": 2, "sin_codigo": 1, "maximo": 13}
    assert m.estimar_consultas([_fila(f"p{n}") for n in range(50)])["maximo"] == 250


# --- los alérgenos como los calcula el servicio ---


def test_alergenos_de_un_producto_de_una_sola_fuente() -> None:
    producto = ProductoFuente(
        codigo_barras="7802910000971", nombre="Galleta", marca=None, presentacion=None,
        ingredientes="Harina de trigo, leche en polvo", etiquetas_alergenos=("en:eggs",),
    )  # fmt: skip

    contiene, trazas, _ = m.alergenos_de(producto)

    assert contiene == {"gluten", "lacteos", "huevos"}
    assert trazas == frozenset()


# --- la caché y la medición de un producto ---


def _transporte_de_jumbo(peticiones: list):
    def manejar(request: httpx.Request) -> httpx.Response:
        peticiones.append(request)
        if request.method == "POST":
            return httpx.Response(
                200, text=(FIXTURES / "busqueda_quilque.json").read_text(encoding="utf-8"),
                headers={"content-type": "application/json"},
            )  # fmt: skip
        return httpx.Response(200, text=(FIXTURES / "ficha_quilque_500g.html").read_text(encoding="utf-8"))

    return httpx.MockTransport(manejar)


def test_la_cache_responde_sin_repetir_la_consulta_y_no_guarda_los_errores(tmp_path) -> None:
    llamadas: list = []

    def manejar(request: httpx.Request) -> httpx.Response:
        llamadas.append(request.url.path)
        return httpx.Response(503 if request.url.path == "/caido" else 200, text="hola")

    transporte = m.TransporteConCache(tmp_path, real=httpx.MockTransport(manejar))
    with httpx.Client(transport=transporte) as cliente:
        assert cliente.get("https://fuente.test/ok").text == "hola"
        assert cliente.get("https://fuente.test/ok").text == "hola"
        assert cliente.get("https://fuente.test/caido").status_code == 503
        assert cliente.get("https://fuente.test/caido").status_code == 503

    assert llamadas == ["/ok", "/caido", "/caido"]
    assert transporte.consultas_reales == 3 and transporte.aciertos == 1


def test_medir_un_producto_por_nombre_toma_el_primer_resultado_y_la_segunda_corrida_no_consulta(tmp_path) -> None:
    peticiones: list = []
    fila = m.FilaReferencia(
        id="p01", nombre="Queso mantecoso", marca="Quilque", codigo_barras="", contiene=frozenset({"lacteos"}),
        puede_contener=frozenset(), tiene_ingredientes=True, tipo_referencia="envase", fecha="2026-11-06", notas="",
    )  # fmt: skip

    def fuentes():
        f = m.construir_fuentes(tmp_path / "cache")
        f.transporte._real = _transporte_de_jumbo(peticiones)
        return f

    primera = m.medir_fila(fila, fuentes())
    segunda = m.medir_fila(fila, fuentes())

    assert primera.encontrado and primera.fuente == "jumbo" and primera.ingredientes
    assert "lacteos" in primera.contiene
    assert primera.consultas_reales == 2  # the search and the sheet of the first hit
    assert segunda.consultas_reales == 0 and len(peticiones) == 2
    assert segunda.contiene == primera.contiene
    # The cached answer carries the time it took when it was fetched.
    assert segunda.tiempo > 0


def test_una_fuente_caida_se_registra_como_error_y_no_detiene_la_medicion(tmp_path) -> None:
    fila = _fila("p01", codigo="")

    def caida(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    f = m.construir_fuentes(tmp_path / "cache")
    f.transporte._real = httpx.MockTransport(caida)

    resultado = m.medir_fila(fila, f)

    assert resultado.encontrado is False
    assert resultado.error.startswith("fuente no disponible")
