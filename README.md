# Policy-to-Action Copilot (Healthcare v1)

Recruiter-facing AI demo that converts healthcare policy/SOP text into an audit-ready execution plan.

## Monorepo Layout
- `frontend/`: React app
- `backend/`: Vercel serverless API
- `shared/`: shared Zod schemas and scenario fixtures
- `evals/`: deterministic eval runner
- `docs/`: architecture and demo script

## Quick Start
1. Install dependencies
```bash
npm install
npm --prefix frontend install
```
2. Configure env
- Copy `.env.example` values into your Vercel/project env.
- Copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_BASE_URL`.

3. Run frontend
```bash
npm run dev
```

## API
`POST /api/generate`
- Input and output contracts are in `shared/schema.mjs`.

## Evals
Runs deterministic fixtures with mock model mode by default:
```bash
npm run evals
```

To test live model behavior, run with `MOCK_MODEL=0` and provide `GEMINI_API_KEY`.

## Deployment
- Frontend: GitHub Pages
- Backend: Vercel (routes defined in `vercel.json`)
