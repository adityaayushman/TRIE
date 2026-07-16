import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.auth.security import MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH


class RegisterRequest(BaseModel):
    email: EmailStr
    # max_length guards bcrypt's silent 72-byte truncation. It counts
    # characters, not bytes, so a multi-byte password can still exceed the
    # limit — security.hash_password() does the byte-accurate check and is the
    # real gate; this one just gives a clean 422 for the common case.
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_BYTES)
    organisation: str = Field(default="", max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    organisation: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
