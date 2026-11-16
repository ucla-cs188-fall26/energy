from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from energy_api.core.auth import get_auth_client
from energy_api.core.config import get_settings
from energy_api.main import app
from energy_api.services.naps.sessions import get_nap_now
from .helpers import make_settings
from .test_naps import USER


@pytest.fixture
def api():
    writes = []
    def handler(request):
        if request.url.path == '/auth/v1/user':
            if request.headers.get('authorization') != 'Bearer synthetic':
                return httpx.Response(401, json={})
            return httpx.Response(200, json={'id': USER, 'email': 'demo@example.invalid', 'role': 'authenticated'})
        import json
        body = json.loads(request.content)
        assert request.url.params['user_id'] == f'eq.{USER}'
        assert body['user_id'] == USER
        writes.append(body)
        return httpx.Response(201, json=[{'id': 'b541e1e0-5be4-4193-836b-a151a732538c',
            'duration_seconds': 1200, 'refreshed_rating': None, 'created_at': '2026-11-14T08:00:00Z',
            'updated_at': '2026-11-14T08:00:00Z', **body}])
    async def client():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            yield c
    app.dependency_overrides[get_auth_client] = client
    app.dependency_overrides[get_settings] = make_settings
    app.dependency_overrides[get_nap_now] = lambda: datetime(2026, 11, 14, 8, tzinfo=timezone.utc)
    try:
        with TestClient(app) as c:
            yield c, writes
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("rating", [None, 5])
def test_completed_nap_is_inserted_atomically(api, rating):
    c, writes = api
    response = c.post('/naps/sessions/log', headers={'Authorization': 'Bearer synthetic'},
        json={'started_at': '2026-11-14T07:00:00Z', 'ended_at': '2026-11-14T07:20:00Z', 'refreshed_rating': rating})
    assert response.status_code == 201
    assert response.json()['elapsed_seconds'] == 1200
    assert len(writes) == 1


@pytest.mark.parametrize('changes', [
    {'ended_at': '2026-11-14T09:00:00Z'}, {'ended_at': '2026-11-14T07:00:00Z'},
    {'refreshed_rating': 6}, {'started_at': '2026-11-14T07:00:00'}, {'user_id': USER},
])
def test_invalid_completed_naps_do_not_write(api, changes):
    c, writes = api
    response = c.post('/naps/sessions/log', headers={'Authorization': 'Bearer synthetic'}, json={
        'started_at': '2026-11-14T07:00:00Z', 'ended_at': '2026-11-14T07:20:00Z', **changes})
    assert response.status_code == 422
    assert not writes


def test_completed_nap_requires_authentication(api):
    c, writes = api
    assert c.post('/naps/sessions/log', json={}).status_code == 401
    assert not writes


def test_completed_nap_rejects_invalid_token(api):
    c, writes = api
    assert c.post('/naps/sessions/log', headers={'Authorization': 'Bearer invalid'}, json={
        'started_at': '2026-11-14T07:00:00Z', 'ended_at': '2026-11-14T07:20:00Z'}).status_code == 401
    assert not writes
