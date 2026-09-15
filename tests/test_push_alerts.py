"""Tests for the real Web Push alerting loop.

Covers the HTTP surface (subscribe/unsubscribe/public-key) end to end against
the test app. `app/services/push.py`'s actual delivery (calling out to a real
push service) is exercised separately as a unit test with the network call
mocked — hitting a real FCM/autopush endpoint from CI would be neither
reliable nor meaningful without a real browser subscription.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

VAPID_KEY = "/api/v1/alerts/vapid-public-key"
SUBSCRIBE = "/api/v1/alerts/subscribe"
REGISTER = "/api/v1/auth/register"

VALID_USER = {"email": "rider@fleet.example", "password": "correct-horse-battery", "organisation": "Fleet"}
SUBSCRIPTION = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/example-endpoint-id",
    "keys": {"p256dh": "BExamplePublicKeyBExamplePublicKeyBExamplePublicKeyBExample", "auth": "exampleAuthSecret16B"},
}


def register(client, **overrides) -> str:
    response = client.post(REGISTER, json={**VALID_USER, **overrides})
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class TestVapidPublicKey:
    def test_needs_no_account(self, client):
        assert client.get(VAPID_KEY).status_code == 200

    def test_reports_disabled_with_no_keypair_configured(self, client):
        # The test environment sets no TRIE_VAPID_* keys — a deployment
        # without them must report itself unavailable, not error.
        body = client.get(VAPID_KEY).json()
        assert body["enabled"] is False
        assert body["public_key"] == ""


class TestSubscribe:
    def test_anonymous_subscribe_is_rejected(self, client):
        assert client.post(SUBSCRIBE, json=SUBSCRIPTION).status_code == 401

    def test_a_signed_in_account_may_subscribe(self, client):
        token = register(client, email="a@fleet.example")
        response = client.post(SUBSCRIBE, json=SUBSCRIPTION, headers=auth(token))
        assert response.status_code == 204

    def test_resubscribing_the_same_endpoint_upserts_not_duplicates(self, client):
        token = register(client, email="b@fleet.example")
        first = client.post(SUBSCRIBE, json=SUBSCRIPTION, headers=auth(token))
        assert first.status_code == 204
        rotated = {**SUBSCRIPTION, "keys": {"p256dh": "rotated-key", "auth": "rotated-auth"}}
        second = client.post(SUBSCRIBE, json=rotated, headers=auth(token))
        assert second.status_code == 204  # no unique-constraint conflict

    def test_unsubscribe_requires_an_account(self, client):
        response = client.delete(SUBSCRIBE, params={"endpoint": SUBSCRIPTION["endpoint"]})
        assert response.status_code == 401

    def test_subscribe_then_unsubscribe_round_trips(self, client):
        token = register(client, email="c@fleet.example")
        client.post(SUBSCRIBE, json=SUBSCRIPTION, headers=auth(token))
        response = client.delete(SUBSCRIBE, params={"endpoint": SUBSCRIPTION["endpoint"]}, headers=auth(token))
        assert response.status_code == 204

    def test_unsubscribing_an_unknown_endpoint_is_a_harmless_no_op(self, client):
        token = register(client, email="d@fleet.example")
        response = client.delete(SUBSCRIBE, params={"endpoint": "https://never-subscribed.example/x"}, headers=auth(token))
        assert response.status_code == 204


class TestSendHighRiskAlert:
    """Unit-level: app/services/push.py's own gating logic, network mocked.

    No pytest-asyncio in this suite (see conftest.py's plain `asyncio.run`
    pattern) — same approach here rather than adding a new test-infra
    dependency for three coroutines.
    """

    def test_no_ops_below_high_risk(self):
        import asyncio

        from app.services.push import send_high_risk_alert

        sent = asyncio.run(send_high_risk_alert(db=AsyncMock(), user_id="irrelevant", assessment={"risk_level": "moderate"}))
        assert sent == 0

    def test_no_ops_with_no_vapid_keypair_configured(self):
        import asyncio

        from app.services.push import send_high_risk_alert

        # The test environment's settings have no VAPID keys set by default.
        sent = asyncio.run(send_high_risk_alert(db=AsyncMock(), user_id="irrelevant", assessment={"risk_level": "high"}))
        assert sent == 0

    def test_delivers_to_every_subscription_when_configured(self):
        import asyncio

        from app.core.config import get_settings
        from app.services import push as push_module

        get_settings.cache_clear()
        try:
            with patch.object(
                push_module,
                "get_settings",
                return_value=type(
                    "S", (), {"vapid_public_key": "pk", "vapid_private_key_b64": _fake_private_key_b64(), "vapid_subject": "mailto:test@example.com"}
                )(),
            ):
                db = AsyncMock()
                fake_sub = type("Sub", (), {"id": "sub-1", "endpoint": "https://example.com/ep", "p256dh": "k", "auth": "a"})()
                # SQLAlchemy's awaited Result is sync from here (.scalars()/.all()
                # are ordinary methods on the object `await db.execute(...)`
                # resolves to) — only the execute() call itself is a coroutine.
                result = MagicMock()
                result.scalars.return_value.all.return_value = [fake_sub]
                db.execute.return_value = result
                with patch.object(push_module, "webpush") as mock_webpush:
                    sent = asyncio.run(
                        push_module.send_high_risk_alert(db, user_id="u1", assessment={"risk_level": "critical", "vehicle_id": "V1"})
                    )
            assert sent == 1
            mock_webpush.assert_called_once()
        finally:
            get_settings.cache_clear()


def _fake_private_key_b64() -> str:
    import base64

    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat

    key = ec.generate_private_key(ec.SECP256R1())
    pem = key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    return base64.b64encode(pem).decode()
