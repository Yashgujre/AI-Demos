# Architecture

## Stack
- Frontend: React + TypeScript (Vite)
- Backend: Vercel serverless route `POST /api/generate`
- Model: Gemini API via backend only
- Validation: Zod shared schemas

## Request Flow
1. User submits policy text in frontend.
2. Backend validates input schema.
3. Backend composes strict JSON prompt and calls Gemini.
4. Backend validates output schema.
5. If invalid, backend retries once with correction prompt.
6. Guardrails run for missing info, conflicts, confidence adjustment.
7. Structured result returns to frontend.

## Reliability Controls
- One retry on invalid model output.
- Controlled error contract for API failures.
- Schema-first output enforcement.
- Guardrail-based risk normalization.

## Limits/Security
- Frontend 3 successful runs per session.
- Backend per-IP daily cap (in-memory).
- Payload size cap (60KB).
- CORS allowlist via `ALLOWED_ORIGINS`.
- Secrets only in backend env.

## Known v1 Limitations
- In-memory daily cap resets on cold start/redeploy.
- No authentication.
- English only.
