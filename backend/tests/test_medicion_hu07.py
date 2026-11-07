"""The measurement of HU07 (T07-09, CA13): the metrics, the reference and the cache, with simulated data.

Nothing here reaches the network: the sources answer with the recorded fixtures of tests/fixtures/jumbo.
"""

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace

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


def _resultado(id: str, contiene=(), trazas=(), tiempo=2.0, encontrado=True, ingredientes=True, error="", fuente="combinada", **extra):
    return m.Resultado(
        id=id, encontrado=encontrado, fuente=fuente, contiene=frozenset(contiene), trazas=frozenset(trazas),
        ingredientes=ingredientes, tiempo=tiempo, error=error, **extra,
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
        ("p01,Leche,Colun,,Almendras,no_indica,si,envase,2026-11-06,", "fuera del catálogo"),
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


def test_la_referencia_acepta_los_nombres_del_catalogo_con_o_sin_acentos(tmp_path) -> None:
    ruta = _csv(
        tmp_path,
        "p01,Mix,Marca,,Leche;Huevo;Maní,Soya;Nueces;sésamo;SULFITOS,si,foto,2026-11-06,",
        "p02,Otro,Marca,,lacteos,Crustáceos;Gluten;Apio;Mostaza;Pescado;Moluscos;Altramuces,si,foto,2026-11-06,",
    )

    p01, p02 = m.leer_referencia(ruta)

    assert p01.contiene == {"lacteos", "huevos", "cacahuetes"}
    assert p01.puede_contener == {"soja", "frutos_cascara", "sesamo", "sulfitos"}
    assert p02.contiene == {"lacteos"}
    assert len(p02.puede_contener) == 7


def test_se_reportan_todas_las_filas_con_errores_y_los_nombres_fuera_del_catalogo(tmp_path) -> None:
    ruta = _csv(
        tmp_path,
        "p01,Leche,Colun,,Lacteos raros,no_indica,si,foto,2026-11-06,",
        "p02,Agua,Cachantun,,,no_indica,si,foto,2026-11-06,",
        "p03,Pan,Ideal,7802910000973,Gluten,no_indica,si,foto,2026-11-06,",
        "p04,Sal,Lobos,,,Almendras,no,foto,2026-11-06,",
    )

    with pytest.raises(ValueError) as error:
        m.leer_referencia(ruta)

    mensaje = str(error.value)
    assert "Línea 2" in mensaje and "Lacteos raros" in mensaje
    assert "Línea 4" in mensaje and "código de barras" in mensaje
    assert "Línea 5" in mensaje and "Almendras" in mensaje
    assert "Línea 3" not in mensaje


def test_validar_y_estimar_no_usan_la_red(tmp_path, capsys) -> None:
    ruta = _csv(tmp_path, "p01,Leche,Colun,7802900001193,Leche,no_indica,si,foto,2026-11-06,")
    base = {"referencia": str(ruta), "incluir_ejemplos": False, "limite": 0, "validar": False, "estimar": False}

    assert m.ejecutar(SimpleNamespace(**{**base, "validar": True})) == 0
    assert "válida: 1 productos" in capsys.readouterr().out
    assert m.ejecutar(SimpleNamespace(**{**base, "estimar": True})) == 0
    assert "como máximo 5 consultas reales" in capsys.readouterr().out


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


# --- el flujo de la aplicación: respaldo por nombre (T07-08) ---


def _con_off(estado: int, peticiones: list):
    """Open Food Facts answers `estado`; Jumbo answers with its fixtures."""
    jumbo = _transporte_de_jumbo(peticiones)

    def manejar(request: httpx.Request) -> httpx.Response:
        if "openfoodfacts" in request.url.host:
            peticiones.append(request)
            return httpx.Response(estado, json={"status": 0}) if estado == 404 else httpx.Response(estado)
        return jumbo.handle_request(request)

    return httpx.MockTransport(manejar)


def _fuentes_con(tmp_path, transporte):
    f = m.construir_fuentes(tmp_path / "cache")
    f.transporte._real = transporte
    return f


def test_si_open_food_facts_no_encuentra_el_codigo_busca_en_jumbo_por_nombre_y_marca(tmp_path) -> None:
    peticiones: list = []
    fila = _fila("p01", ["lacteos"], codigo="7802900001193")
    fila = m.replace(fila, nombre="Queso mantecoso", marca="Quilque")

    resultado = m.medir_fila(fila, _fuentes_con(tmp_path, _con_off(404, peticiones)))

    assert resultado.camino == "respaldo_nombre"
    assert resultado.encontrado and resultado.fuente == "jumbo" and resultado.error == ""
    assert resultado.mismo_producto == "si" and resultado.gtin_recuperado == "7802900001193"
    assert resultado.nombre_recuperado
    consulta = next(p for p in peticiones if p.method == "POST")
    assert b"Queso mantecoso Quilque" in consulta.content
    # One query to Open Food Facts + the search + the sheet of the first result.
    assert resultado.consultas_reales == 3


def test_si_open_food_facts_falla_tambien_se_usa_el_respaldo_por_nombre(tmp_path) -> None:
    resultado = m.medir_fila(_fila("p01", ["lacteos"]), _fuentes_con(tmp_path, _con_off(503, [])))

    assert resultado.camino == "respaldo_nombre" and resultado.encontrado
    assert resultado.fuente == "jumbo"


def test_si_fallan_el_codigo_y_el_respaldo_queda_el_error_de_los_dos_caminos(tmp_path) -> None:
    def caida(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    resultado = m.medir_fila(_fila("p01", ["lacteos"]), _fuentes_con(tmp_path, httpx.MockTransport(caida)))

    assert resultado.camino == "respaldo_nombre" and not resultado.encontrado
    assert resultado.error.count("fuente no disponible") == 2 and "respaldo por nombre" in resultado.error


def test_con_codigo_encontrado_el_camino_es_el_codigo_y_sin_codigo_es_el_nombre(tmp_path) -> None:
    sin_codigo = m.medir_fila(_fila("p01", ["lacteos"], codigo=""), _fuentes_con(tmp_path, _transporte_de_jumbo([])))

    assert sin_codigo.camino == "nombre"


def test_todas_las_fuentes_usan_el_mismo_user_agent_de_la_configuracion(tmp_path) -> None:
    f = m.construir_fuentes(tmp_path / "cache")

    assert f.settings.off_user_agent == f.settings.jumbo_user_agent
    assert f.combinada.off.user_agent == f.jumbo.user_agent == f.settings.jumbo_user_agent
    assert "github.com" not in f.jumbo.user_agent  # USER_AGENT_CON_URL is False


# --- recuperación, exactitud y global ---


def test_tres_metricas_recuperacion_por_camino_exactitud_y_global() -> None:
    filas = [_fila(f"p{n}", ["lacteos"]) for n in range(5)]
    resultados = [
        _resultado("p0", ["lacteos"]) ,                                  # código, correcta
        _resultado("p1", ["lacteos"], ["soja"]),                         # código, incorrecta
        _resultado("p2", encontrado=False),                              # código, no encontrada
        _resultado("p3", ["lacteos"]),                                   # respaldo, correcta
        _resultado("p4", encontrado=False),                              # respaldo, no encontrada
    ]
    for resultado, camino in zip(resultados, ["codigo", "codigo", "codigo", "respaldo_nombre", "respaldo_nombre"]):
        resultado.camino = camino

    metricas, _ = m.calcular_metricas(filas, resultados)

    assert metricas["pct_recuperacion"] == 60.0  # 3 of 5 found
    assert metricas["por_camino"] == {
        "codigo": {"total": 3, "encontrados": 2, "pct": 66.7},
        "respaldo_nombre": {"total": 2, "encontrados": 1, "pct": 50.0},
    }
    assert metricas["pct_exactitud"] == 66.7  # 2 correct of the 3 found
    assert metricas["pct_correctas"] == 40.0  # 2 correct of the 5: the global one, for CA13
    assert metricas["cumple_correctas"] is False


def test_el_resumen_dice_que_replica_el_flujo_y_trae_las_tres_metricas(tmp_path) -> None:
    filas = [_fila("a", ["lacteos"])]
    resultado = _resultado("a", ["lacteos"])
    resultado.camino = "respaldo_nombre"
    metricas, discrepancias = m.calcular_metricas(filas, [resultado])

    texto = m.resumen_md(metricas, discrepancias, {"reales": 0, "cache": 0})

    assert "La medición replica el flujo de la aplicación" in texto
    for etiqueta in ("Recuperación (productos encontrados)", "Exactitud (correctas entre los encontrados)", "**Global**"):
        assert etiqueta in texto
    assert "Respaldo por nombre" in texto


# --- el producto recuperado, la corrección por producto distinto y la clasificación (T07-09) ---


def test_el_respaldo_marca_si_el_gtin_recuperado_es_el_de_la_referencia_y_no_si_es_otro(tmp_path) -> None:
    otro = m.replace(_fila("p01", ["lacteos"], codigo="4006381333931"), nombre="Queso mantecoso", marca="Quilque")

    resultado = m.medir_fila(otro, _fuentes_con(tmp_path, _con_off(404, [])))

    assert resultado.camino == "respaldo_nombre" and resultado.encontrado
    assert resultado.gtin_recuperado == "7802900001193" and resultado.mismo_producto == "no"


def test_un_gtin_vacio_en_el_respaldo_cuenta_como_producto_distinto() -> None:
    fila = _fila("p01", ["lacteos"], codigo="7802900001193")
    r = _resultado("p01", ["lacteos"], camino="respaldo_nombre", gtin_recuperado="")

    assert m._mismo_producto(fila, r) == "no"
    assert m._mismo_producto(fila, replace_camino(r, "nombre")) == ""
    assert m._mismo_producto(fila, replace_camino(r, "codigo")) == "si"


def replace_camino(resultado, camino):
    return m.replace(resultado, camino=camino)


def test_la_metrica_corregida_cuenta_el_producto_distinto_como_no_encontrado_y_la_oficial_no_cambia() -> None:
    filas = [_fila(f"p{n}", ["lacteos"]) for n in range(4)]
    resultados = [_resultado(f"p{n}", ["lacteos"], camino="respaldo_nombre" if n < 2 else "codigo") for n in range(4)]
    resultados[0] = m.replace(resultados[0], mismo_producto="no", nombre_recuperado="Otro", gtin_recuperado="123")
    resultados[1] = m.replace(resultados[1], mismo_producto="si")

    oficial, discrepancias_oficiales = m.calcular_metricas(filas, resultados)
    corregida, discrepancias = m.calcular_metricas(filas, resultados, corregir_distintos=True)

    assert oficial["pct_correctas"] == 100.0 and discrepancias_oficiales == []
    assert corregida["encontrados"] == 3 and corregida["pct_recuperacion"] == 75.0
    assert corregida["pct_exactitud"] == 100.0 and corregida["pct_correctas"] == 75.0
    assert [(d.id, d.campo, d.esperado) for d in discrepancias] == [("p0", "producto", "mismo producto")]
    assert "producto distinto: Otro (gtin 123)" in discrepancias[0].obtenido


def test_clasificacion_omision_exceso_y_producto_distinto_con_su_causa() -> None:
    filas = [
        m.replace(_fila("sin-dato", ["pescado"], ["lacteos"]), nombre="A"),
        m.replace(_fila("clase-cambiada", [], ["soja"]), nombre="B"),
        m.replace(_fila("detector", ["sesamo"], []), nombre="C"),
        m.replace(_fila("exceso", [], []), nombre="D"),
        m.replace(_fila("distinto", ["lacteos"], []), nombre="E"),
    ]
    resultados = [
        _resultado("sin-dato", [], ["lacteos"], fuente="open_food_facts"),
        m.replace(_resultado("clase-cambiada", ["soja"], []), origenes={"contiene:soja": "etiqueta"}),
        m.replace(_resultado("detector", [], []), evidencia="semillas de sesamo tostadas"),
        m.replace(_resultado("exceso", ["gluten"], []), origenes={"contiene:gluten": "texto"}),
        m.replace(_resultado("distinto", ["lacteos"], []), mismo_producto="no"),
    ]

    clasificadas = {c.id: c for c in m.clasificar(filas, resultados)}

    assert (clasificadas["sin-dato"].tipo, clasificadas["sin-dato"].causa) == ("omisión", "fuente sin dato")
    assert clasificadas["detector"].causa == "detector no reconoce el término" and clasificadas["detector"].alergeno == "Sésamo"
    assert clasificadas["exceso"].tipo == "exceso" and "su texto lo nombra" in clasificadas["exceso"].causa
    assert clasificadas["distinto"].tipo == "producto distinto"
    cambiada = [c for c in m.clasificar(filas, resultados) if c.id == "clase-cambiada"]
    assert {(c.campo, c.tipo) for c in cambiada} == {("contiene", "exceso"), ("puede_contener", "omisión")}
    assert all("dato incorrecto de la fuente" in c.causa for c in cambiada)


def test_el_resumen_clasificado_trae_una_tabla_con_las_omisiones_de_contiene() -> None:
    filas = [m.replace(_fila("a", ["pescado", "soja"]), nombre="A")]
    resultados = [_resultado("a", ["soja"], fuente="open_food_facts")]

    texto = m.clasificacion_md(m.clasificar(filas, resultados))

    assert "### Omisiones de «contiene»" in texto
    assert "| a | Pescado | fuente sin dato | open_food_facts |" in texto
    assert "| omisión | 1 |" in texto


def test_la_comparacion_presenta_ca13_con_identidad_verificada_y_el_valor_anterior(tmp_path) -> None:
    filas = [m.replace(_fila(f"p{n}", ["lacteos"]), nombre=f"P{n}") for n in range(4)]
    primera = [_resultado(f"p{n}", ["lacteos"] if n != 3 else [], camino="respaldo_nombre" if n == 0 else "codigo") for n in range(4)]
    primera[2] = m.replace(primera[2], sin_reconocer=("es:Maní",))
    actuales = [m.replace(r, sin_reconocer=()) for r in primera]
    actuales[0] = m.replace(actuales[0], mismo_producto="no", nombre_recuperado="Otro", gtin_recuperado="9")
    actuales[3] = m.replace(actuales[3], contiene=frozenset({"lacteos"}))  # the improved detector now finds it

    texto = m.comparacion_md(filas, primera, actuales)

    assert "**CA13 (fichas correctas, con la identidad del producto verificada): 50,0 %** (2/4" in texto
    assert "El valor **antes de verificar la identidad** fue 75,0 % (3/4)" in texto
    assert "| **Global** (correctas sobre el total) | 75,0 % | 50,0 % | 75,0 % |" in texto
    assert "Productos distintos: **1**: `p0` (Otro, gtin 9)" in texto
    assert "contaban como correctos antes de verificar la identidad: **1**" in texto
    assert "Antes: 1 producto(s) con términos sin reconocer: `p2` → es:Maní" in texto
    assert "Después: 0 producto(s) con términos sin reconocer" in texto
    assert "`p3`: contiene no_indica → lacteos" in texto


def test_la_revision_a_mano_del_camino_por_nombre_se_aplica_y_las_otras_no_se_tocan(tmp_path) -> None:
    revision = tmp_path / "revision_identidad.csv"
    revision.write_text("id,mismo_producto,fecha,notas" + chr(10) + "a,si,2026-11-06," + chr(10) + "b,no,2026-11-06,otro" + chr(10) + "c,si,2026-11-06," + chr(10), encoding="utf-8")
    resultados = [_resultado("a", camino="nombre"), _resultado("b", camino="nombre"), _resultado("c", camino="respaldo_nombre", mismo_producto="no")]

    revisados = m.aplicar_revision_identidad(resultados, m.leer_revision_identidad(revision))

    assert [r.mismo_producto for r in revisados] == ["si", "no", "no"]  # «c» is not by name: its gtin check stands
    assert m.leer_revision_identidad(tmp_path / "no_existe.csv") == {}


def test_una_revision_con_un_valor_distinto_de_si_o_no_se_rechaza(tmp_path) -> None:
    revision = tmp_path / "revision_identidad.csv"
    revision.write_text("id,mismo_producto" + chr(10) + "a,quizas" + chr(10), encoding="utf-8")

    with pytest.raises(ValueError, match="si.* o .no"):
        m.leer_revision_identidad(revision)


def test_el_atun_sin_ingredientes_visibles_queda_como_fuente_sin_dato_con_su_detalle() -> None:
    filas = [m.replace(_fila("atun", ["pescado"]), nombre="Atún")]
    resultados = [m.replace(_resultado("atun", [], fuente="open_food_facts"), evidencia="no visible")]

    (omision,) = m.clasificar(filas, resultados)

    assert omision.causa == "fuente sin dato (ingredientes no visibles)"


def test_el_csv_lleva_el_producto_recuperado_y_se_puede_volver_a_leer(tmp_path) -> None:
    filas = [_fila("a", ["lacteos"])]
    r = m.replace(_resultado("a", ["lacteos"], camino="respaldo_nombre"), nombre_recuperado="Queso", gtin_recuperado="7802900001193", mismo_producto="si")

    m._escribir_resultados(tmp_path, filas, [r])
    texto = (tmp_path / "resultados.csv").read_text(encoding="utf-8")
    leidos = m.leer_corrida(tmp_path / "resultados.csv")

    assert "nombre_recuperado,gtin_recuperado,mismo_producto" in texto.splitlines()[0]
    assert "Queso,7802900001193,si" in texto
    assert leidos[0].contiene == {"lacteos"} and leidos[0].camino == "respaldo_nombre" and leidos[0].encontrado
