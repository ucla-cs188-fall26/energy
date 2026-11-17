# Energy

EnergySync tracks sleep and caffeine and estimates your energy throughout the day.

## Assignment 3: Setup and run

These instructions use the iOS Simulator on macOS. Install **Python 3.11+**, **Node.js 22 (22.13 or later)**, **Xcode with an iOS Simulator**, and **CocoaPods** first. Use an Expo development build, not Expo Go.

### 1. Prepare Supabase

- Use a Supabase project with email/password authentication enabled.
- For a new database, run all eight files in `database/migrations/` in order, from `01_create_user_profiles.sql` through `08_preferences_profile_fields.sql`.Skip migrations already applied.
- Add `energyapp://auth/callback` to the allowed authentication redirect URLs.
- Get the project's URL and **publishable key** (`sb_publishable_...`). Both apps must use the same project.

### 2. Install backend dependencies

From the repository root:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
cp -n .env.example .env
```

Set these values in `backend/.env`. Leave the other example settings unchanged.

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

### 3. Install frontend dependencies

In a new terminal, from the repository root:

```sh
cd mobile
npm ci
cp -n .env.example .env
```

Set these values in `mobile/.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```

Keep these files private.

### 4. Start FastAPI and Expo

Keep both terminals running.

**Backend terminal** (inside `backend/`):

```sh
source .venv/bin/activate
python -m uvicorn energy_api.main:app --reload --port 8000
```

Check [backend health](http://127.0.0.1:8000/health): it should return `{"status":"ok"}`. API documentation is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

**Frontend terminal** (open a second terminal at the repository root, inside `mobile/`):

```sh
cd mobile
npx expo start --clear
```

Once Expo starts, press **`i`** to open EnergySync in the iOS Simulator. Keep this terminal running, with FastAPI running on port **8000** in the backend terminal.

If the iOS development build is not installed, stop Expo and run this inside `mobile/`:

```sh
npx expo run:ios
```

This builds and installs the native app. You generally only need it for initial setup or after native dependency/configuration changes.

After changing `mobile/.env`, stop Expo and run `npx expo start --clear` again.

On a physical phone, replace `127.0.0.1` with your Mac's reachable network address and start FastAPI with `--host 0.0.0.0`.

### 5. Run the core demo

1. **Log in** with a test account. For a new account, choose **Get started**, complete setup, and sign up. If prompted to verify your email, open the link on the same device that requested it, then log in.
2. **Check the connection:** open **Account → Verify backend connection**. Your email should appear in the success message.
3. **Track sleep:** open **Sleep → Start sleep**, then **Stop sleep**. Answer **How refreshed do you feel?** (1–5) on the screen that appears. Check **History** for the saved entry with its duration and rating.
4. **Log caffeine:** open **Caffeine** and select a quick-add drink. For a custom drink, choose **Add another drink → Other**, enter its name, caffeine in mg, and serving volume in ml, then log it. Check the daily total; use the edit/delete controls to change an entry.
5. **View prediction:** return to **Home** to see the energy circle, caffeine remaining, and hourly forecast update from your recorded data. Energy is unavailable without recent completed sleep or while sleep/a nap is active. The score is a formula estimate, not a validated measurement.
6. **Optional:** log a nap with a refreshed rating, or record a 1–10 energy rating under **Insights**. Reload the app to check that your login and saved history persist.

### Tests

Inside `backend/`, with the virtual environment activated, run `python -m pytest`.

Inside `mobile/`, run `npm test` and `npm run typecheck`. The frontend contract tests also require the backend virtual environment.
