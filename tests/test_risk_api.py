"""End-to-end tests for the risk API: assess -> persist -> broadcast -> read.

This is the contract the dashboard depends on (frontend/lib/useRiskStream.ts
seeds from GET /risk/events, then follows the /alerts/ws broadcast).
"""
from __future__ import annotations

ASSESS = "/api/v1/risk/assess"
EVENTS = "/api/v1/risk/events"
ALERTS_WS = "/api/v1/alerts/ws"

# Every field frontend/lib/types.ts RiskSnapshot renders.
SNAPSHOT_FIELDS = (
    "vehicle_id",
    "risk_score",
    "risk_level",
    "contributing_factors",
    "primary_cause",
    "secondary_causes",
    "predicted_event",
    "recommended_actions",
    "explanation",
)


def assess(client, vehicle_id="VEH-001", **telemetry):
    response = client.post(ASSESS, json={"vehicle_id": vehicle_id, **telemetry})
    assert response.status_code == 200, response.text
    return response.json()


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_assess_returns_a_complete_assessment(client):
    body = assess(client, speed_kmh=95, acceleration_ms2=1.2)

    for field in SNAPSHOT_FIELDS:
        assert field in body, f"missing {field}"
    assert body["vehicle_id"] == "VEH-001"
    assert 0 <= body["risk_score"] <= 100
    assert body["risk_level"] in {"low", "moderate", "high", "critical"}
    assert body["recommended_actions"]
    assert body["explanation"]


def test_assess_broadcasts_to_a_connected_websocket(client):
    """A dashboard connected to /alerts/ws sees assessments as they happen."""
    with client.websocket_connect(ALERTS_WS) as websocket:
        body = assess(client, speed_kmh=95)
        assert websocket.receive_json() == body


def test_assess_persists_every_field_the_dashboard_renders(client):
    """Regression: secondary_causes and explanation were produced by the
    pipeline and broadcast live, but not persisted — so a dashboard reload
    hydrated them as missing."""
    posted = assess(client, speed_kmh=95)

    [stored] = client.get(EVENTS).json()
    for field in SNAPSHOT_FIELDS:
        assert stored[field] == posted[field], f"{field} did not survive persistence"
    assert stored["secondary_causes"]
    assert stored["explanation"]


def test_events_is_empty_before_any_assessment(client):
    assert client.get(EVENTS).json() == []


def test_events_returns_most_recent_first(client):
    assess(client, vehicle_id="VEH-001")
    assess(client, vehicle_id="VEH-002")

    events = client.get(EVENTS).json()
    assert [event["vehicle_id"] for event in events] == ["VEH-002", "VEH-001"]


def test_events_respects_limit(client):
    for index in range(3):
        assess(client, vehicle_id=f"VEH-{index}")

    assert len(client.get(EVENTS, params={"limit": 2}).json()) == 2


def test_assess_requires_a_vehicle_id(client):
    assert client.post(ASSESS, json={"speed_kmh": 95}).status_code == 422
