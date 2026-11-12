import json
from copy import deepcopy

import httpx
import pytest
from fastapi.testclient import TestClient

from energy_api.core.auth import get_auth_client
from energy_api.core.config import Settings, get_settings
from energy_api.main import app

USER_ID = "a2b8c168-ff6b-4a2b-a9cb-3bc284bf5908"
OTHER_ID = "311b169e-2609-4949-8031-d08adb491c41"
PREFERENCES = {
    "display_name": "Energy user", "usual_bedtime": "23:00:00",
    "usual_wake_time": "07:00:00", "sleep_goal_minutes": 480,
    "caffeine_frequency": "daily", "caffeine_sensitivity": "medium",
    "selected_side_effects": ["sleep_disruption", "stomach_upset"],
    "initial_energy_rating": 7,
}


def profile(**changes):
    return {
        "id": USER_ID, "display_name": None, "usual_bedtime": None,
        "usual_wake_time": None, "sleep_goal_minutes": None,
        "caffeine_frequency": None, "caffeine_sensitivity": None,
        "selected_side_effects": [], "initial_energy_rating": None,
        "preferences_completed": False,
        "created_at": "2026-11-11T00:00:00Z",
        "updated_at": "2026-11-11T00:00:00Z", **changes,
    }


@pytest.fixture
def api():
    state = {"row": None, "calls": [], "auth_status": 200}

    def handler(request):
        assert request.headers["apikey"] == "sb_publishable_test"
        if request.url.path == "/auth/v1/user":
            return httpx.Response(state["auth_status"], json={
                "id": USER_ID, "email": "user@example.com", "role": "authenticated",
            })
        assert request.url.path == "/rest/v1/user_profiles"
        assert request.headers["authorization"] == "Bearer test-session"
        state["calls"].append(request)
        if state.get("timeout"):
            raise httpx.ReadTimeout("Timeout", request=request)
        if "error_status" in state:
            return httpx.Response(state["error_status"], json={
                "code": state.get("error_code"), "message": "Private upstream details",
            })
        if "result" in state:
            return httpx.Response(200, json=state["result"])
        if request.method == "POST":
            body = json.loads(request.content)
            assert body["id"] == USER_ID
            assert request.url.params["on_conflict"] == "id"
            assert "resolution=merge-duplicates" in request.headers["prefer"]
            state["row"] = {**(state["row"] or profile()), **body}
        else:
            assert request.url.params["id"] == f"eq.{USER_ID}"
            if request.method == "PATCH" and state["row"]:
                body = json.loads(request.content)
                assert body == {"preferences_completed": True}
                state["row"].update(body)
        return httpx.Response(200, json=[state["row"]] if state["row"] else [])

    async def mock_client():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            yield client

    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, SUPABASE_URL="https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY="sb_publishable_test",
    )
    app.dependency_overrides[get_auth_client] = mock_client
    try:
        with TestClient(app) as client:
            yield client, state
    finally:
        app.dependency_overrides.clear()


HEADERS = {"Authorization": "Bearer test-session"}
ROUTES = [("GET", "/users/me/profile"), ("PUT", "/users/me/profile"),
          ("POST", "/users/me/preferences/complete")]


@pytest.mark.parametrize("method,path", ROUTES)
@pytest.mark.parametrize("invalid", [False, True])
def test_unauthorized(api, method, path, invalid):
    client, state = api
    state["auth_status"] = 401
    response = client.request(method, path, headers=HEADERS if invalid else {}, json={})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert not state["calls"]


def test_get_missing_profile(api):
    client, _ = api
    assert client.get("/users/me/profile", headers=HEADERS).status_code == 404


def test_create_get_update_and_complete(api):
    client, state = api
    response = client.put("/users/me/profile", headers=HEADERS, json=PREFERENCES)
    assert response.status_code == 200
    assert response.json() == profile(**PREFERENCES)
    assert client.get("/users/me/profile", headers=HEADERS).json() == response.json()
    response = client.put("/users/me/profile", headers=HEADERS, json={"display_name": "New name"})
    assert response.status_code == 200
    assert response.json()["display_name"] == "New name"
    assert response.json()["sleep_goal_minutes"] == 480
    assert response.json()["selected_side_effects"] == PREFERENCES["selected_side_effects"]
    assert not response.json()["preferences_completed"]
    response = client.post("/users/me/preferences/complete", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["preferences_completed"] is True
    assert client.post("/users/me/preferences/complete", headers=HEADERS).status_code == 200
    response = client.put("/users/me/profile", headers=HEADERS, json={"initial_energy_rating": 8})
    assert response.status_code == 200
    assert response.json()["preferences_completed"] is True


def test_draft_and_explicit_null(api):
    client, state = api
    assert client.put("/users/me/profile", headers=HEADERS, json={}).status_code == 200
    assert state["row"]["id"] == USER_ID
    assert client.put("/users/me/profile", headers=HEADERS, json={"display_name": "Name"}).status_code == 200
    assert client.put("/users/me/profile", headers=HEADERS, json={"display_name": None}).json()["display_name"] is None


@pytest.mark.parametrize("payload", [
    {"display_name": ""}, {"display_name": "   "}, {"display_name": " padded "},
    {"display_name": "a" * 81}, {"display_name": 123},
    {"sleep_goal_minutes": 0}, {"sleep_goal_minutes": 1441},
    {"sleep_goal_minutes": "480"}, {"sleep_goal_minutes": True},
    {"initial_energy_rating": 0}, {"initial_energy_rating": 11},
    {"initial_energy_rating": 5.5}, {"usual_bedtime": "25:00"},
    {"usual_wake_time": "07:00Z"}, {"usual_bedtime": 120},
    {"caffeine_frequency": "hourly"}, {"caffeine_sensitivity": "unknown"},
    {"selected_side_effects": ["unknown"]}, {"selected_side_effects": None},
    {"selected_side_effects": ["jitters", "jitters"]},
    {"id": OTHER_ID}, {"preferences_completed": True},
    {"created_at": "2026-01-01T00:00:00Z"}, {"onboarding_completed": True},
])
def test_invalid_preferences(api, payload):
    client, state = api
    assert client.put("/users/me/profile", headers=HEADERS, json=payload).status_code == 422
    assert not state["calls"]


@pytest.mark.parametrize("method,path", [ROUTES[0], ROUTES[2]])
def test_missing_row(api, method, path):
    client, _ = api
    assert client.request(method, path, headers=HEADERS).status_code == 404


@pytest.mark.parametrize("status,code,expected", [
    (401, "PGRST301", 401), (403, "42501", 403),
    (400, "23514", 422), (400, "23502", 422), (409, "23505", 409),
    (500, None, 503),
])
def test_database_errors_are_sanitized(api, status, code, expected):
    client, state = api
    state.update(error_status=status, error_code=code)
    response = client.post("/users/me/preferences/complete", headers=HEADERS)
    assert response.status_code == expected
    assert "Private upstream" not in response.text


def test_incomplete_completion_is_rejected_by_database(api):
    client, state = api
    state["row"] = profile()
    state.update(error_status=400, error_code="23514")
    response = client.post("/users/me/preferences/complete", headers=HEADERS)
    assert response.status_code == 422
    assert not state["row"]["preferences_completed"]


def test_timeout(api):
    client, state = api
    state["timeout"] = True
    assert client.get("/users/me/profile", headers=HEADERS).status_code == 503


@pytest.mark.parametrize("result", [[profile(id=OTHER_ID)], {}, [profile(), profile()], [{"id": USER_ID}]])
def test_unexpected_upstream_profile_is_not_exposed(api, result):
    client, state = api
    state["result"] = deepcopy(result)
    assert client.get("/users/me/profile", headers=HEADERS).status_code == 503


@pytest.mark.parametrize("method", ["PUT", "POST"])
def test_profile_cors_preflight(api, method):
    client, _ = api
    response = client.options("/users/me/profile", headers={
        "Origin": "http://localhost:8081", "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    assert response.status_code == 200
