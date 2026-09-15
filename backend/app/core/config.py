import secrets
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="TRIE_")

    app_name: str = "Smart Road Guardian AI X"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://trie:trie@localhost:5432/trie"
    cors_origins: list[str] = ["http://localhost:3000"]

    secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    """Signing key for JWTs.

    Defaults to a fresh random value *per process* rather than a constant:
    a hardcoded fallback would be committed to a public repo and could sign
    valid tokens against any deployment that forgot to override it. The cost
    of this default is that tokens do not survive a restart, which is correct
    for local development and unacceptable in production — so deployments set
    TRIE_SECRET_KEY explicitly (render.yaml generates one per service).
    """

    vapid_public_key: str = ""
    """Web Push VAPID public key (base64url, uncompressed EC point) — sent to
    the frontend so it can subscribe. Empty disables push alerts entirely
    (POST /alerts/subscribe 503s) rather than silently no-op, so a missing
    deployment secret is loud, not a quiet feature gap.
    """
    vapid_private_key_b64: str = ""
    """The matching private key, PEM-encoded then base64'd (so one env var
    holds it without embedding raw newlines). Never logged, never returned by
    any endpoint. Generate a pair with `python -m app.vapid_keys` and set both
    halves together — they are one keypair, not two independent secrets.
    """
    vapid_subject: str = "mailto:trie-alerts@example.com"
    """Contact URI push services may use if a subscription is abused. Not a
    secret; safe to commit a placeholder and override per deployment.
    """

    admin_emails: list[str] = []
    """Email addresses granted the "admin" role at registration time (see
    app/models/user.py). Same convention as cors_origins: a JSON array string
    in the env var, e.g. TRIE_ADMIN_EMAILS='["a@x.com","b@y.com"]'. Empty means
    no one is an admin, which is the safe default — a deployment that forgets
    to set this simply has no admin-only actions available, rather than an
    open one.
    """

    @field_validator("database_url")
    @classmethod
    def _use_asyncpg_driver(cls, value: str) -> str:
        """Managed Postgres hosts (Render, Heroku, Railway, ...) inject a bare
        postgresql:// (or the older postgres://) URL, but the async engine
        needs the +asyncpg dialect explicit in the scheme. Normalizing here
        means deploying to one of them needs no hand-edited connection string.
        """
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+asyncpg://" + value[len(prefix):]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
