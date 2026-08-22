"""Pytest configuration and shared fixtures."""

import os
from collections.abc import Generator
from urllib.parse import urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db.base import Base
from app.db.session import get_db
from app.main import app

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
USE_POSTGRESQL = bool(TEST_DATABASE_URL)


def _ensure_postgresql_test_database(database_url: str) -> None:
    parsed = urlparse(database_url.replace("+psycopg2", ""))
    database_name = parsed.path.lstrip("/")
    admin_url = database_url.replace(f"/{database_name}", "/postgres")

    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as connection:
        exists = connection.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": database_name},
        ).scalar()
        if not exists:
            connection.execute(text(f'CREATE DATABASE "{database_name}"'))
    admin_engine.dispose()


def _build_engine() -> Engine:
    if USE_POSTGRESQL:
        assert TEST_DATABASE_URL is not None
        _ensure_postgresql_test_database(TEST_DATABASE_URL)
        return create_engine(TEST_DATABASE_URL, pool_pre_ping=True)

    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


engine = _build_engine()
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_engine() -> Generator[Engine, None, None]:
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(db_engine: Engine) -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="session", autouse=True)
def report_test_database_backend() -> Generator[None, None, None]:
    backend = "PostgreSQL" if USE_POSTGRESQL else "SQLite (in-memory)"
    print(f"\n[pytest] RT-01 tests running against: {backend}")
    if USE_POSTGRESQL:
        print(f"[pytest] TEST_DATABASE_URL={TEST_DATABASE_URL}")
    yield
