from fastapi.testclient import TestClient

from app.main import app


def test_root_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["health"] == "/health"
    assert "docs" in payload
