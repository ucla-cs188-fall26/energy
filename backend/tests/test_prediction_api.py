from datetime import datetime, timezone
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from energy_api.core.auth import get_auth_client
from energy_api.core.config import get_settings
from energy_api.main import app, create_app
from energy_api.services.energy.checkins import get_energy_now
from energy_api.services.sleep.sessions import get_sleep_now
from energy_api.services.naps.sessions import get_nap_now
from energy_api.services.caffeine.logs import get_caffeine_now
from .helpers import make_settings

USER = 'a2b8c168-ff6b-4a2b-a9cb-3bc284bf5908'
OTHER = '311b169e-2609-4949-8031-d08adb491c41'
NOW = datetime(2026, 11, 15, 15, tzinfo=timezone.utc)
HEADERS = {'Authorization': 'Bearer test-session'}
PATH = '/energy/predict?timezone=UTC'
STAMP = {'created_at': '2026-11-15T07:00:00Z', 'updated_at': '2026-11-15T07:00:00Z'}
SLEEP = {**STAMP, 'id': OTHER, 'user_id': USER, 'started_at': '2026-11-14T23:00:00Z',
         'ended_at': '2026-11-15T07:00:00Z', 'duration_seconds': 28800, 'sleep_quality': None}
DOSE = {**STAMP, 'id': OTHER, 'user_id': USER, 'beverage_name': 'Coffee', 'caffeine_mg': '100',
        'serving_size_ml': '237', 'consumed_at': '2026-11-15T10:00:00Z', 'logging_method': 'manual'}


@pytest.fixture
def api(request):
    settings = make_settings()
    if getattr(request, 'param', None) == 'development':
        settings = settings.model_copy(update={'environment': 'development'})
        test_app = create_app(settings)
    else:
        test_app = app
    state: dict[str, Any] = {'sleep': [dict(SLEEP)], 'naps': [], 'caffeine': [dict(DOSE)], 'profile': [],
                             'active_sleep': [], 'active_nap': [], 'calls': [], 'auth_status': 200}
    def handler(request):
        assert request.headers['apikey'] == 'sb_publishable_test'
        assert request.headers['authorization'] == 'Bearer test-session'
        if request.url.path == '/auth/v1/user':
            return httpx.Response(state['auth_status'], json={'id': USER, 'email': 'user@example.com', 'role': 'authenticated'})
        state['calls'].append(request)
        if state.get('timeout'):
            raise httpx.ReadTimeout('Timeout', request=request)
        if state.get('error'):
            return httpx.Response(500, json={'message': 'private database error'})
        table = request.url.path.rsplit('/', 1)[-1]
        assert table != 'energy_checkins', 'Prediction must not read or write training labels'
        assert request.method == 'GET'
        if table == 'user_profiles':
            assert request.url.params['id'] == f'eq.{USER}'
            return httpx.Response(200, json=state['profile'])
        assert request.url.params['user_id'] == f'eq.{USER}'
        if table == 'sleep_sessions':
            rows = state['active_sleep'] if request.url.params.get('ended_at') == 'is.null' else state['sleep']
        elif table == 'nap_sessions':
            rows = state['active_nap'] if request.url.params.get('ended_at') == 'is.null' else state['naps']
        else:
            assert table == 'caffeine_logs'
            assert 'consumed_at.lte.' in request.url.params['and']
            rows = state['caffeine']
        if 'offset' in request.url.params:
            assert request.url.params['order'] == 'id.asc'
            offset = int(request.url.params['offset'])
            rows = rows[offset:offset + state.get('row_cap', 500)]
        return httpx.Response(200, json=rows)
    async def client():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
            yield c
    test_app.dependency_overrides[get_auth_client] = client
    test_app.dependency_overrides[get_settings] = lambda: settings
    for clock in (get_energy_now, get_sleep_now, get_nap_now, get_caffeine_now):
        test_app.dependency_overrides[clock] = lambda: NOW
    try:
        with TestClient(test_app) as c:
            yield c, state
    finally:
        test_app.dependency_overrides.clear()


def test_stable_contract_without_goal_or_profile(api):
    c, state = api
    response = c.get(PATH, headers=HEADERS)
    assert response.status_code == 200
    result = response.json()
    assert result['status'] == 'estimated'
    assert result['model_type'] == 'two_process_heuristic'
    assert result['model_version'] == '1.1.0'
    assert 0 <= result['score'] <= 100
    assert result['caffeine_remaining_mg'] == 50
    assert result['personal_sleep_goal_minutes'] is None
    assert result['physiological_reference_sleep_hours'] == 8
    assert len(result['forecast']) == 8
    assert all(p['caffeine_remaining_mg'] < 50 for p in result['forecast'])
    assert all(r.method == 'GET' for r in state['calls'])
    assert all('energy_checkins' not in str(r.url) for r in state['calls'])


def test_goal_is_metadata_only(api):
    c, state = api
    base = c.get(PATH, headers=HEADERS).json()
    state['profile'] = [{**STAMP, 'id': USER, 'preferences_completed': False, 'sleep_goal_minutes': 240}]
    result = c.get(PATH, headers=HEADERS).json()
    assert result['score'] == base['score']
    assert result['personal_sleep_goal_minutes'] == 240


@pytest.mark.parametrize('invalid', [False, True])
def test_authentication(api, invalid):
    c, state = api
    state['auth_status'] = 401
    response = c.get(PATH, headers=HEADERS if invalid else {})
    assert response.status_code == 401
    assert not state['calls']


@pytest.mark.parametrize('query', ['', '?timezone=Not/AZone', '?timezone='])
def test_timezone_required_and_validated(api, query):
    c, _ = api
    assert c.get('/energy/predict' + query, headers=HEADERS).status_code == 422


def test_missing_sleep_does_not_assume_all_nighter(api):
    c, state = api
    state['sleep'] = []
    result = c.get(PATH, headers=HEADERS).json()
    assert result['score'] is None and result['status'] == 'unavailable'
    assert result['caffeine_remaining_mg'] == 50


def test_active_sleep_and_naps_gate_prediction(api):
    c, state = api
    active = {**SLEEP, 'started_at': '2026-11-15T14:00:00Z', 'ended_at': None, 'duration_seconds': None}
    state['active_sleep'] = [active]
    assert c.get(PATH, headers=HEADERS).json()['status'] == 'sleeping'
    state['active_sleep'] = []
    nap = {k: v for k, v in active.items() if k != 'sleep_quality'}
    nap['refreshed_rating'] = None
    state['active_nap'] = [nap]
    assert c.get(PATH, headers=HEADERS).json()['score'] is None


def test_paginated_data_is_not_truncated(api):
    c, state = api
    state['row_cap'] = 1
    second = {**DOSE, 'id': USER}
    state['caffeine'].append(second)
    assert c.get(PATH, headers=HEADERS).json()['caffeine_remaining_mg'] == 100


def test_other_users_data_is_rejected(api):
    c, state = api
    state['sleep'][0]['user_id'] = OTHER
    assert c.get(PATH, headers=HEADERS).status_code == 503


@pytest.mark.parametrize('failure', ['timeout', 'error'])
def test_upstream_failure_not_masked_as_missing_data(api, failure):
    c, state = api
    state[failure] = True
    response = c.get(PATH, headers=HEADERS)
    assert response.status_code == 503
    assert 'private database' not in response.text


def test_short_sleep_is_ignored_and_an_earlier_reference_is_preserved(api):
    c, state = api
    original = c.get(PATH, headers=HEADERS).json()
    previous = dict(state['sleep'][0])
    short = {**previous, 'id': USER, 'started_at': '2026-11-15T14:59:00Z',
             'ended_at': NOW.isoformat(), 'duration_seconds': 60}
    state['sleep'] = [short]
    unavailable = c.get(PATH, headers=HEADERS).json()
    assert unavailable['score'] is None and unavailable['data_quality'] == 'unavailable'
    state['sleep'] = [previous, short]
    result = c.get(PATH, headers=HEADERS).json()
    assert result['score'] == original['score']
    assert result['forecast'] == original['forecast']
    assert len(state['sleep']) == 2  # Prediction never deletes short history.


def test_thirty_minute_session_qualifies_through_the_api(api):
    c, state = api
    state['sleep'][0].update(started_at='2026-11-15T14:30:00Z', ended_at=NOW.isoformat(), duration_seconds=1800)
    result = c.get(PATH, headers=HEADERS).json()
    assert result['score'] is not None and result['data_quality'] == 'limited'
    assert result['parameters']['min_main_sleep_minutes'] == 30
