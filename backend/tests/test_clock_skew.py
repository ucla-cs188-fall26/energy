"""A device clock slightly ahead of the server must not turn "now" into a rejected future time."""
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from energy_api.core.auth import get_auth_client
from energy_api.core.clock import CLOCK_SKEW_TOLERANCE, not_future
from energy_api.core.config import get_settings
from energy_api.main import app
from energy_api.services.caffeine.logs import get_caffeine_now
from energy_api.services.energy.checkins import get_energy_now
from energy_api.services.naps.sessions import get_nap_now
from energy_api.services.sleep.sessions import get_sleep_now
from .helpers import make_settings
from .test_naps import USER

NOW = datetime(2026, 11, 14, 8, tzinfo=timezone.utc)
AHEAD = '2026-11-14T08:00:02Z'  # two seconds ahead of the server
TOO_FAR = '2026-11-14T08:01:01Z'  # beyond the tolerance
HEADERS = {'Authorization': 'Bearer synthetic'}
ROW_ID = 'b541e1e0-5be4-4193-836b-a151a732538c'
STAMPS = {'created_at': '2026-11-14T08:00:00Z', 'updated_at': '2026-11-14T08:00:00Z'}


def test_not_future_clamps_only_small_skew():
    assert not_future(NOW - timedelta(hours=1), NOW) == NOW - timedelta(hours=1)
    assert not_future(NOW, NOW) == NOW
    assert not_future(NOW + timedelta(seconds=2), NOW) == NOW
    assert not_future(NOW + CLOCK_SKEW_TOLERANCE, NOW) == NOW
    later = NOW + CLOCK_SKEW_TOLERANCE + timedelta(seconds=1)
    assert not_future(later, NOW) == later


@pytest.fixture
def api():
    writes = []

    def handler(request):
        if request.url.path == '/auth/v1/user':
            return httpx.Response(200, json={'id': USER, 'email': 'demo@example.invalid', 'role': 'authenticated'})
        table = request.url.path.rsplit('/', 1)[-1]
        if request.method == 'GET':  # the active session being stopped
            return httpx.Response(200, json=[{'id': ROW_ID, 'user_id': USER, 'started_at': '2026-11-14T00:00:00Z',
                'ended_at': None, 'duration_seconds': None, 'sleep_quality': None, 'refreshed_rating': None, **STAMPS}])
        body = json.loads(request.content)
        writes.append((table, body))
        row = {'id': ROW_ID, 'user_id': USER, **STAMPS, **body}
        if table.endswith('_sessions'):
            row = {'started_at': '2026-11-14T00:00:00Z', 'ended_at': None, 'duration_seconds': None,
                   'sleep_quality': None, 'refreshed_rating': None, **row}
        if table == 'caffeine_logs':
            row = {'beverage_name': 'Coffee', 'caffeine_mg': 95, 'serving_size_ml': 237,
                   'logging_method': 'manual', **row}
        return httpx.Response(200, json=[row])

    async def client():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            yield c
    app.dependency_overrides[get_auth_client] = client
    app.dependency_overrides[get_settings] = make_settings
    for dependency in (get_caffeine_now, get_energy_now, get_nap_now, get_sleep_now):
        app.dependency_overrides[dependency] = lambda: NOW
    try:
        with TestClient(app) as c:
            yield c, writes
    finally:
        app.dependency_overrides.clear()


def drink(consumed_at):
    return {'beverage_name': 'Coffee', 'caffeine_mg': 95, 'serving_size_ml': 237, 'consumed_at': consumed_at}


def nap(ended_at, started_at='2026-11-14T07:40:00Z'):
    return {'started_at': started_at, 'ended_at': ended_at}


@pytest.mark.parametrize('method, path, body, field', [
    ('post', '/caffeine/logs', drink(AHEAD), 'consumed_at'),
    ('put', f'/caffeine/logs/{ROW_ID}', {'consumed_at': AHEAD}, 'consumed_at'),
    ('post', '/energy/checkins', {'energy_rating': 7, 'recorded_at': AHEAD}, 'recorded_at'),
    ('post', '/naps/sessions/log', nap(AHEAD), 'ended_at'),
    ('post', '/naps/sessions/start', {'started_at': AHEAD}, 'started_at'),
    ('post', f'/naps/sessions/{ROW_ID}/stop', {'ended_at': AHEAD}, 'ended_at'),
    ('post', '/sleep/sessions/start', {'started_at': AHEAD}, 'started_at'),
    ('post', f'/sleep/sessions/{ROW_ID}/stop', {'ended_at': AHEAD}, 'ended_at'),
])
def test_small_skew_is_stored_as_server_now(api, method, path, body, field):
    c, writes = api
    response = getattr(c, method)(path, headers=HEADERS, json=body)
    assert response.status_code in (200, 201), response.text
    assert len(writes) == 1
    assert datetime.fromisoformat(writes[0][1][field]) == NOW


@pytest.mark.parametrize('method, path, body', [
    ('post', '/caffeine/logs', drink(TOO_FAR)),
    ('post', '/energy/checkins', {'energy_rating': 7, 'recorded_at': TOO_FAR}),
    ('post', '/naps/sessions/log', nap(TOO_FAR)),
    ('post', '/sleep/sessions/start', {'started_at': TOO_FAR}),
    # Both ends inside the tolerance collapse to the same instant: not a valid nap.
    ('post', '/naps/sessions/log', nap(AHEAD, started_at='2026-11-14T08:00:01Z')),
])
def test_real_future_times_are_still_rejected(api, method, path, body):
    c, writes = api
    assert getattr(c, method)(path, headers=HEADERS, json=body).status_code == 422
    assert not writes
