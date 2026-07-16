"""FastAPI dependencies for authentication."""
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import AuthError, decode_access_token
from app.db.session import get_db
from app.models.user import User

# auto_error=False so an anonymous request reaches the route rather than being
# rejected here — reads are public, and only the routes that write depend on
# `current_user`.
_bearer = HTTPBearer(auto_error=False)

_UNAUTHORISED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Sign in to run assessments",
    headers={"WWW-Authenticate": "Bearer"},
)


async def optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """The signed-in user, or None. Never raises: for routes that behave
    differently when signed in but do not require it."""
    if credentials is None:
        return None
    try:
        subject = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(subject)
    except (AuthError, ValueError):
        return None
    return await db.get(User, user_id)


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """The signed-in user, or 401. For routes that write."""
    if credentials is None:
        raise _UNAUTHORISED
    try:
        subject = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(subject)
    except (AuthError, ValueError) as exc:
        # A token that decodes but carries a non-UUID subject is as invalid as
        # a forged one; both collapse to the same 401 rather than a 500.
        raise _UNAUTHORISED from exc

    user = await db.get(User, user_id)
    if user is None:
        # Correctly-signed token for an account that no longer exists.
        raise _UNAUTHORISED
    return user


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()
