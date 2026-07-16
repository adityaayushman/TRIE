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


def test_concurrent_vehicles_get_independent_temporal_trends(client):
    """Regression: the API holds one process-wide pipeline for every vehicle,
    and its temporal engine used to keep a single shared risk history. Two
    vehicles reporting interleaved would blend into one meaningless trend.
    Unique vehicle_ids per test avoid collision with the session-shared
    pipeline's state from other tests.
    """
    escalating, calming = "VEH-TEMPORAL-UP", "VEH-TEMPORAL-DOWN"

    assess(client, escalating, speed_kmh=20)
    assess(client, calming, speed_kmh=110)
    assess(client, escalating, speed_kmh=60)
    rising = assess(client, escalating, speed_kmh=110)
    falling = assess(client, calming, speed_kmh=20)

    assert rising["future_risk_score"] > rising["risk_score"], (
        "the escalating vehicle's own trend must read as rising"
    )
    assert falling["future_risk_score"] < falling["risk_score"], (
        "the calming vehicle's own trend must read as falling, "
        "not diluted by the other vehicle's history"
    )


def test_road_damage_detections_reach_the_assess_response(client, dangerous_scene):
    """Real-time road hazard detail (potholes/cracks/waterlogging), computed
    by ai/road_intelligence/ but previously discarded after only its scalar
    contribution to contributing_factors reached the client."""
    posted = assess(client, "VEH-ROAD-HAZARD", speed_kmh=60)

    assert posted["potholes"] == [{"label": "pothole", "confidence": 0.7, "bbox": [0.4, 0.6, 0.5, 0.7]}]
    assert posted["cracks"] == [{"label": "crack", "confidence": 0.6, "bbox": [0.2, 0.55, 0.6, 0.58]}]
    assert posted["is_waterlogged"] is False
    assert posted["surface_quality_score"] == 0.35


def test_road_damage_detections_are_broadcast_live(client, dangerous_scene):
    """The whole point: a dashboard connected to /alerts/ws sees pothole
    detections the moment they happen, not only in a later GET."""
    with client.websocket_connect("/api/v1/alerts/ws") as websocket:
        posted = assess(client, "VEH-ROAD-HAZARD-WS", speed_kmh=60)
        broadcast = websocket.receive_json()

    assert broadcast["potholes"] == posted["potholes"]
    assert broadcast["cracks"] == posted["cracks"]


def test_a_clean_road_reports_no_hazards(client):
    """The default fake (a good surface) must not fabricate damage."""
    posted = assess(client, "VEH-CLEAN-ROAD", speed_kmh=60)

    assert posted["potholes"] == []
    assert posted["cracks"] == []
    assert posted["is_waterlogged"] is False
