"""Tests for authentication and the public-read / authenticated-write split.

The split is the design: a reviewer must be able to inspect the dashboard
without an account, but POST /risk/assess appends to a shared database on a
public URL, so it needs one.
"""
from __future__ import annotations

import pytest

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
ME = "/api/v1/auth/me"
ASSESS = "/api/v1/risk/assess"
EVENTS = "/api/v1/risk/events"
BLACKSPOTS = "/api/v1/risk/blackspots"

VALID = {"email": "driver@fleet.example", "password": "correct-horse-battery", "organisation": "Fleet"}


def register(client, **overrides) -> str:
    """Register and return the access token."""
    response = client.post(REGISTER, json={**VALID, **overrides})
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class TestReadsStayPublic:
    """Anonymous reads are deliberate, not an oversight."""

    def test_events_needs_no_account(self, client):
        assert client.get(EVENTS).status_code == 200

    def test_blackspots_needs_no_account(self, client):
        assert client.get(BLACKSPOTS).status_code == 200

    def test_health_needs_no_account(self, client):
        assert client.get("/api/v1/health").status_code == 200


class TestWritesRequireAnAccount:
    def test_anonymous_assessment_is_rejected(self, client):
        assert client.post(ASSESS, json={"vehicle_id": "V1", "speed_kmh": 95}).status_code == 401

    def test_a_signed_in_account_may_assess(self, client):
        token = register(client)
        response = client.post(
            ASSESS, json={"vehicle_id": "V1", "speed_kmh": 95}, headers=auth(token)
        )
        assert response.status_code == 200
        assert response.json()["risk_score"] > 0

    def test_a_garbage_token_is_401_not_500(self, client):
        response = client.post(
            ASSESS, json={"vehicle_id": "V1", "speed_kmh": 95}, headers=auth("not.a.token")
        )
        assert response.status_code == 401

    def test_a_token_whose_subject_is_not_a_uuid_is_401_not_500(self, client):
        """A correctly-signed token can still carry a nonsense subject; that
        must read as unauthorised, not crash the route."""
        from app.auth.security import create_access_token

        response = client.post(
            ASSESS,
            json={"vehicle_id": "V1", "speed_kmh": 95},
            headers=auth(create_access_token("not-a-uuid")),
        )
        assert response.status_code == 401


class TestRegistration:
    def test_registering_returns_a_usable_token(self, client):
        token = register(client)
        assert client.get(ME, headers=auth(token)).json()["email"] == VALID["email"]

    def test_a_duplicate_email_is_rejected(self, client):
        register(client)
        assert client.post(REGISTER, json=VALID).status_code == 409

    def test_a_short_password_is_rejected(self, client):
        assert client.post(REGISTER, json={**VALID, "password": "short"}).status_code == 422

    def test_a_password_past_bcrypts_limit_is_rejected_not_truncated(self, client):
        """bcrypt silently ignores everything past 72 bytes, so a longer
        password would appear to work while most of it did nothing."""
        response = client.post(REGISTER, json={**VALID, "password": "a" * 100})
        assert response.status_code == 422

    def test_an_invalid_email_is_rejected(self, client):
        assert client.post(REGISTER, json={**VALID, "email": "not-an-email"}).status_code == 422

    def test_the_password_is_never_returned(self, client):
        response = client.post(REGISTER, json=VALID)
        assert "password" not in response.text
        assert "password_hash" not in response.text


class TestLogin:
    def test_correct_credentials_return_a_token(self, client):
        register(client)
        response = client.post(LOGIN, json={"email": VALID["email"], "password": VALID["password"]})
        assert response.status_code == 200
        assert client.get(ME, headers=auth(response.json()["access_token"])).status_code == 200

    def test_login_does_not_reveal_whether_an_account_exists(self, client):
        """Wrong password and unknown account must be indistinguishable, or
        this route becomes an account-enumeration oracle."""
        register(client)

        wrong_password = client.post(LOGIN, json={"email": VALID["email"], "password": "wrong-password"})
        unknown_account = client.post(LOGIN, json={"email": "nobody@example.com", "password": "wrong-password"})

        assert wrong_password.status_code == unknown_account.status_code == 401
        assert wrong_password.json() == unknown_account.json()


class TestMe:
    def test_anonymous_is_rejected(self, client):
        assert client.get(ME).status_code == 401

    def test_returns_the_signed_in_account(self, client):
        token = register(client, organisation="IIIT")
        body = client.get(ME, headers=auth(token)).json()
        assert body["email"] == VALID["email"]
        assert body["organisation"] == "IIIT"


class TestPasswordHashing:
    def test_passwords_are_hashed_not_stored(self, client):
        from app.auth.security import hash_password, verify_password

        hashed = hash_password("correct-horse-battery")
        assert hashed != "correct-horse-battery"
        assert verify_password("correct-horse-battery", hashed)
        assert not verify_password("wrong", hashed)

    def test_the_same_password_hashes_differently_each_time(self):
        """Distinct salts: two accounts with the same password must not share
        a hash, or one crack would reveal both."""
        from app.auth.security import hash_password

        assert hash_password("same-password-twice") != hash_password("same-password-twice")

    def test_a_malformed_hash_reads_as_wrong_password(self):
        """Never a 500 out of the login route."""
        from app.auth.security import verify_password

        assert not verify_password("anything", "not-a-bcrypt-hash")


class TestSecretKey:
    def test_no_hardcoded_default_secret_ships(self):
        """A constant fallback would be committed to a public repo and could
        sign valid tokens against any deployment that forgot to override it.
        Two fresh Settings must therefore disagree."""
        from app.core.config import Settings

        assert Settings().secret_key != Settings().secret_key
