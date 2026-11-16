"""Local-only demo fixture: real API/services, in-memory Supabase transport.

Run from backend: .venv/bin/python -m uvicorn tests.mock_demo:app --port 8766
Never connect this fixture to a deployed database. All users/tokens are synthetic.
"""
import base64
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
from fastapi import Request
from fastapi.responses import JSONResponse, Response

from energy_api.core.auth import get_auth_client
from energy_api.core.config import get_settings
from energy_api.main import app
from .helpers import make_settings

USER = 'a2b8c168-ff6b-4a2b-a9cb-3bc284bf5908'
OTHER = '311b169e-2609-4949-8031-d08adb491c41'
TABLES: dict[str, list[dict]] = {}


def stamp():
    return datetime.now(timezone.utc).isoformat()


def identity(uid=USER):
    return dict(id=uid, email='demo@example.invalid', role='authenticated', aud='authenticated',
                created_at=stamp(), app_metadata={}, user_metadata={})


def token(uid=USER):
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).decode().rstrip('=')
    return f'{encode({"alg": "HS256", "typ": "JWT"})}.{encode({"sub": uid, "exp": 4102444800})}.synthetic'


def owner(authorization):
    return next((uid for uid in (USER, OTHER) if authorization == f'Bearer {token(uid)}'), None)


def seed():
    now = datetime.now(timezone.utc)
    iso = lambda hours: (now - timedelta(hours=hours)).isoformat()
    common = dict(created_at=stamp(), updated_at=stamp())
    TABLES.clear()
    TABLES.update({
        'user_profiles': [dict(id=USER, display_name='Demo Student', usual_bedtime='23:00:00',
            usual_wake_time='07:00:00', sleep_goal_minutes=None, caffeine_frequency='daily',
            caffeine_sensitivity='medium', selected_side_effects=[], initial_energy_rating=None,
            preferences_completed=False, **common)],
        'sleep_sessions': [dict(id=str(uuid4()), user_id=USER, started_at=iso(12), ended_at=iso(4),
            duration_seconds=28800, sleep_quality=4, **common)],
        'nap_sessions': [],
        'caffeine_logs': [dict(id=str(uuid4()), user_id=USER, beverage_name='Demo coffee', caffeine_mg='95',
            serving_size_ml='237', consumed_at=iso(2), logging_method='manual', **common)],
        'caffeine_presets': [dict(id=key, beverage_name=name, caffeine_mg=mg, serving_size_ml=ml, **common)
            for key, name, mg, ml in [('brewed-coffee', 'Brewed coffee', 95, 237),
                ('espresso-single', 'Espresso — single shot', 63, 30),
                ('espresso-double', 'Espresso — double shot', 126, 60),
                ('black-tea', 'Black tea', 47, 237), ('green-tea', 'Green tea', 28, 237)]],
        'energy_checkins': [],
    })


seed()


def matches(row, field, expression):
    if expression == 'is.null':
        return row.get(field) is None
    if expression == 'not.is.null':
        return row.get(field) is not None
    operator, value = expression.split('.', 1)
    actual = row.get(field)
    if operator == 'eq':
        return str(actual) == value
    if actual is None:
        return False
    # All range-filtered fields in this fixture are timestamps.
    actual = datetime.fromisoformat(actual.replace('Z', '+00:00'))
    expected = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return {'gte': actual >= expected, 'lte': actual <= expected,
            'gt': actual > expected, 'lt': actual < expected}[operator]


def transport(request):
    uid = owner(request.headers.get('authorization'))
    if not uid:
        return httpx.Response(401, json={'message': 'Invalid synthetic token'})
    if request.url.path == '/auth/v1/user':
        return httpx.Response(200, json=identity(uid))
    table = request.url.path.rsplit('/', 1)[-1]
    rows = TABLES[table]
    ownership = 'id' if table == 'user_profiles' else 'user_id'
    selected = [r for r in rows if table == 'caffeine_presets' or r.get(ownership) == uid]
    for field, expression in request.url.params.multi_items():
        if field in {'select', 'order', 'offset', 'limit', 'on_conflict'}:
            continue
        if field == 'and':
            for condition in expression[1:-1].split(','):
                key, predicate = condition.split('.', 1)
                selected = [r for r in selected if matches(r, key, predicate)]
        else:
            selected = [r for r in selected if matches(r, field, expression)]
    body = json.loads(request.content) if request.content else {}
    if request.method == 'POST':
        if body.get(ownership) != uid:
            return httpx.Response(403, json={'code': '42501'})
        if table in {'sleep_sessions', 'nap_sessions'} and not body.get('ended_at') and any(
            r.get('user_id') == uid and r.get('ended_at') is None for r in rows
        ):
            return httpx.Response(409, json={'code': '23505'})
        if table == 'user_profiles' and selected:
            selected[0].update(body)
        else:
            new = {'id': str(uuid4()), 'created_at': stamp(), 'updated_at': stamp(), **body}
            if table.endswith('_sessions'):
                new.setdefault('ended_at', None)
                new.setdefault('sleep_quality' if table == 'sleep_sessions' else 'refreshed_rating', None)
            if table == 'user_profiles':
                new.setdefault('preferences_completed', False)
            rows.append(new)
            selected = [new]
    if request.method == 'PATCH':
        for row in selected:
            row.update(body, updated_at=stamp())
    if table.endswith('_sessions'):
        for row in selected:
            row['duration_seconds'] = ((datetime.fromisoformat(row['ended_at'].replace('Z', '+00:00')) -
                datetime.fromisoformat(row['started_at'].replace('Z', '+00:00'))).total_seconds()
                if row['ended_at'] else None)
    if request.method == 'DELETE':
        for row in selected:
            rows.remove(row)
    order = request.url.params.get('order')
    if order:
        for key in reversed(order.split(',')):
            field, direction = key.split('.')
            selected.sort(key=lambda r: r[field], reverse=direction == 'desc')
    offset = int(request.url.params.get('offset', 0))
    limit = int(request.url.params.get('limit', len(selected)))
    return httpx.Response(200, json=selected[offset:offset + limit])


async def client():
    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as c:
        yield c


app.dependency_overrides[get_auth_client] = client
app.dependency_overrides[get_settings] = make_settings

# Native Supabase SDK can sign into this local fixture, with no external traffic.
@app.post('/auth/v1/token')
@app.post('/auth/v1/signup')
async def demo_login():
    return dict(access_token=token(), refresh_token='synthetic-refresh', expires_in=3600,
                token_type='bearer', user=identity())


@app.get('/auth/v1/user')
@app.put('/auth/v1/user')
async def demo_user(request: Request):
    uid = owner(request.headers.get('authorization'))
    return JSONResponse(identity(uid), status_code=200) if uid else JSONResponse({}, status_code=401)


@app.post('/auth/v1/recover')
async def demo_recover():
    return {}  # No email is sent by this fixture.


@app.post('/auth/v1/logout')
async def demo_logout():
    return Response(status_code=204)
