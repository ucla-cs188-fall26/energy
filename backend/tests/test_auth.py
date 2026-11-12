import httpx
import pytest
from fastapi.testclient import TestClient

from energy_api.core.auth import get_auth_client
from energy_api.core.config import Settings, get_settings
from energy_api.main import app

USER_ID = "a2b8c168-ff6b-4a2b-a9cb-3bc284bf5908"


@pytest.fixture
def auth_client():
    calls = []
    state = {"status": 200, "body": {
        "id": USER_ID, "email": "user@example.com", "role": "authenticated",
        "user_metadata": {"private": "not returned"},
    }}

    def handler(request):
        calls.append(request)
        assert str(request.url) == "https://example.supabase.co/auth/v1/user"
        assert request.headers["apikey"] == "sb_publishable_test"
        if state.get("timeout"):
            raise httpx.ReadTimeout("Timeout", request=request)
        return httpx.Response(state["status"], json=state["body"])

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
            yield client, state, calls
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Basic abc"}, {"Authorization": "Bearer"}])
def test_missing_token(auth_client, headers):
    client, _, calls = auth_client
    response = client.get("/users/me", headers=headers)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert calls == []


@pytest.mark.parametrize("status", [400, 401, 403, 422])
def test_invalid_or_expired_token(auth_client, status):
    client, state, calls = auth_client
    state.update(status=status, body={"message": "Sensitive upstream details"})
    response = client.get("/users/me", headers={"Authorization": "Bearer invalid-token"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Missing or invalid access token"}
    assert calls[0].headers["authorization"] == "Bearer invalid-token"


def test_valid_token(auth_client):
    client, _, calls = auth_client
    response = client.get("/users/me", headers={"Authorization": "Bearer valid-token"})
    assert response.status_code == 200
    assert response.json() == {"id": USER_ID, "email": "user@example.com"}
    assert calls[0].headers["authorization"] == "Bearer valid-token"


@pytest.mark.parametrize("body", [
    {"id": USER_ID, "email": "user@example.com", "role": "service_role"},
    {"id": USER_ID, "email": "user@example.com", "role": "authenticated", "is_anonymous": True},
])
def test_reject_non_user_tokens(auth_client, body):
    client, state, _ = auth_client
    state["body"] = body
    assert client.get("/users/me", headers={"Authorization": "Bearer token"}).status_code == 401


@pytest.mark.parametrize("failure", ["timeout", "server", "malformed"])
def test_upstream_failure(auth_client, failure):
    client, state, _ = auth_client
    if failure == "timeout":
        state["timeout"] = True
    elif failure == "server":
        state["status"] = 500
    else:
        state["body"] = {"role": "authenticated", "id": "invalid"}
    response = client.get("/users/me", headers={"Authorization": "Bearer token"})
    assert response.status_code == 503


def test_missing_configuration(auth_client):
    client, _, calls = auth_client
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, SUPABASE_URL=None, SUPABASE_PUBLISHABLE_KEY=None,
    )
    assert client.get("/users/me", headers={"Authorization": "Bearer token"}).status_code == 503
    assert calls == []


def test_expo_web_preflight(auth_client):
    client, _, calls = auth_client
    response = client.options("/users/me", headers={
        "Origin": "http://localhost:8081",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"
    assert calls == []
