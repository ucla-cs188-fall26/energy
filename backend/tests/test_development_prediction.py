from copy import deepcopy
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
import pytest

from energy_api.core.config import get_settings
from energy_api.main import create_app
from .helpers import make_settings
from .test_prediction_api import api, HEADERS, NOW, PATH, OTHER, SLEEP

ENDPOINT = '/development/energy/simulate'
BODY = {'duration_minutes': 240, 'timezone': 'America/Los_Angeles'}


@pytest.mark.parametrize('environment', ['production', 'test'])
@pytest.mark.parametrize('debug', [False, True])
def test_no_simulation_route_or_docs_in_production(environment, debug):
    configuration = make_settings().model_copy(update={'environment': environment, 'debug': debug})
    application = create_app(configuration)
    with TestClient(application) as c:
        assert c.post(ENDPOINT, json=BODY, headers=HEADERS).status_code == 404
        assert ENDPOINT not in c.get('/openapi.json').json()['paths']
        assert c.get('/health').status_code == 200


@pytest.mark.parametrize('api', ['development'], indirect=True)
class TestDevelopmentSimulation:
    @pytest.mark.parametrize('minutes', [30, 60, 240, 360, 480])
    def test_preview_is_authenticated_read_only_and_uses_fixed_now(self, api, minutes):
        c, state = api
        snapshot = deepcopy({key: value for key, value in state.items() if key != 'calls'})
        response = c.post(ENDPOINT, headers=HEADERS, json={**BODY, 'duration_minutes': minutes})
        assert response.status_code == 200
        result = response.json()
        assert result['simulation'] is True
        assert result['simulated_sleep_minutes'] == minutes
        assert result['timestamp'] == NOW.astimezone(ZoneInfo(BODY['timezone'])).isoformat()
        assert result['score'] is not None and 0 <= result['score'] <= 100
        assert result['forecast'] and result['timezone'] == BODY['timezone']
        assert any('Simulation only' in warning for warning in result['warnings'])
        assert all(r.method == 'GET' for r in state['calls'])
        assert all('/sleep_sessions' not in r.url.path for r in state['calls'])
        assert {key: value for key, value in state.items() if key != 'calls'} == snapshot

    def test_four_hours_is_less_restorative_than_eight_and_real_prediction_unchanged(self, api):
        c, state = api
        before = c.get(PATH, headers=HEADERS).json()
        four = c.post(ENDPOINT, headers=HEADERS, json=BODY).json()
        eight = c.post(ENDPOINT, headers=HEADERS, json={**BODY, 'duration_minutes': 480}).json()
        assert four['score'] < eight['score']
        assert c.get(PATH, headers=HEADERS).json() == before
        assert all(r.method == 'GET' for r in state['calls'])

    @pytest.mark.parametrize('invalid', [False, True])
    def test_authentication_required(self, api, invalid):
        c, state = api
        state['auth_status'] = 401
        assert c.post(ENDPOINT, json=BODY, headers=HEADERS if invalid else {}).status_code == 401
        assert not state['calls']

    @pytest.mark.parametrize('body', [
        {**BODY, 'duration_minutes': 1}, {**BODY, 'duration_minutes': 31},
        {**BODY, 'duration_minutes': True}, {**BODY, 'duration_minutes': '240'},
        {**BODY, 'duration_minutes': 240.0}, {**BODY, 'timezone': 'Bad/Zone'},
        {**BODY, 'user_id': OTHER}, {**BODY, 'ended_at': '2026-11-17T16:00:00Z'},
    ])
    def test_invalid_or_identity_timestamp_override_rejected(self, api, body):
        c, state = api
        assert c.post(ENDPOINT, headers=HEADERS, json=body).status_code == 422
        assert not state['calls']

    def test_runtime_guard_also_fails_closed(self, api):
        c, state = api
        c.app.dependency_overrides[get_settings] = make_settings
        assert c.post(ENDPOINT, headers=HEADERS, json=BODY).status_code == 404
        assert not state['calls']

    def test_cross_user_data_is_rejected(self, api):
        c, state = api
        state['caffeine'][0]['user_id'] = OTHER
        assert c.post(ENDPOINT, headers=HEADERS, json=BODY).status_code == 503


    def test_actual_nap_overlapping_hypothetical_sleep_is_not_counted_twice(self, api):
        c, state = api
        before = c.post(ENDPOINT, headers=HEADERS, json=BODY).json()
        nap = {**SLEEP, 'started_at': '2026-11-15T13:00:00Z', 'ended_at': '2026-11-15T13:20:00Z',
               'duration_seconds': 1200, 'refreshed_rating': 4}
        nap.pop('sleep_quality')
        state['naps'] = [nap]
        result = c.post(ENDPOINT, headers=HEADERS, json=BODY).json()
        assert result['score'] == before['score']
        assert result['forecast'] == before['forecast']
        assert any('prevent double counting' in warning for warning in result['warnings'])


    @pytest.mark.parametrize('invalid', [False, True])
    def test_normal_authentication_is_required(self, api, invalid):
        c, state = api
        state['auth_status'] = 401
        assert c.post(ENDPOINT, json=BODY, headers=HEADERS if invalid else {}).status_code == 401
        assert not state['calls']
