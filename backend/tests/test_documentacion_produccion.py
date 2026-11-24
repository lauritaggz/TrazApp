"""Deployment: /docs, /redoc and /openapi.json are off when APP_ENV=production, unchanged otherwise."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import rutas_de_documentacion

RUTAS = ("/docs", "/redoc", "/openapi.json")


def _cliente(app_env: str) -> TestClient:
    app = FastAPI(**rutas_de_documentacion(app_env))

    @app.get("/ping")
    def ping() -> dict[str, str]:
        return {"ok": "si"}

    return TestClient(app)


@pytest.mark.parametrize("app_env", ["production", "PRODUCTION", " production "])
def test_en_produccion_no_hay_documentacion(app_env: str) -> None:
    cliente = _cliente(app_env)

    for ruta in RUTAS:
        assert cliente.get(ruta).status_code == 404, ruta
    assert cliente.get("/ping").status_code == 200


@pytest.mark.parametrize("app_env", ["development", "test", ""])
def test_fuera_de_produccion_la_documentacion_sigue_igual(app_env: str) -> None:
    cliente = _cliente(app_env)

    for ruta in RUTAS:
        assert cliente.get(ruta).status_code == 200, ruta


def test_la_app_de_desarrollo_sigue_publicando_la_documentacion(client) -> None:
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200
