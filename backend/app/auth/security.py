"""Password hashing and JWT issuing/verification.

Deliberately small: bcrypt for hashing and PyJWT for tokens, with no
framework in between. The API has one role and no sessions — a token proves
"this request may write telemetry" and nothing more — so anything richer
would be unused surface.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=7)

# bcrypt truncates silently at 72 *bytes*, so a longer password would make
# everything past the cutoff meaningless while still appearing to work.
# Rejected outright rather than silently accepted.
MAX_PASSWORD_BYTES = 72
MIN_PASSWORD_LENGTH = 8


class AuthError(ValueError):
    """A credential could not be hashed, or a token could not be trusted."""


def hash_password(password: str) -> str:
    encoded = password.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        raise AuthError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    encoded = password.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        # Cannot be the password behind this hash: registration rejects these.
        return False
    try:
        return bcrypt.checkpw(encoded, password_hash.encode("utf-8"))
    except ValueError:
        # A malformed/legacy hash must read as "wrong password", never crash
        # the login route into a 500 that leaks which accounts exist.
        return False


def create_access_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": subject, "iat": now, "exp": now + TOKEN_TTL}
    return jwt.encode(payload, get_settings().secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str:
    """Return the subject (user id) of a valid token, or raise AuthError.

    Every PyJWT failure — expired, wrong signature, malformed — collapses to
    one error, so callers cannot accidentally tell a client *why* a token was
    rejected.
    """
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid or expired token") from exc

    subject = payload.get("sub")
    if not subject:
        raise AuthError("Token carries no subject")
    return subject
