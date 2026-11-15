import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from energy_api.core.auth import get_auth_client
from energy_api.core.config import get_settings
from energy_api.main import app
from energy_api.services.energy.checkins import get_energy_now
from .helpers import make_settings

USER = 'a2b8c168-ff6b-4a2b-a9cb-3bc284bf5908'
OTHER = '311b169e-2609-4949-8031-d08adb491c41'
ID = 'b541e1e0-5be4-4193-836b-a151a732538c'
NOW = datetime(2026, 11, 15, 12, tzinfo=timezone.utc)
HEADERS = {'Authorization': 'Bearer test-session'}
BASE = '/energy/checkins'


def row(**changes: Any) -> dict[str, Any]:
    return {'id': ID, 'user_id': USER, 'energy_rating': 7, 'recorded_at': '2026-11-15T10:00:00Z',
            'created_at': '2026-11-15T12:00:00Z', **changes}


@pytest.fixture
def api():
    state: dict[str, Any] = {'rows': [], 'calls': [], 'auth_status': 200}
    def handler(request):
        assert request.headers['apikey'] == 'sb_publishable_test'
        if request.url.path == '/auth/v1/user':
            return httpx.Response(state['auth_status'], json={'id': USER, 'email': 'user@example.com', 'role': 'authenticated'})
        assert request.url.path == '/rest/v1/energy_checkins'
        assert request.headers['authorization'] == 'Bearer test-session'
        assert request.url.params['user_id'] == f'eq.{USER}'
        state['calls'].append(request)
        if state.get('timeout'):
            raise httpx.ReadTimeout('Timeout', request=request)
        if state.get('status'):
            return httpx.Response(state['status'], json={'code': state.get('code'), 'message': 'private upstream details'})
        if 'result' in state:
            return httpx.Response(200, json=state['result'])
        if request.method == 'POST':
            body = json.loads(request.content)
            assert set(body) == {'user_id', 'energy_rating', 'recorded_at'}
            assert body['user_id'] == USER
            created = row(id=str(uuid4()), **body)
            state['rows'].append(created)
            return httpx.Response(201, json=[created])
        assert request.method == 'GET'
        rows = [r for r in state['rows'] if r['user_id'] == USER]
        if 'id' in request.url.params:
            rows = [r for r in rows if r['id'] == request.url.params['id'][3:]]
        if 'order' in request.url.params:
            assert request.url.params['order'] == 'recorded_at.desc,id.desc'
            rows = sorted(rows, key=lambda r: (r['recorded_at'], r['id']), reverse=True)
        offset = int(request.url.params.get('offset', 0))
        limit = int(request.url.params.get('limit', len(rows)))
        return httpx.Response(200, json=rows[offset:offset + limit])
    async def client():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            yield c
    app.dependency_overrides[get_auth_client] = client
    app.dependency_overrides[get_settings] = make_settings
    app.dependency_overrides[get_energy_now] = lambda: NOW
    try:
        with TestClient(app) as c:
            yield c, state
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize('method,path', [('POST', BASE), ('GET', BASE), ('GET', BASE + '/' + ID)])
@pytest.mark.parametrize('invalid', [False, True])
def test_auth_required(api, method, path, invalid):
    c, state = api
    state['auth_status'] = 401
    result = c.request(method, path, headers=HEADERS if invalid else {}, json={'energy_rating': 7})
    assert result.status_code == 401
    assert not state['calls']


def test_create_read_and_server_timestamp(api):
    c, _ = api
    result = c.post(BASE, headers=HEADERS, json={'energy_rating': 7})
    assert result.status_code == 201
    assert datetime.fromisoformat(result.json()['recorded_at']) == NOW
    assert result.json()['user_id'] == USER
    assert c.get(BASE + '/' + result.json()['id'], headers=HEADERS).json() == result.json()


def test_backdated_timestamp_preserves_observation_and_creation_times(api):
    c, _ = api
    result = c.post(BASE, headers=HEADERS, json={'energy_rating': 1, 'recorded_at': '2026-11-14T23:30:00-08:00'})
    assert result.status_code == 201
    assert datetime.fromisoformat(result.json()['recorded_at']) == datetime(2026, 11, 15, 7, 30, tzinfo=timezone.utc)
    assert result.json()['recorded_at'] != result.json()['created_at']
    assert c.post(BASE, headers=HEADERS, json={'energy_rating': 10}).status_code == 201


@pytest.mark.parametrize('payload', [
    {}, {'energy_rating': 0}, {'energy_rating': 11}, {'energy_rating': True},
    {'energy_rating': '7'}, {'energy_rating': 7.5}, {'energy_rating': None},
    {'energy_rating': 7, 'recorded_at': '2026-11-15T10:00:00'},
    {'energy_rating': 7, 'recorded_at': 100}, {'energy_rating': 7, 'recorded_at': 'invalid'},
    {'energy_rating': 7, 'recorded_at': '2026-11-16T00:00:00Z'},
    {'energy_rating': 7, 'user_id': OTHER}, {'energy_rating': 7, 'id': ID},
    {'energy_rating': 7, 'created_at': '2026-11-15T00:00:00Z'},
])
def test_invalid_input(api, payload):
    c, state = api
    assert c.post(BASE, headers=HEADERS, json=payload).status_code == 422
    assert not any(r.method == 'POST' for r in state['calls'])


def test_ownership_and_missing_checkin(api):
    c, state = api
    state['rows'] = [row(user_id=OTHER)]
    assert c.get(BASE + '/' + ID, headers=HEADERS).status_code == 404
    assert c.get(BASE, headers=HEADERS).json()['items'] == []


def test_history_pagination(api):
    c, state = api
    state['rows'] = [row(id=str(uuid4())) for _ in range(3)]
    first = c.get(BASE + '?limit=2', headers=HEADERS).json()
    second = c.get(BASE + '?limit=2&offset=2', headers=HEADERS).json()
    assert first['has_more'] is True and second['has_more'] is False
    assert len(first['items']) == 2 and len(second['items']) == 1
    assert not ({r['id'] for r in first['items']} & {r['id'] for r in second['items']})


@pytest.mark.parametrize('query', ['limit=0', 'limit=101', 'offset=-1'])
def test_invalid_pagination(api, query):
    assert api[0].get(BASE + '?' + query, headers=HEADERS).status_code == 422


@pytest.mark.parametrize('method', ['PUT', 'PATCH', 'DELETE'])
def test_append_only_api(api, method):
    c, state = api
    assert c.request(method, BASE + '/' + ID, headers=HEADERS, json={'energy_rating': 8}).status_code == 405
    assert not state['calls']


@pytest.mark.parametrize('status,code,expected', [(401, None, 401), (403, None, 403), (400, '23514', 422), (500, None, 503)])
def test_upstream_errors(api, status, code, expected):
    c, state = api
    state.update(status=status, code=code)
    result = c.get(BASE, headers=HEADERS)
    assert result.status_code == expected and 'private upstream' not in result.text


@pytest.mark.parametrize('result', [{}, [{'id': ID}], [row(user_id=OTHER)]])
def test_bad_response(api, result):
    c, state = api
    state['result'] = result
    assert c.get(BASE, headers=HEADERS).status_code == 503


def test_timeout(api):
    c, state = api
    state['timeout'] = True
    assert c.get(BASE, headers=HEADERS).status_code == 503
