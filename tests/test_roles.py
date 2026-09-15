"""Tests for role-based access: operator (default) vs admin.

Admin status is granted exactly once, at registration, from an email
allowlist (TRIE_ADMIN_EMAILS) — there is no promotion endpoint. It gates one
real action: DELETE /risk/events/{id}. Every read stays public regardless of
role, per this project's public-read design (see tests/test_auth.py).
"""
from __future__ import annotations

import json
import os

import pytest

REGISTER = "/api/v1/auth/register"
ASSESS = "/api/v1/risk/assess"

OPERATOR = {"email": "operator@fleet.example", "password": "correct-horse-battery"}
ADMIN_EMAIL = "chief@fleet.example"
ADMIN = {"email": ADMIN_EMAIL, "password": "correct-horse-battery"}


def register(client, **overrides) -> dict:
    response = client.post(REGISTER, json={**OPERATOR, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_allowlisted():
    """Grants ADMIN_EMAIL admin status for the duration of one test, by
    setting the env var app.core.config reads and clearing its lru_cache —
    the same mechanism a real deployment uses via Render's env vars."""
    from app.core.config import get_settings

    os.environ["TRIE_ADMIN_EMAILS"] = json.dumps([ADMIN_EMAIL])
    get_settings.cache_clear()
    yield
    os.environ.pop("TRIE_ADMIN_EMAILS", None)
    get_settings.cache_clear()


class TestRoleAssignment:
    def test_default_registration_is_an_operator(self, client):
        body = register(client, email="a@fleet.example")
        assert body["user"]["role"] == "operator"

    def test_an_allowlisted_email_registers_as_admin(self, client, admin_allowlisted):
        body = register(client, **ADMIN)
        assert body["user"]["role"] == "admin"

    def test_an_email_not_on_the_allowlist_is_still_an_operator(self, client, admin_allowlisted):
        body = register(client, email="not-the-admin@fleet.example")
        assert body["user"]["role"] == "operator"


class TestDeleteEndpoint:
    def _create_event_id(self, client, token: str) -> str:
        client.post(ASSESS, json={"vehicle_id": "V-DELETE-ME", "speed_kmh": 50}, headers=auth(token))
        events = client.get("/api/v1/risk/events", params={"limit": 1}).json()
        return events[0]["id"]

    def test_anonymous_delete_is_rejected(self, client):
        assert client.delete("/api/v1/risk/events/00000000-0000-0000-0000-000000000000").status_code == 401

    def test_an_operator_may_not_delete(self, client):
        body = register(client, email="op@fleet.example")
        event_id = self._create_event_id(client, body["access_token"])
        response = client.delete(f"/api/v1/risk/events/{event_id}", headers=auth(body["access_token"]))
        assert response.status_code == 403

    def test_an_admin_may_delete(self, client, admin_allowlisted):
        body = register(client, **ADMIN)
        event_id = self._create_event_id(client, body["access_token"])
        response = client.delete(f"/api/v1/risk/events/{event_id}", headers=auth(body["access_token"]))
        assert response.status_code == 204

    def test_deleting_removes_it_from_the_public_read(self, client, admin_allowlisted):
        body = register(client, **ADMIN)
        event_id = self._create_event_id(client, body["access_token"])
        client.delete(f"/api/v1/risk/events/{event_id}", headers=auth(body["access_token"]))
        ids = [e["id"] for e in client.get("/api/v1/risk/events", params={"limit": 50}).json()]
        assert event_id not in ids

    def test_deleting_an_unknown_id_is_404(self, client, admin_allowlisted):
        body = register(client, **ADMIN)
        response = client.delete(
            "/api/v1/risk/events/00000000-0000-0000-0000-000000000000", headers=auth(body["access_token"])
        )
        assert response.status_code == 404
