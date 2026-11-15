import json
from datetime import datetime, timezone
from uuid import uuid4
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from energy_api.core.auth import get_auth_client
from energy_api.core.config import get_settings
from energy_api.main import app

from .helpers import make_settings
from energy_api.schemas.naps import NapRecord
from energy_api.services.naps.sessions import get_nap_now, present_session

USER = 'a2b8c168-ff6b-4a2b-a9cb-3bc284bf5908'
OTHER = '311b169e-2609-4949-8031-d08adb491c41'
ID = 'b541e1e0-5be4-4193-836b-a151a732538c'
NOW = datetime(2026, 11, 14, 8, tzinfo=timezone.utc)
HEADERS = {'Authorization': 'Bearer test-session'}
BASE = '/naps/sessions'


def row(**changes: Any) -> dict[str, Any]:
    return dict(id=ID, user_id=USER, started_at='2026-11-13T23:00:00Z', ended_at=None,
                duration_seconds=None, refreshed_rating=None,
                created_at='2026-11-13T23:00:00Z', updated_at='2026-11-13T23:00:00Z', **changes)


@pytest.fixture
def api():
    state = {'rows': [], 'calls': [], 'auth_status': 200}

    def handler(request):
        assert request.headers['apikey'] == 'sb_publishable_test'
        if request.url.path == '/auth/v1/user':
            return httpx.Response(state['auth_status'], json={'id': USER, 'email': 'user@example.com', 'role': 'authenticated'})
        assert request.url.path == '/rest/v1/nap_sessions'
        assert request.headers['authorization'] == 'Bearer test-session'
        assert request.url.params['user_id'] == f'eq.{USER}'
        state['calls'].append(request)
        if state.get('timeout'):
            raise httpx.ReadTimeout('Timeout', request=request)
        if state.get('status'):
            return httpx.Response(state['status'], json={'code': state.get('code'), 'message': 'private error details'})
        if 'result' in state:
            return httpx.Response(200, json=state['result'])
        rows = [r for r in state['rows'] if r['user_id'] == USER]
        if 'id' in request.url.params:
            rows = [r for r in rows if r['id'] == request.url.params['id'][3:]]
        end_filter = request.url.params.get('ended_at')
        if end_filter:
            rows = [r for r in rows if (r['ended_at'] is None) == (end_filter == 'is.null')]
        if request.method == 'POST':
            body = json.loads(request.content)
            assert set(body) == {'user_id', 'started_at'}
            if any(r['ended_at'] is None for r in rows):
                return httpx.Response(409, json={'code': '23505'})
            created = row()
            created.update(body)
            state['rows'].append(created)
            return httpx.Response(201, json=[created])
        if request.method == 'PATCH':
            if state.get('race'):
                return httpx.Response(200, json=[])
            for r in rows:
                r.update(json.loads(request.content))
                if r['ended_at']:
                    r['duration_seconds'] = (datetime.fromisoformat(r['ended_at']) - datetime.fromisoformat(r['started_at'])).total_seconds()
            return httpx.Response(200, json=rows)
        if 'order' in request.url.params:
            assert request.url.params['order'] == 'started_at.desc,id.desc'
            rows = sorted(rows, key=lambda r: (r['started_at'], r['id']), reverse=True)
        offset = int(request.url.params.get('offset', 0))
        limit = int(request.url.params.get('limit', len(rows)))
        return httpx.Response(200, json=rows[offset:offset + limit])

    async def client():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            yield c

    app.dependency_overrides[get_auth_client] = client
    app.dependency_overrides[get_settings] = lambda: make_settings()
    app.dependency_overrides[get_nap_now] = lambda: NOW
    try:
        with TestClient(app) as c:
            yield c, state
    finally:
        app.dependency_overrides.clear()


ROUTES = [('POST', BASE + '/start'), ('GET', BASE + '/active'), ('GET', BASE),
          ('GET', BASE + '/' + ID), ('POST', BASE + '/' + ID + '/stop'), ('PUT', BASE + '/' + ID + '/rating')]


@pytest.mark.parametrize('method,path', ROUTES)
@pytest.mark.parametrize('invalid', [False, True])
def test_auth_required(api, method, path, invalid):
    c, state = api
    state['auth_status'] = 401
    r = c.request(method, path, headers=HEADERS if invalid else {}, json={'refreshed_rating': 3})
    assert r.status_code == 401
    assert not state['calls']


def test_full_flow_midnight_and_quality(api):
    c, state = api
    assert c.get(BASE + '/active', headers=HEADERS).json() is None
    r = c.post(BASE + '/start', headers=HEADERS, json={'started_at': '2026-11-13T23:00:00Z'})
    assert r.status_code == 201
    assert r.json()['duration_seconds'] is None
    assert r.json()['elapsed_seconds'] == 32400
    assert c.post(BASE + '/start', headers=HEADERS, json={}).status_code == 409
    assert c.get(BASE + '/active', headers=HEADERS).json()['id'] == ID
    assert c.put(BASE + '/' + ID + '/rating', headers=HEADERS, json={'refreshed_rating': 3}).status_code == 409
    r = c.post(BASE + '/' + ID + '/stop', headers=HEADERS, json={'ended_at': '2026-11-14T07:00:00Z', 'refreshed_rating': 4})
    assert r.status_code == 200
    assert r.json()['duration_seconds'] == 28800
    assert c.post(BASE + '/' + ID + '/stop', headers=HEADERS, json={}).status_code == 409
    assert c.get(BASE + '/active', headers=HEADERS).json() is None
    assert c.put(BASE + '/' + ID + '/rating', headers=HEADERS, json={'refreshed_rating': 5}).json()['refreshed_rating'] == 5
    assert c.get(BASE + '/' + ID, headers=HEADERS).status_code == 200
    assert len(c.get(BASE, headers=HEADERS).json()['items']) == 1
    assert c.post(BASE + '/start', headers=HEADERS, json={}).status_code == 201


@pytest.mark.parametrize('path,payload', [
    ('/start', {'started_at': '2026-11-15T00:00:00Z'}),
    ('/start', {'started_at': '2026-11-13T23:00:00'}),
    ('/start', {'started_at': 123}), ('/start', {'user_id': OTHER}),
    ('/' + ID + '/stop', {'ended_at': '2026-11-13T22:00:00Z'}),
    ('/' + ID + '/stop', {'ended_at': '2026-11-13T23:00:00Z'}),
    ('/' + ID + '/stop', {'ended_at': '2026-11-15T00:00:00Z'}),
    ('/' + ID + '/stop', {'refreshed_rating': 0}), ('/' + ID + '/stop', {'refreshed_rating': 6}),
    ('/' + ID + '/stop', {'refreshed_rating': True}), ('/' + ID + '/stop', {'refreshed_rating': '3'}),
    ('/' + ID + '/stop', {'ended_at': 'invalid'}),
])
def test_invalid_input(api, path, payload):
    c, state = api
    state['rows'] = [row()]
    assert c.post(BASE + path, headers=HEADERS, json=payload).status_code == 422
    assert not any(r.method == 'PATCH' for r in state['calls'])


@pytest.mark.parametrize('method,path,payload', [
    ('GET', '/' + ID, None), ('POST', '/' + ID + '/stop', {}),
    ('PUT', '/' + ID + '/rating', {'refreshed_rating': 3}),
])
def test_other_users_sessions_are_invisible(api, method, path, payload):
    c, state = api
    other = row()
    other['user_id'] = OTHER
    state['rows'] = [other]
    assert c.request(method, BASE + path, headers=HEADERS, json=payload).status_code == 404
    assert c.get(BASE, headers=HEADERS).json()['items'] == []


def test_stop_race(api):
    c, state = api
    state.update(rows=[row()], race=True)
    assert c.post(BASE + '/' + ID + '/stop', headers=HEADERS, json={}).status_code == 409
    assert state['calls'][-1].url.params['ended_at'] == 'is.null'


def test_pagination(api):
    c, state = api
    for _ in range(3):
        r = row()
        r.update(id=str(uuid4()), ended_at='2026-11-14T07:00:00Z', duration_seconds=28800)
        state['rows'].append(r)
    first = c.get(BASE + '?limit=2', headers=HEADERS).json()
    second = c.get(BASE + '?limit=2&offset=2', headers=HEADERS).json()
    assert first['has_more'] is True and second['has_more'] is False
    assert len(first['items']) == 2 and len(second['items']) == 1
    assert not ({r['id'] for r in first['items']} & {r['id'] for r in second['items']})


@pytest.mark.parametrize('query', ['limit=0', 'limit=101', 'offset=-1'])
def test_invalid_pagination(api, query):
    assert api[0].get(BASE + '?' + query, headers=HEADERS).status_code == 422


@pytest.mark.parametrize('status,code,expected', [(401, None, 401), (403, None, 403), (400, '23514', 422), (500, None, 503)])
def test_upstream_errors(api, status, code, expected):
    c, state = api
    state.update(status=status, code=code)
    r = c.get(BASE, headers=HEADERS)
    assert r.status_code == expected
    assert 'private error details' not in r.text


def test_timeout_and_malformed_response(api):
    c, state = api
    state['timeout'] = True
    assert c.get(BASE, headers=HEADERS).status_code == 503
    state['timeout'] = False
    state['result'] = [{'user_id': OTHER}]
    assert c.get(BASE, headers=HEADERS).status_code == 503


def test_dst_uses_elapsed_instants():
    r = row()
    r.update(started_at='2026-11-01T01:30:00-07:00', ended_at='2026-11-01T01:30:00-08:00', duration_seconds=3600)
    result = present_session(NapRecord.model_validate(r), NOW)
    assert result.duration_seconds == 3600


def test_start_and_stop_default_to_server_time(api):
    c, state = api
    result = c.post(BASE + '/start', headers=HEADERS)
    assert result.status_code == 201
    assert datetime.fromisoformat(result.json()['started_at']) == NOW
    state['rows'] = [row()]
    result = c.post(BASE + '/' + ID + '/stop', headers=HEADERS)
    assert result.status_code == 200
    assert datetime.fromisoformat(result.json()['ended_at']) == NOW
    assert result.json()['duration_seconds'] == 32400


@pytest.mark.parametrize('quality', [0, 6, True, '4', 2.5, None])
def test_invalid_quality_rating(api, quality):
    c, state = api
    result = c.put(BASE + '/' + ID + '/rating', headers=HEADERS, json={'refreshed_rating': quality})
    assert result.status_code == 422
    assert not state['calls']


def test_unexpected_owner_response_is_rejected(api):
    c, state = api
    unexpected = row()
    unexpected['user_id'] = OTHER
    state['result'] = [unexpected]
    assert c.get(BASE + '/' + ID, headers=HEADERS).status_code == 503


def test_concurrent_rating_conflict(api):
    c, state = api
    completed = row()
    completed.update(ended_at='2026-11-14T07:00:00Z', duration_seconds=28800)
    state.update(rows=[completed], race=True)
    result = c.put(BASE + '/' + ID + '/rating', headers=HEADERS, json={'refreshed_rating': 4})
    assert result.status_code == 409
    assert state['calls'][-1].url.params['ended_at'] == 'not.is.null'


def test_nap_openapi_routes():
    schema = app.openapi()
    assert BASE + '/start' in schema['paths']
    assert BASE + '/{session_id}/stop' in schema['paths']
    assert schema['paths'][BASE + '/start']['post']['security'] == [{'HTTPBearer': []}]
