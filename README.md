# Energy

Energy tracking app: sleep, caffeine, naps, and energy insights.

## Structure

- `mobile/` — React Native + Expo (Expo Router) app
- `backend/` — Python + FastAPI API (`src/energy_api`)
- `database/` — SQL migrations

## Getting started

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn energy_api.main:app --reload
```

### Mobile

```bash
cd mobile
npm install
npm start
```
