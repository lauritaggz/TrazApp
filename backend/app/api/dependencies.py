from collections.abc import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.trazabilidad_repository import TrazabilidadRepository
from app.services.trazabilidad_service import TrazabilidadService


def get_database_session(db: Session = Depends(get_db)) -> Generator[Session, None, None]:
    yield db


def get_trazabilidad_service(db: Session = Depends(get_db)) -> TrazabilidadService:
    repository = TrazabilidadRepository(db)
    return TrazabilidadService(repository)
