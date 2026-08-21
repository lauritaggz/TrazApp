from collections.abc import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db


def get_database_session(
    db: Session = Depends(get_db),
) -> Generator[Session, None, None]:
    """Expose the database session as an API-layer dependency."""
    yield db
