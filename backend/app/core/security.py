"""Password hashing and verification utilities.

These helpers are intentionally decoupled from models, schemas and HTTP
endpoints so they can be reused by future registration and login flows.
Plaintext passwords must never be persisted or written to logs.
"""

import bcrypt


def hash_password(plain_password: str) -> str:
    """Return a salted bcrypt hash for the given plaintext password."""
    password_bytes = plain_password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Return True when plaintext matches the stored bcrypt hash."""
    password_bytes = plain_password.encode("utf-8")
    hash_bytes = password_hash.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hash_bytes)
