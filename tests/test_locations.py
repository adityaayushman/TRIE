"""Tests for multi-location scaling: registering a site, listing/filtering by
it, and a fixed camera inheriting its coordinates.

Locations are the identity multi-site deployments hang off — a name and a
reference point that risk events, history and black-spot discovery can all
be scoped to. Reads stay public (same design as everywhere else in this API);
creating one needs an account (same bar as submitting telemetry); deleting
one is admin-only (same bar as deleting a risk event).
"""
from __future__ import annotations

LOCATIONS = "/api/v1/locations"
REGISTER = "/api/v1/auth/register"
ASSESS = "/api/v1/risk/assess"
EVENTS = "/api/v1/risk/events"
BLACKSPOTS = "/api/v1/risk/blackspots"

VALID_USER = {"email": "operator@fleet.example", "password": "correct-horse-battery", "organisation": "Fleet"}
GURUGRAM = {"name": "NH48 Gurugram Junction", "description": "Test site", "latitude": 28.4595, "longitude": 77.0266}


def register(client, **overrides) -> dict:
    response = client.post(REGISTER, json={**VALID_USER, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class TestCreateLocation:
    def test_anonymous_create_is_rejected(self, client):
        assert client.post(LOCATIONS, json=GURUGRAM).status_code == 401

    def test_a_signed_in_account_may_register_a_site(self, client):
        token = register(client, email="a@fleet.example")["access_token"]
        response = client.post(LOCATIONS, json=GURUGRAM, headers=auth(token))
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["name"] == GURUGRAM["name"]
        assert body["latitude"] == GURUGRAM["latitude"]

    def test_a_name_is_required(self, client):
        token = register(client, email="b@fleet.example")["access_token"]
        bad = {**GURUGRAM, "name": ""}
        assert client.post(LOCATIONS, json=bad, headers=auth(token)).status_code == 422

    def test_an_impossible_latitude_is_rejected(self, client):
        token = register(client, email="c@fleet.example")["access_token"]
        bad = {**GURUGRAM, "latitude": 999}
        assert client.post(LOCATIONS, json=bad, headers=auth(token)).status_code == 422


class TestListAndGet:
    def test_list_needs_no_account(self, client):
        assert client.get(LOCATIONS).status_code == 200

    def test_a_registered_site_appears_in_the_list(self, client):
        token = register(client, email="d@fleet.example")["access_token"]
        client.post(LOCATIONS, json=GURUGRAM, headers=auth(token))
        names = [loc["name"] for loc in client.get(LOCATIONS).json()]
        assert GURUGRAM["name"] in names

    def test_a_fresh_site_has_a_zero_rollup(self, client):
        token = register(client, email="e@fleet.example")["access_token"]
        created = client.post(LOCATIONS, json=GURUGRAM, headers=auth(token)).json()
        detail = client.get(f"{LOCATIONS}/{created['id']}").json()
        assert detail["event_count"] == 0
        assert detail["latest_risk_score"] is None

    def test_get_an_unknown_id_is_404(self, client):
        assert client.get(f"{LOCATIONS}/00000000-0000-0000-0000-000000000000").status_code == 404


class TestAssessWithLocation:
    def test_an_unknown_location_id_is_404(self, client):
        token = register(client, email="f@fleet.example")["access_token"]
        response = client.post(
            ASSESS,
            json={"vehicle_id": "V1", "speed_kmh": 50, "location_id": "00000000-0000-0000-0000-000000000000"},
            headers=auth(token),
        )
        assert response.status_code == 404

    def test_a_camera_with_no_gps_inherits_the_sites_coordinates(self, client):
        token = register(client, email="g@fleet.example")["access_token"]
        loc = client.post(LOCATIONS, json=GURUGRAM, headers=auth(token)).json()
        response = client.post(
            ASSESS,
            json={"vehicle_id": "CAM-1", "speed_kmh": 40, "location_id": loc["id"]},
            headers=auth(token),
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["latitude"] == GURUGRAM["latitude"]
        assert body["longitude"] == GURUGRAM["longitude"]
        assert body["location_id"] == loc["id"]

    def test_an_explicit_gps_fix_is_not_overridden_by_the_site(self, client):
        token = register(client, email="h@fleet.example")["access_token"]
        loc = client.post(LOCATIONS, json=GURUGRAM, headers=auth(token)).json()
        response = client.post(
            ASSESS,
            json={
                "vehicle_id": "CAM-2",
                "speed_kmh": 40,
                "location_id": loc["id"],
                "latitude": 12.9,
                "longitude": 77.6,
            },
            headers=auth(token),
        )
        body = response.json()
        assert body["latitude"] == 12.9
        assert body["longitude"] == 77.6

    def test_rollup_reflects_a_real_assessment(self, client):
        token = register(client, email="i@fleet.example")["access_token"]
        loc = client.post(LOCATIONS, json=GURUGRAM, headers=auth(token)).json()
        client.post(ASSESS, json={"vehicle_id": "CAM-3", "speed_kmh": 60, "location_id": loc["id"]}, headers=auth(token))
        detail = client.get(f"{LOCATIONS}/{loc['id']}").json()
        assert detail["event_count"] == 1
        assert detail["latest_risk_score"] is not None
        assert detail["latest_risk_level"] is not None


class TestFilteringByLocation:
    def test_events_can_be_scoped_to_one_site(self, client):
        token = register(client, email="j@fleet.example")["access_token"]
        loc_a = client.post(LOCATIONS, json=GURUGRAM, headers=auth(token)).json()
        loc_b = client.post(
            LOCATIONS, json={**GURUGRAM, "name": "Second Site"}, headers=auth(token)
        ).json()
        client.post(ASSESS, json={"vehicle_id": "A1", "speed_kmh": 50, "location_id": loc_a["id"]}, headers=auth(token))
        client.post(ASSESS, json={"vehicle_id": "B1", "speed_kmh": 50, "location_id": loc_b["id"]}, headers=auth(token))

        only_a = client.get(EVENTS, params={"location_id": loc_a["id"]}).json()
        assert all(e["location_id"] == loc_a["id"] for e in only_a)
        assert any(e["vehicle_id"] == "A1" for e in only_a)
        assert not any(e["vehicle_id"] == "B1" for e in only_a)

    def test_blackspots_accepts_a_location_filter_without_erroring(self, client):
        token = register(client, email="k@fleet.example")["access_token"]
        loc = client.post(LOCATIONS, json=GURUGRAM, headers=auth(token)).json()
        response = client.get(BLACKSPOTS, params={"location_id": loc["id"]})
        assert response.status_code == 200


class TestDeleteLocation:
    def test_anonymous_delete_is_rejected(self, client):
        assert client.delete(f"{LOCATIONS}/00000000-0000-0000-0000-000000000000").status_code == 401

    def test_an_operator_may_not_delete(self, client):
        token = register(client, email="l@fleet.example")["access_token"]
        loc = client.post(LOCATIONS, json=GURUGRAM, headers=auth(token)).json()
        response = client.delete(f"{LOCATIONS}/{loc['id']}", headers=auth(token))
        assert response.status_code == 403

    def test_deleting_a_referenced_location_nulls_out_events_not_deletes_them(self, client):
        # Requires an admin account, which needs TRIE_ADMIN_EMAILS — mirrors
        # tests/test_roles.py's admin_allowlisted fixture pattern inline here
        # since only this one test needs it.
        import json
        import os

        from app.core.config import get_settings

        admin_email = "admin-loc@fleet.example"
        os.environ["TRIE_ADMIN_EMAILS"] = json.dumps([admin_email])
        get_settings.cache_clear()
        try:
            admin_token = register(client, email=admin_email)["access_token"]
            loc = client.post(LOCATIONS, json=GURUGRAM, headers=auth(admin_token)).json()
            client.post(
                ASSESS, json={"vehicle_id": "DEL-1", "speed_kmh": 50, "location_id": loc["id"]}, headers=auth(admin_token)
            )
            response = client.delete(f"{LOCATIONS}/{loc['id']}", headers=auth(admin_token))
            assert response.status_code == 204

            # The event survives; it just no longer references a location.
            events = client.get(EVENTS, params={"limit": 50}).json()
            matching = [e for e in events if e["vehicle_id"] == "DEL-1"]
            assert len(matching) == 1
            assert matching[0]["location_id"] is None
        finally:
            os.environ.pop("TRIE_ADMIN_EMAILS", None)
            get_settings.cache_clear()
