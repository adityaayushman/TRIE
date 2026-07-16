from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import current_user, get_user_by_email
from app.auth.security import AuthError, create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Incorrect email or password",
)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Create an account and sign in.

    Reads stay public throughout the API — only writing telemetry needs this.
    """
    if await get_user_by_email(db, request.email) is not None:
        # Registration necessarily reveals that an address is taken; there is
        # no way to offer "pick an email" without it. Login does not leak the
        # same fact (see _INVALID_CREDENTIALS).
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="That email is already registered"
        )

    try:
        password_hash = hash_password(request.password)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    user = User(
        email=request.email, password_hash=password_hash, organisation=request.organisation
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(str(user.id)), user=UserRead.model_validate(user)
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await get_user_by_email(db, request.email)

    # Same error whether the account is absent or the password is wrong, so
    # this route cannot be used to enumerate registered addresses.
    if user is None or not verify_password(request.password, user.password_hash):
        raise _INVALID_CREDENTIALS

    return TokenResponse(
        access_token=create_access_token(str(user.id)), user=UserRead.model_validate(user)
    )


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(current_user)) -> User:
    """Who the bearer token belongs to. The frontend calls this on load to
    decide whether a stored token is still good."""
    return user
