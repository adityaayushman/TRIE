"""Tests for GPS ingress and the black-spot endpoint.

The engine itself is covered in test_blackspot.py; these cover the path from a
posted GPS fix through persistence to a nomination.
"""
from __future__ import annotations

BLACKSPOTS = "/api/v1/risk/blackspots"
ASSESS = "/api/v1/risk/assess"
EVENTS = "/api/v1/risk/events"

# A stretch of NH48 near Gurugram.
LAT, LON = 28.4595, 77.0266


def assess(client, vehicle_id="VEH-001", **telemetry):
    response = client.post(ASSESS, json={"vehicle_id": vehicle_id, **telemetry})
    assert response.status_code == 200, response.text
    return response.json()


def drive_past(client, count, *, speed_kmh, lat=LAT, lon=LON):
    """`count` distinct vehicles each passing the same point once."""
    for index in range(count):
        assess(client, vehicle_id=f"VEH-{index}", speed_kmh=speed_kmh, latitude=lat, longitude=lon)


class TestGpsIngress:
    def test_a_fix_is_persisted_and_returned(self, client):
        posted = assess(client, speed_kmh=95, latitude=LAT, longitude=LON)
        assert posted["latitude"] == LAT
        assert posted["longitude"] == LON

        [stored] = client.get(EVENTS).json()
        assert (stored["latitude"], stored["longitude"]) == (LAT, LON)

    def test_a_vehicle_without_gps_is_still_assessed(self, client):
        """No fix must not mean no risk warning — it only means no black-spot
        evidence."""
        posted = assess(client, speed_kmh=95)

        assert posted["risk_score"] > 0
        assert posted["latitude"] is None

    def test_the_live_broadcast_carries_the_fix(self, client):
        with client.websocket_connect("/api/v1/alerts/ws") as websocket:
            posted = assess(client, speed_kmh=95, latitude=LAT, longitude=LON)
            assert websocket.receive_json() == posted

    def test_an_impossible_latitude_is_rejected(self, client):
        response = client.post(
            ASSESS, json={"vehicle_id": "VEH-1", "latitude": 91.0, "longitude": LON}
        )
        assert response.status_code == 422

    def test_an_impossible_longitude_is_rejected(self, client):
        response = client.post(
            ASSESS, json={"vehicle_id": "VEH-1", "latitude": LAT, "longitude": 181.0}
        )
        assert response.status_code == 422


class TestBlackSpotEndpoint:
    def test_no_telemetry_nominates_nothing(self, client):
        assert client.get(BLACKSPOTS).json() == []

    def test_a_dangerous_stretch_is_nominated(self, client, dangerous_scene):
        # Every vehicle speeds through the same point, so every pass is a
        # near-miss under the current speed-driven stub pipeline.
        drive_past(client, 40, speed_kmh=200)

        spots = client.get(BLACKSPOTS, params={"min_exposure": 30, "min_near_misses": 5}).json()

        [spot] = spots
        assert spot["exposure"] == 40
        assert spot["near_miss_count"] == 40
        assert spot["confidence"] > 0
        assert spot["dominant_cause"]

    def test_a_safe_stretch_is_not_nominated(self, client):
        drive_past(client, 40, speed_kmh=5)

        assert client.get(BLACKSPOTS, params={"min_exposure": 30}).json() == []

    def test_vehicles_without_gps_are_excluded(self, client):
        """Rows with no fix must not crash the aggregation or be counted."""
        for index in range(40):
            assess(client, vehicle_id=f"NOGPS-{index}", speed_kmh=200)

        assert client.get(BLACKSPOTS, params={"min_exposure": 1, "min_near_misses": 1}).json() == []

    def test_thin_evidence_is_not_nominated(self, client):
        drive_past(client, 3, speed_kmh=200)

        assert client.get(BLACKSPOTS, params={"min_exposure": 30}).json() == []

    def test_thresholds_are_tunable(self, client, dangerous_scene):
        drive_past(client, 3, speed_kmh=200)

        spots = client.get(BLACKSPOTS, params={"min_exposure": 3, "min_near_misses": 1}).json()

        assert len(spots) == 1
        assert spots[0]["exposure"] == 3

    def test_distinct_stretches_are_nominated_separately(self, client, dangerous_scene):
        drive_past(client, 30, speed_kmh=200)
        drive_past(client, 30, speed_kmh=200, lat=LAT + 0.05)  # ~5.5km away

        spots = client.get(BLACKSPOTS, params={"min_exposure": 30, "min_near_misses": 5}).json()

        assert len(spots) == 2

    def test_the_time_window_bounds_the_evidence(self, client, dangerous_scene):
        """Guards the naive/aware datetime boundary between SQLite and the
        engine as much as the filter itself."""
        drive_past(client, 30, speed_kmh=200)

        recent = client.get(BLACKSPOTS, params={"days": 1, "min_exposure": 30, "min_near_misses": 5})
        assert len(recent.json()) == 1, "just-posted telemetry must fall inside a 1-day window"

    def test_an_invalid_threshold_is_rejected(self, client):
        assert client.get(BLACKSPOTS, params={"min_exposure": 0}).status_code == 422
        assert client.get(BLACKSPOTS, params={"cell_size_m": 0}).status_code == 422
        assert client.get(BLACKSPOTS, params={"days": 0}).status_code == 422

    def test_a_nomination_carries_its_intervention_route(self, client, dangerous_scene):
        """Each nomination must name the authority that can act on it."""
        drive_past(client, 40, speed_kmh=200)

        [spot] = client.get(BLACKSPOTS, params={"min_exposure": 30, "min_near_misses": 5}).json()

        assert spot["intervention"] in {"engineering", "enforcement", "education"}
        assert sum(spot["cause_breakdown"].values()) > 0


class TestNearMissLevel:
    """`near_miss_level` is load-bearing for a telemetry-only deployment: with
    no camera, speed is the only live factor and risk tops out around 35%, so
    at the HIGH default nothing the API records can ever qualify as a
    near-miss and no stretch is ever nominated."""

    def test_the_default_high_threshold_excludes_moderate_risk(self, client, moderate_scene):
        drive_past(client, 40, speed_kmh=200)

        spots = client.get(BLACKSPOTS, params={"min_exposure": 30, "min_near_misses": 5}).json()

        assert spots == [], "a moderate-risk pass must not count as a near-miss at the HIGH default"

    def test_lowering_the_level_lets_moderate_risk_nominate(self, client, moderate_scene):
        drive_past(client, 40, speed_kmh=200)

        spots = client.get(
            BLACKSPOTS,
            params={"min_exposure": 30, "min_near_misses": 5, "near_miss_level": "moderate"},
        ).json()

        assert len(spots) == 1
        assert spots[0]["near_miss_count"] == 40

    def test_an_invalid_level_is_rejected(self, client):
        assert client.get(BLACKSPOTS, params={"near_miss_level": "extreme"}).status_code == 422
