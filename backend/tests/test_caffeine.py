import json
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from energy_api.core.auth import get_auth_client
from energy_api.core.config import get_settings
from energy_api.main import app

from .helpers import make_settings
from energy_api.services.caffeine.logs import day_bounds, get_caffeine_now

USER = 'a2b8c168-ff6b-4a2b-a9cb-3bc284bf5908'
OTHER = '311b169e-2609-4949-8031-d08adb491c41'
ID = 'b541e1e0-5be4-4193-836b-a151a732538c'
NOW = datetime(2026, 11, 15, 12, tzinfo=timezone.utc)
HEADERS = {'Authorization': 'Bearer test-session'}
BASE = '/caffeine'
MANUAL = {'beverage_name': 'Coffee', 'caffeine_mg': '95.00', 'serving_size_ml': '237.00'}
STAMP = {'created_at': '2026-11-15T10:00:00Z', 'updated_at': '2026-11-15T10:00:00Z'}


def log(**changes):
    return {**MANUAL, **STAMP, 'id': ID, 'user_id': USER, 'consumed_at': '2026-11-15T10:00:00Z',
            'logging_method': 'manual', **changes}


@pytest.fixture
def api():
    state = {'logs': [], 'calls': [], 'auth_status': 200,
             'preset': {**MANUAL, **STAMP, 'id': 'brewed-coffee'}}

    def handler(request):
        assert request.headers['apikey'] == 'sb_publishable_test'
        if request.url.path == '/auth/v1/user':
            return httpx.Response(state['auth_status'], json={'id': USER, 'email': 'user@example.com', 'role': 'authenticated'})
        assert request.headers['authorization'] == 'Bearer test-session'
        state['calls'].append(request)
        if state.get('timeout'):
            raise httpx.ReadTimeout('Timeout', request=request)
        if state.get('status'):
            return httpx.Response(state['status'], json={'code': state.get('code'), 'message': 'private database details'})
        if 'result' in state:
            return httpx.Response(200, json=state['result'])
        if request.url.path.endswith('/caffeine_presets'):
            rows = [state['preset']]
            if 'id' in request.url.params:
                rows = [r for r in rows if r['id'] == request.url.params['id'][3:]]
            return httpx.Response(200, json=rows)
        assert request.url.path.endswith('/caffeine_logs')
        assert request.url.params['user_id'] == f'eq.{USER}'
        rows = [r for r in state['logs'] if r['user_id'] == USER]
        if 'id' in request.url.params:
            rows = [r for r in rows if r['id'] == request.url.params['id'][3:]]
        if request.method == 'POST':
            body = json.loads(request.content)
            assert body['user_id'] == USER and 'preset_id' not in body
            created = log(id=str(uuid4()), **body)
            state['logs'].append(created)
            return httpx.Response(201, json=[created])
        if request.method == 'PATCH':
            for r in rows:
                r.update(json.loads(request.content))
            return httpx.Response(200, json=rows)
        if request.method == 'DELETE':
            state['logs'] = [r for r in state['logs'] if r not in rows]
            return httpx.Response(200, json=rows)
        if 'and' in request.url.params:
            start, end = request.url.params['and'].strip('()').split(',')
            start, end = datetime.fromisoformat(start.removeprefix('consumed_at.gte.')), datetime.fromisoformat(end.removeprefix('consumed_at.lt.'))
            rows = [r for r in rows if start <= datetime.fromisoformat(r['consumed_at']) < end]
        if 'order' in request.url.params:
            rows = sorted(rows, key=lambda r: (r['consumed_at'], r['id']), reverse=request.url.params['order'].startswith('consumed_at.desc'))
        offset = int(request.url.params.get('offset', 0))
        # Simulate a lower-than-requested PostgREST row cap.
        limit = min(int(request.url.params.get('limit', len(rows))), state.get('row_cap', 1000))
        return httpx.Response(200, json=rows[offset:offset + limit])

    async def client():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            yield c
    app.dependency_overrides[get_auth_client] = client
    app.dependency_overrides[get_settings] = lambda: make_settings()
    app.dependency_overrides[get_caffeine_now] = lambda: NOW
    try:
        with TestClient(app) as c:
            yield c, state
    finally:
        app.dependency_overrides.clear()


ROUTES = [('POST', '/logs'), ('GET', '/logs'), ('GET', '/logs/' + ID), ('PUT', '/logs/' + ID),
          ('DELETE', '/logs/' + ID), ('GET', '/presets'), ('GET', '/daily-total?day=2026-11-15')]


@pytest.mark.parametrize('method,path', ROUTES)
@pytest.mark.parametrize('invalid', [False, True])
def test_auth_required(api, method, path, invalid):
    c, state = api
    state['auth_status'] = 401
    assert c.request(method, BASE + path, headers=HEADERS if invalid else {}, json=MANUAL).status_code == 401
    assert not state['calls']


def test_crud_and_history(api):
    c, state = api
    r = c.post(BASE + '/logs', headers=HEADERS, json={**MANUAL, 'beverage_name': 'x' * 150})
    assert r.status_code == 201
    identity = r.json()['id']
    assert r.json()['user_id'] == USER
    assert c.get(BASE + '/logs/' + identity, headers=HEADERS).status_code == 200
    r = c.put(BASE + '/logs/' + identity, headers=HEADERS, json={'caffeine_mg': '85.25'})
    assert r.status_code == 200 and r.json()['caffeine_mg'] == '85.25'
    assert r.json()['serving_size_ml'] == '237.00'
    assert len(c.get(BASE + '/logs', headers=HEADERS).json()['items']) == 1
    assert c.delete(BASE + '/logs/' + identity, headers=HEADERS).status_code == 204
    assert c.get(BASE + '/logs/' + identity, headers=HEADERS).status_code == 404


def test_presets_scale_and_allow_overrides(api):
    c, state = api
    original = dict(state['preset'])
    assert len(c.get(BASE + '/presets', headers=HEADERS).json()) == 1
    r = c.post(BASE + '/logs', headers=HEADERS, json={'logging_method': 'preset', 'preset_id': 'brewed-coffee', 'serving_size_ml': 474})
    assert r.status_code == 201 and Decimal(r.json()['caffeine_mg']) == 190
    r = c.post(BASE + '/logs', headers=HEADERS, json={'logging_method': 'preset', 'preset_id': 'brewed-coffee', 'serving_size_ml': 474, 'caffeine_mg': 0})
    assert r.status_code == 201 and Decimal(r.json()['caffeine_mg']) == 0
    assert state['preset'] == original
    assert c.post(BASE + '/logs', headers=HEADERS, json={'logging_method': 'preset', 'preset_id': 'missing'}).status_code == 404


@pytest.mark.parametrize('change', [
    {'beverage_name': ''}, {'beverage_name': ' padded '}, {'beverage_name': 'x' * 151},
    {'caffeine_mg': -1}, {'caffeine_mg': 'NaN'}, {'caffeine_mg': 'Infinity'},
    {'caffeine_mg': True}, {'caffeine_mg': '1.001'}, {'caffeine_mg': 100000000},
    {'serving_size_ml': 0}, {'serving_size_ml': -1}, {'serving_size_ml': 'NaN'},
    {'logging_method': 'unknown'}, {'consumed_at': '2026-11-15T10:00:00'},
    {'consumed_at': 100}, {'consumed_at': '2026-11-16T00:00:00Z'}, {'user_id': OTHER},
    {'id': ID}, {'created_at': '2026-11-15T00:00:00Z'}, {'preset_id': 'brewed-coffee'},
])
def test_invalid_create(api, change):
    assert api[0].post(BASE + '/logs', headers=HEADERS, json={**MANUAL, **change}).status_code == 422


@pytest.mark.parametrize('payload', [{}, {'caffeine_mg': None}, {'user_id': OTHER}, {'preset_id': 'brewed-coffee'}, {'beverage_name': 'x' * 151}])
def test_invalid_updates(api, payload):
    assert api[0].put(BASE + '/logs/' + ID, headers=HEADERS, json=payload).status_code == 422


@pytest.mark.parametrize('method,payload', [('GET', None), ('PUT', {'caffeine_mg': 20}), ('DELETE', None)])
def test_other_user_records_are_not_accessible(api, method, payload):
    c, state = api
    state['logs'] = [log(user_id=OTHER)]
    assert c.request(method, BASE + '/logs/' + ID, headers=HEADERS, json=payload).status_code == 404
    assert c.get(BASE + '/logs', headers=HEADERS).json()['items'] == []


def test_daily_total_is_local_day_exact_and_not_truncated(api):
    c, state = api
    state['row_cap'] = 1
    state['logs'] = [log(id=str(uuid4()), consumed_at=stamp, caffeine_mg=amount) for stamp, amount in [
        ('2026-11-15T07:59:59Z', '99.00'), ('2026-11-15T08:00:00Z', '0.10'),
        ('2026-11-16T07:59:59Z', '0.20'), ('2026-11-16T08:00:00Z', '99.00')]]
    state['logs'].append(log(user_id=OTHER, caffeine_mg='999.00'))
    r = c.get(BASE + '/daily-total?day=2026-11-15&timezone=America/Los_Angeles', headers=HEADERS)
    assert r.status_code == 200
    assert Decimal(r.json()['total_caffeine_mg']) == Decimal('0.30')
    assert r.json()['log_count'] == 2


@pytest.mark.parametrize('day,hours', [(date(2026, 3, 8), 23), (date(2026, 11, 1), 25)])
def test_dst_day_boundaries(day, hours):
    start, end = day_bounds(day, 'America/Los_Angeles')
    assert (end - start).total_seconds() == hours * 3600


@pytest.mark.parametrize('query', ['day=2026-11-15&timezone=bad/zone', 'day=not-a-date', 'day=9999-12-31'])
def test_invalid_daily_queries(api, query):
    assert api[0].get(BASE + '/daily-total?' + query, headers=HEADERS).status_code == 422


def test_history_pagination(api):
    c, state = api
    state['logs'] = [log(id=str(uuid4())) for _ in range(3)]
    first = c.get(BASE + '/logs?limit=2', headers=HEADERS).json()
    second = c.get(BASE + '/logs?limit=2&offset=2', headers=HEADERS).json()
    assert first['has_more'] is True and second['has_more'] is False
    assert not ({r['id'] for r in first['items']} & {r['id'] for r in second['items']})


@pytest.mark.parametrize('status,code,expected', [(401, None, 401), (403, None, 403), (400, '23514', 422), (500, None, 503)])
def test_upstream_errors(api, status, code, expected):
    c, state = api
    state.update(status=status, code=code)
    r = c.get(BASE + '/logs', headers=HEADERS)
    assert r.status_code == expected and 'private database' not in r.text


def test_invalid_upstream_response(api):
    c, state = api
    state['result'] = [log(user_id=OTHER)]
    assert c.get(BASE + '/logs', headers=HEADERS).status_code == 503
    state['result'] = {}
    assert c.get(BASE + '/logs', headers=HEADERS).status_code == 503
    state['timeout'] = True
    assert c.get(BASE + '/logs', headers=HEADERS).status_code == 503


def test_cors_delete(api):
    r = api[0].options(BASE + '/logs/' + ID, headers={'Origin': 'http://localhost:8081',
        'Access-Control-Request-Method': 'DELETE', 'Access-Control-Request-Headers': 'authorization'})
    assert r.status_code == 200


def test_camera_source_and_zero_caffeine(api):
    c, _ = api
    r = c.post(BASE + '/logs', headers=HEADERS, json={**MANUAL, 'logging_method': 'camera', 'caffeine_mg': 0})
    assert r.status_code == 201 and Decimal(r.json()['caffeine_mg']) == 0


@pytest.mark.parametrize('payload', [{}, {'logging_method': 'preset'}, {'beverage_name': 'Coffee'}])
def test_required_create_fields(api, payload):
    assert api[0].post(BASE + '/logs', headers=HEADERS, json=payload).status_code == 422


def test_catalog_changes_do_not_rewrite_history(api):
    c, state = api
    created = c.post(BASE + '/logs', headers=HEADERS, json={'logging_method': 'preset', 'preset_id': 'brewed-coffee'}).json()
    state['preset']['caffeine_mg'] = '120.00'
    result = c.get(BASE + '/logs/' + created['id'], headers=HEADERS).json()
    assert Decimal(result['caffeine_mg']) == 95


def test_empty_daily_total(api):
    result = api[0].get(BASE + '/daily-total?day=2026-11-15', headers=HEADERS).json()
    assert result['log_count'] == 0 and Decimal(result['total_caffeine_mg']) == 0


def test_update_rejects_future_timestamp(api):
    assert api[0].put(BASE + '/logs/' + ID, headers=HEADERS,
        json={'consumed_at': '2026-11-16T00:00:00Z'}).status_code == 422


@pytest.mark.parametrize('query', ['limit=0', 'limit=101', 'offset=-1'])
def test_invalid_history_pagination(api, query):
    assert api[0].get(BASE + '/logs?' + query, headers=HEADERS).status_code == 422
