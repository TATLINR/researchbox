# Repository Guidelines

## Project Structure & Module Organization

Researchbox is split into two top-level apps:

- `backend/`: FastAPI service using MongoDB through Motor.
- `backend/uygulama/`: Python application modules (`ana.py`, `veritabani.py`, `guvenlik.py`, `semalar.py`, `ayarlar.py`).
- `frontend/`: Vite + React application.
- `frontend/kaynak/`: React source, CSS, components, and API helpers.
- `frontend/kaynak/bilesenler/`: reusable UI and visual components.
- `frontend/kaynak/yardimcilar/`: shared frontend helpers.

There is no dedicated test directory yet. Add backend tests under `backend/testler/` and frontend tests under `frontend/kaynak/**/__testler__/` when introducing automated coverage.

## Build, Test, and Development Commands

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r gereksinimler.txt
python -m uvicorn uygulama.ana:uygulama --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run derle
```

MongoDB local helper:

```bash
docker run --name researchbox-mongo -p 27017:27017 -d mongo:7
```

Use `python -m compileall backend/uygulama` for a quick backend syntax check.

## Coding Style & Naming Conventions

Keep project-owned folders, files, variables, functions, and UI copy in Turkish where practical. Ecosystem-required files such as `package.json`, `index.html`, and `vite.config.js` keep their standard names. Use 4-space indentation for Python and 2-space indentation for JSX, CSS, and JSON. Keep code comments out unless a short note prevents real confusion.

## Testing Guidelines

No formal test runner is configured yet. For now, verify backend changes with `compileall` and frontend changes with `npm run derle`. For UI behavior, use Playwright smoke checks with mocked API responses before relying on a running MongoDB instance.

## Commit & Pull Request Guidelines

This directory has no readable git history, so no existing commit convention is established. Use concise imperative commits such as `feat: add topic search endpoint` or `fix: sync saved topics with backend`. Pull requests should include a short summary, verification commands run, linked issue if any, and screenshots for frontend changes.

## Security & Configuration Tips

Do not commit real secrets. Use `backend/.env.ornek` and `frontend/.env.ornek` as templates. Rotate `JWT_GIZLI_ANAHTAR` outside local development and keep MongoDB credentials in environment variables.
