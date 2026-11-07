"""QR code of a published product and its public URL (T09-03 / HU09).

Covers the URL builder, `url_publica` in the read payloads, GET /gestion/productos/{id}/qr
(PNG / SVG), PT09-05 (API part: same QR after disabling and enabling again), PT09-06 (API part:
two products, two QRs) and PT09-12 (download of another productor's product).
The tests set URL_PUBLICA_APP themselves; they do not depend on the environment.
"""

import struct
import xml.etree.ElementTree as ET

import pytest

from app.core import publicacion
from app.core.config import get_settings
from app.core.publicacion import UrlPublicaNoConfiguradaError, construir_url_publica, url_publica_o_none
from app.services import qr_service
from tests.test_publicacion_endpoints_hu09 import (  # noqa: F401  (fixtures and helpers)
    _deshabilitar,
    _habilitar,
    _segundo_producto,
    ctx,
    listo,
    _finalizar_una,
)
from tests.escenario_hu05 import PRODUCTOR_B, crear_producto, registrar

BASE = "https://trazapp.ejemplo.test"
FIRMA_PNG = b"\x89PNG\r\n\x1a\n"


def _fijar_base(monkeypatch, valor: str | None) -> None:
    if valor is None:
        monkeypatch.delenv("URL_PUBLICA_APP", raising=False)
        monkeypatch.setenv("URL_PUBLICA_APP", "")
    else:
        monkeypatch.setenv("URL_PUBLICA_APP", valor)
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def base_publica(monkeypatch):
    _fijar_base(monkeypatch, BASE)
    yield
    monkeypatch.undo()
    get_settings.cache_clear()


def _qr(client, ctx, formato: str | None = None, producto_id: int | None = None, headers=None):
    ruta = f"/gestion/productos/{producto_id or ctx['producto']['id']}/qr"
    if formato is not None:
        ruta += f"?formato={formato}"
    return client.get(ruta, headers=headers or ctx["headers"])


@pytest.fixture
def publicado(client, listo) -> dict:
    cuerpo = _habilitar(client, listo).json()
    return {**listo, "publicacion": cuerpo}


def _lado_png(contenido: bytes) -> tuple[int, int, int]:
    assert contenido[:8] == FIRMA_PNG
    assert contenido[12:16] == b"IHDR"
    ancho, alto = struct.unpack(">II", contenido[16:24])
    return ancho, alto, contenido[25]  # color type


# --- URL pública -----------------------------------------------------------------------------


@pytest.mark.parametrize("base", [BASE, BASE + "/", BASE + "///", "  " + BASE + "/ "])
def test_la_url_publica_se_arma_con_o_sin_barra_final(monkeypatch, base) -> None:
    _fijar_base(monkeypatch, base)

    assert construir_url_publica("abc_123-XYZ") == f"{BASE}/p/abc_123-XYZ"


def test_sin_url_publica_app_construir_falla_y_la_lectura_tolerante_da_none(monkeypatch) -> None:
    _fijar_base(monkeypatch, None)

    with pytest.raises(UrlPublicaNoConfiguradaError):
        construir_url_publica("abc")
    assert url_publica_o_none("abc") is None
    assert url_publica_o_none(None) is None


def test_la_url_publica_no_tiene_valor_por_defecto_en_el_codigo(monkeypatch) -> None:
    monkeypatch.delenv("URL_PUBLICA_APP", raising=False)
    get_settings.cache_clear()

    assert type(get_settings()).model_fields["url_publica_app"].default == ""


# --- url_publica en las respuestas -----------------------------------------------------------


def test_url_publica_en_publicacion_read_y_en_producto_gestion_read(client, listo) -> None:
    producto_id = listo["producto"]["id"]
    otro = crear_producto(client, listo["headers"], "Galletas", "gal-001")

    antes = client.get(f"/gestion/productos/{producto_id}", headers=listo["headers"]).json()
    assert antes["url_publica"] is None

    publicada = _habilitar(client, listo).json()
    esperada = f"{BASE}/p/{publicada['id_publico']}"
    assert publicada["url_publica"] == esperada
    detalle = client.get(f"/gestion/productos/{producto_id}", headers=listo["headers"]).json()
    listado = {p["id"]: p for p in client.get("/gestion/productos", headers=listo["headers"]).json()}
    assert detalle["url_publica"] == listado[producto_id]["url_publica"] == esperada
    assert listado[otro["id"]]["url_publica"] is None


def test_la_url_publica_se_conserva_aunque_el_producto_se_deshabilite(client, publicado) -> None:
    esperada = publicado["publicacion"]["url_publica"]

    deshabilitada = _deshabilitar(client, publicado).json()
    detalle = client.get(f"/gestion/productos/{publicado['producto']['id']}", headers=publicado["headers"]).json()

    assert deshabilitada["publicado"] is False
    assert deshabilitada["url_publica"] == esperada
    assert detalle["url_publica"] == esperada


# --- el QR codifica la URL pública -----------------------------------------------------------


@pytest.mark.parametrize("formato", ["png", "svg"])
def test_el_qr_codifica_exactamente_la_url_publica(client, publicado, monkeypatch, formato) -> None:
    recibidas: list[str] = []
    original = qr_service.crear_qr

    def espia(url: str):
        recibidas.append(url)
        return original(url)

    monkeypatch.setattr(qr_service, "crear_qr", espia)
    id_publico = publicado["publicacion"]["id_publico"]
    esperada = f"{BASE}/p/{id_publico}"

    respuesta = _qr(client, publicado, formato)

    assert respuesta.status_code == 200
    assert recibidas == [esperada]
    assert recibidas[0].split("/p/")[1] == id_publico != str(publicado["producto"]["id"])
    assert "QUE-001" not in recibidas[0]
    # And the bytes are the ones the generator produces for that URL.
    assert respuesta.content == qr_service.generar_qr(esperada, formato)


def test_el_qr_usa_correccion_m_y_zona_de_silencio_de_4_modulos(publicado) -> None:
    import segno

    url = f"{BASE}/p/{publicado['publicacion']['id_publico']}"
    qr = qr_service.crear_qr(url)

    assert qr.error == "M"
    assert qr.symbol_size(scale=1, border=qr_service.ZONA_SILENCIO)[0] == qr.symbol_size(scale=1, border=0)[0] + 8
    assert qr.matrix == segno.make(url, error="m", micro=False, boost_error=False).matrix


# --- PNG ---------------------------------------------------------------------------------------


def test_png_por_defecto_con_firma_valida_y_al_menos_1000_px(client, publicado) -> None:
    respuesta = _qr(client, publicado)  # no formato -> png

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"] == "image/png"
    ancho, alto, tipo_color = _lado_png(respuesta.content)
    assert ancho == alto >= 1000
    assert tipo_color in (0, 2, 3)  # no alpha channel: opaque background for print


def test_el_png_alcanza_1000_px_con_matrices_de_distinto_tamano() -> None:
    for largo in (10, 60, 200):
        url = f"{BASE}/p/" + "a" * largo
        ancho, alto, _ = _lado_png(qr_service.generar_qr(url, "png"))
        assert ancho == alto >= 1000, largo


# --- SVG ---------------------------------------------------------------------------------------


def test_svg_con_viewbox_y_sin_ancho_ni_alto_en_pixeles(client, publicado) -> None:
    respuesta = _qr(client, publicado, "svg")

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"] == "image/svg+xml"
    raiz = ET.fromstring(respuesta.content)
    assert raiz.tag.endswith("svg")
    assert raiz.get("viewBox")
    assert raiz.get("width") is None and raiz.get("height") is None


# --- descarga ----------------------------------------------------------------------------------


@pytest.mark.parametrize(("formato", "ext"), [("png", "png"), ("svg", "svg")])
def test_content_disposition_con_el_codigo_del_producto(client, publicado, formato, ext) -> None:
    respuesta = _qr(client, publicado, formato)

    assert respuesta.headers["content-disposition"] == f'attachment; filename="qr-QUE-001.{ext}"'


@pytest.mark.parametrize(
    ("codigo", "esperado"),
    [
        ('A/B "C"\\..\r\n', "qr-A-B-C.png"),
        ("../../etc/passwd", "qr-etc-passwd.png"),
        ("ñandú 1", "qr-and-1.png"),
        ("///", "qr-7.png"),
        (None, "qr-7.png"),
    ],
)
def test_el_nombre_del_archivo_se_sanea(codigo, esperado) -> None:
    assert qr_service.nombre_archivo_qr(codigo, 7, "png") == esperado


def test_content_disposition_sanea_un_codigo_con_caracteres_especiales(client, listo) -> None:
    producto_id = listo["producto"]["id"]
    cambio = client.patch(
        f"/gestion/productos/{producto_id}", headers=listo["headers"], json={"codigo_interno": 'Q/ñ 1"x'}
    )
    assert cambio.status_code == 200, cambio.text
    _habilitar(client, listo)

    respuesta = _qr(client, listo)

    assert respuesta.headers["content-disposition"] == 'attachment; filename="qr-Q-1-X.png"'


# --- PT09-05 / PT09-06 -------------------------------------------------------------------------


@pytest.mark.parametrize("formato", ["png", "svg"])
def test_pt09_05_deshabilitar_y_volver_a_habilitar_da_el_mismo_qr(client, publicado, formato) -> None:
    primero = _qr(client, publicado, formato).content
    url_antes = publicado["publicacion"]["url_publica"]

    _deshabilitar(client, publicado)
    nueva = _habilitar(client, publicado).json()

    assert nueva["url_publica"] == url_antes
    assert _qr(client, publicado, formato).content == primero


def test_el_qr_es_determinista(client, publicado) -> None:
    assert _qr(client, publicado, "png").content == _qr(client, publicado, "png").content
    assert _qr(client, publicado, "svg").content == _qr(client, publicado, "svg").content


def test_pt09_06_dos_productos_producen_qr_distintos(client, publicado) -> None:
    segundo = _segundo_producto(client, publicado)
    otra = _habilitar(client, publicado, segundo).json()

    assert otra["url_publica"] != publicado["publicacion"]["url_publica"]
    for formato in ("png", "svg"):
        assert _qr(client, publicado, formato, segundo).content != _qr(client, publicado, formato).content


# --- errores -----------------------------------------------------------------------------------


def test_409_si_el_producto_nunca_se_publico(client, listo) -> None:
    respuesta = _qr(client, listo)

    assert respuesta.status_code == 409
    assert set(respuesta.json()["detail"]) == {"mensaje"}


def test_409_si_estuvo_publicado_y_luego_se_deshabilito(client, publicado) -> None:
    _deshabilitar(client, publicado)

    for formato in ("png", "svg"):
        assert _qr(client, publicado, formato).status_code == 409


def test_404_si_el_producto_es_de_otro_productor_o_no_existe(client, publicado) -> None:
    headers_b = registrar(client, PRODUCTOR_B)

    ajeno = _qr(client, publicado, headers=headers_b)
    inexistente = _qr(client, publicado, producto_id=999999)

    assert ajeno.status_code == 404
    assert inexistente.status_code == 404
    assert ajeno.json() == inexistente.json()


@pytest.mark.parametrize("formato", ["jpg", "PNG", "", "pdf"])
def test_422_con_formato_invalido(client, publicado, formato) -> None:
    assert _qr(client, publicado, formato).status_code == 422


def test_sin_autenticacion_no_hay_qr(client, publicado) -> None:
    assert client.get(f"/gestion/productos/{publicado['producto']['id']}/qr").status_code in (401, 403)


def test_sin_url_publica_app_responde_500_controlado_sin_generar_nada(client, publicado, monkeypatch) -> None:
    _fijar_base(monkeypatch, None)
    generados: list[str] = []
    monkeypatch.setattr(qr_service, "crear_qr", lambda url: generados.append(url))

    respuesta = _qr(client, publicado)

    assert respuesta.status_code == 500
    assert set(respuesta.json()["detail"]) == {"mensaje"}
    assert "URL_PUBLICA_APP" in respuesta.json()["detail"]["mensaje"]
    assert generados == []


def test_sin_url_publica_app_url_publica_es_null_pero_el_resto_responde(client, publicado, monkeypatch) -> None:
    _fijar_base(monkeypatch, None)

    detalle = client.get(f"/gestion/productos/{publicado['producto']['id']}", headers=publicado["headers"])

    assert detalle.status_code == 200
    assert detalle.json()["url_publica"] is None
    assert detalle.json()["id_publico"] == publicado["publicacion"]["id_publico"]


def test_el_modulo_de_publicacion_expone_una_sola_funcion_que_arma_la_url() -> None:
    assert publicacion.construir_url_publica is construir_url_publica
