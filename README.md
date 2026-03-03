# Pulse Partner Hub (Flask + React)

Simple login application with:
- Email/password authentication
- Default seeded admin user (`admin@pulseph.com` / `admin123`)
- Per-user sector assignment (single or multiple sectors)
- Sector-based company dropdown (companies change when sector changes)
- Material Topic Benchmark card powered by `backend/data/material_topics.json`
- Navbar with logo placeholder, Sector + Company dropdowns, user menu (Settings/Logout)
- Settings screen for profile and password update
- Admin-only `Users` tab to add/edit/delete users and assign sectors
- Time-based greeting (Good Morning/Afternoon/Evening)

## Project Structure

- `backend/` Flask API + JSON-based user store
- `frontend/` React (Vite) web app

## Backend Setup

1. Open terminal in `backend/`
2. Create and activate venv
3. Install packages
4. Start server

PowerShell commands:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Backend runs on `http://127.0.0.1:5000`.

### User/auth storage

- User/login/admin management is stored in `backend/data/users.json`.
- In serverless environments (like Vercel), if app files are read-only, the app automatically uses `/tmp/partnerhub/users.json` at runtime.
- Serverless `/tmp` storage is ephemeral and may reset between invocations/deployments.

### OpenAI setup (for priority moves + best practices)

1. Copy `backend/.env.example` to `backend/.env`
2. Add your key in `OPENAI_API_KEY`
3. Optional: change `OPENAI_MODEL` (default is `gpt-4o-mini`)

If no key is provided, the app uses deterministic fallback text for these insights.

## Frontend Setup

Open second terminal in `frontend/`:

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on `http://127.0.0.1:5173` and proxies `/api` to Flask.

## Default Admin Login

- Email: `admin@pulseph.com`
- Password: `admin123`

Users can change passwords from Settings.

## Manually Add Users

Use this script from `backend/` while backend dependencies are installed:

```powershell
python create_user.py --email user@pulseph.com --password temp123 --first-name Jane --last-name Doe --sectors "Consumer Products,Mining,Construction Materials"
```

To create an admin user:

```powershell
python create_user.py --email admin2@pulseph.com --password temp123 --first-name Alex --last-name Admin --is-admin --sectors "Consumer Products,Private Equity"
```

## Fixed Sectors

Backend is configured to use only these sectors and companies:

```json
{
	"Consumer Products": ["Nestlé", "Unilever", "PepsiCo", "Kraft Heinz", "Danone"],
	"Mining": ["Anglo American", "BHP", "Rio Tinto", "Teck", "Glencore"],
	"Construction Materials": ["Heidelberg Materials", "Holcim", "Cemex", "CRH"],
	"Private Equity": ["CVC", "EQT", "Blackstone", "KKR"]
}
```

## Logo Placeholder

Current navbar includes a logo placeholder box. Replace this with your image later (for example `frontend/public/Logo.png`) and update UI as needed.

## GitHub Upload Checklist

Before pushing to GitHub, keep only source + config files in the repo.

### 1) Do not commit local/runtime artifacts

This repo is already configured to ignore:
- `backend/.env`
- `backend/.venv/`
- `backend/app.db`
- `frontend/node_modules/`
- `frontend/dist/`

### 2) Initialize Git (if not initialized)

From project root:

```powershell
git init
git add .
git commit -m "Initial commit"
```

### 3) Create GitHub repo and push

After creating an empty repo on GitHub:

```powershell
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 4) Post-upload setup for collaborators

1. Copy `backend/.env.example` to `backend/.env`
2. Add values for `OPENAI_API_KEY`, optional `OPENAI_MODEL`, and `SECRET_KEY`
3. Run backend and frontend setup steps from this README

## Vercel Deployment (Monorepo)

This repo contains both frontend and backend. Deployment is configured with root `vercel.json`:
- Frontend: `frontend/` (Vite static build)
- API: `backend/app.py` (Flask serverless function)
- Routing: `/api/*` → Flask, all other routes → frontend app

### Required Vercel settings

1. In Vercel, import the GitHub repo.
2. Keep **Root Directory** as repo root (do not set to `frontend`).
3. Vercel should use the checked-in `vercel.json` automatically.

### Required Environment Variables (Vercel Project)

Set these in Project Settings → Environment Variables:
- `SECRET_KEY`
- `OPENAI_API_KEY` (optional; if omitted, fallback text is used)
- `OPENAI_MODEL` (optional, default `gpt-4o-mini`)
- `APP_VERSION` (recommended; use the same value for frontend build + backend runtime, e.g. commit SHA)

After setting env vars, trigger a fresh deploy.

### Free alternative to paid skew protection

To reduce client/server version mismatch issues (e.g., chunk 404s after deploy):
- Frontend build embeds `APP_VERSION` (or `VERCEL_GIT_COMMIT_SHA` when available)
- Backend exposes `/api/version`
- Client compares versions at startup and performs a one-time hard reload on mismatch
- Client also performs one-time hard reload if dynamic chunk load fails
- Vercel is configured to serve `/` and `/index.html` with `Cache-Control: no-store`
