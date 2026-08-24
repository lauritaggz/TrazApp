"""Unit tests for password hashing and verification (T12-02)."""

from app.core.security import hash_password, verify_password


def test_hash_password_differs_from_plaintext() -> None:
    plain_password = "SecretoProductor123!"
    password_hash = hash_password(plain_password)

    assert password_hash != plain_password
    assert plain_password not in password_hash


def test_correct_password_verifies_against_hash() -> None:
    plain_password = "SecretoProductor123!"
    password_hash = hash_password(plain_password)

    assert verify_password(plain_password, password_hash) is True


def test_incorrect_password_does_not_verify() -> None:
    password_hash = hash_password("SecretoProductor123!")

    assert verify_password("password-incorrecta", password_hash) is False


def test_hashing_same_password_twice_produces_different_hashes() -> None:
    plain_password = "SecretoProductor123!"
    first_hash = hash_password(plain_password)
    second_hash = hash_password(plain_password)

    assert first_hash != second_hash
    assert verify_password(plain_password, first_hash) is True
    assert verify_password(plain_password, second_hash) is True
