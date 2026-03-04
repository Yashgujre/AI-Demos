![Deploy](https://github.com/Yashgujre/AI-Demos/actions/workflows/deploy-frontend.yml/badge.svg)
[![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Vercel%20%7C%20Gemini-0D6E6E)](https://github.com/Yashgujre/AI-Demos)
**[Live Demo →](https://yashgujre.github.io/AI-Demos/)**

# Policy-to-Action Copilot

Convert healthcare policy/SOP text into a structured, execution-ready action plan with guardrails, confidence scoring, and audit-friendly output.

## Why this project exists
Most policy text is dense, ambiguous, and hard to operationalize quickly. This system converts policy text into concrete execution steps while making uncertainty and conflicts explicit.

## What it does
- Accepts policy text + context as input.
- Returns strictly structured JSON output.
- Produces prioritized actions, ownership suggestions, risk/compliance flags, and a stakeholder update draft.
- Detects ambiguity and conflicting policy clauses.
- Applies confidence scoring and caution signaling.

## Core capabilities
- Schema-first generation (input and output contracts validated with Zod).
- Retry-on-invalid-output (one corrective retry).
- Guardrails for missing information and conflicts.
- Public demo usage controls:
  - frontend session cap (3 successful runs)
  - backend per-IP daily cap (in-memory)
- Deterministic eval harness with scenario-based checks.

## Architecture at a glance
- Frontend: React + TypeScript (Vite)
- API: Vercel Serverless (`/api/generate`)
- Shared contracts: `shared/schema.mjs`
- Model provider: Gemini API (backend only)
- Mock mode: deterministic responses for zero-cost demos/tests

For full internal details: [System Documentation](./docs/SYSTEM_DOCUMENTATION.md)

## Repository structure
- `frontend/` UI application
- `backend/` serverless route + model orchestration
- `api/` Vercel API entrypoint
- `shared/` schemas and scenario fixtures
- `evals/` evaluation runner
- `docs/` architecture and operating docs

## API contract
### Endpoint
`POST /api/generate`

### Input
```json
{
  "policy_text": "string",
  "domain": "healthcare",
  "urgency": "low | medium | high",
  "organization_context": "string",
  "requester_role": "string (supported role value)"
}
```

### Output
```json
{
  "summary": "string",
  "priority_level": "low | medium | high | critical",
  "actions": [
    {
      "step": "string",
      "owner_role": "string",
      "due_window": "string",
      "reason": "string"
    }
  ],
  "compliance_flags": [
    {
      "flag": "string",
      "severity": "low | medium | high",
      "evidence": "string"
    }
  ],
  "missing_information": ["string"],
  "stakeholder_update_draft": "string",
  "confidence_score": 0.0,
  "audit_log": {
    "policy_constraints_detected": ["string"],
    "assumptions_made": ["string"]
  }
}
```

### Error format
```json
{
  "error_code": "RATE_LIMITED | VALIDATION_FAILED | MODEL_ERROR | BAD_REQUEST",
  "message": "string",
  "details": "string | null"
}
```

## Local setup
### 1) Install
```bash
npm install
npm --prefix frontend install
```

### 2) Frontend env
```bash
cp frontend/.env.example frontend/.env
```
Set:
```bash
VITE_API_BASE_URL=http://localhost:3000
```

### 3) Backend env (optional for live model)
- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-2.0-flash`
- `ALLOWED_ORIGINS=http://localhost:5173`
- `DAILY_IP_CAP=40`
- `MOCK_MODEL=1` (recommended for deterministic local testing)

### 4) Run backend
```bash
npx vercel dev
```

### 5) Run frontend (separate terminal)
```bash
npm run dev
```

## Evaluation harness
Run deterministic checks:
```bash
npm run evals
```

Checks include:
- schema validity
- required field presence
- missing-information behavior
- conflict-flag behavior
- confidence-threshold behavior

## Deployment
### Backend
- Deploy on Vercel from repo root.
- Production API base: `https://ai-demos-policy-copilot.vercel.app`

### Frontend
- Deploy to GitHub Pages with `.github/workflows/deploy-frontend.yml`.
- Add repository secret:
  - `VITE_API_BASE_URL=https://ai-demos-policy-copilot.vercel.app`

## Security notes
- API keys are backend-only.
- Frontend never embeds model credentials.
- CORS allowlist is enforced via `ALLOWED_ORIGINS`.
- Request size is capped to reduce abuse.

## Bring Your Own Key
- You can provide your own Gemini API key in the UI when public demo limits are reached.
- The key is memory-only and session-scoped (React state only), and is cleared when the tab is closed.
- The app does not persist or log your key.
- BYOK requests send the key only in the request header for model calls.
- Create a key in [Google AI Studio](https://aistudio.google.com/apikey).

## Useful docs
- [System Documentation](./docs/SYSTEM_DOCUMENTATION.md)
- [Architecture Notes](./docs/ARCHITECTURE.md)
- [Demo Script](./docs/DEMO_SCRIPT.md)
- [Healthcare Policy Copilot](./docs/Healthcare%20Policy%20Copilot.md)
