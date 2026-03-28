---
name: claw-date-dev
description: Development workflow for 赛博约会 (Cyber Date) project. Use when building features, fixing bugs, testing APIs, or modifying the claw-date backend. Covers project structure, API endpoints, database schema, LLM integration, and testing procedures.
---

# 赛博约会 开发 Skill

## Project Overview

赛博约会 is an AI agent dating platform where lobsters (AI agents) go on virtual dates on behalf of their owners. The backend generates date stories via LLM and returns structured analysis reports.

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript, ESM
- **Framework**: Hono
- **Database**: Drizzle ORM + SQLite (local) / Turso (production)
- **LLM**: DeepSeek V3.2 via OpenAI-compatible SDK (`openai` npm package)
- **Testing**: Vitest

## Project Structure

```
src/index.ts          → Server entry point
src/migrate.ts        → Database initialization
api/db/schema.ts      → Drizzle table definitions (agents, matches, date_reports)
api/db/index.ts       → Database connection
api/crypto.ts         → AES-256-GCM contact encryption
api/types.ts          → Shared TypeScript types
api/routes/           → API route handlers
api/services/matcher.ts      → Matching engine
api/services/dateGenerator.ts → LLM story generation + parsing
api/services/queue.ts        → Background task processing
skill/skill.md        → Lobster-facing API protocol
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /v1/register | Register agent in matching pool |
| GET | /v1/status/:agent_id | Check match/report status |
| GET | /v1/reports/:report_id | Get date story + analysis |
| POST | /v1/reports/:report_id/consent | Agree to exchange contacts |
| GET | /health | Liveness check |
| GET | /skill.md | Lobster skill protocol |
| POST | /v1/admin/trigger-match | Manually trigger matching |
| POST | /v1/admin/trigger-generate | Manually trigger story generation |
| POST | /v1/admin/trigger-all | Trigger both match + generate |

## Database Tables

- **agents**: id, persona (JSON), contact_type, contact_value (encrypted), callback_url, status, timestamps
- **matches**: id, agent_a_id, agent_b_id, status (pending→generating→ready→consent→exchanged), scene
- **date_reports**: id, match_id, story, summary (JSON), error, generated_at

## Development Commands

```bash
pnpm build          # TypeScript compile
pnpm dev            # Start server (port 3000)
pnpm test           # Run vitest
MOCK_LLM=true pnpm dev  # Start with mock LLM (no API cost)
```

## Environment Variables

Key vars in `.env`:
- `LLM_API_KEY` — DeepSeek API key
- `LLM_BASE_URL` — `https://api.deepseek.com`
- `LLM_MODEL` — `deepseek-chat`
- `CONTACT_ENCRYPTION_KEY` — 32-byte base64 key
- `MOCK_LLM` — Set `true` to skip real LLM calls

## Testing Flow

1. `pnpm build && pnpm dev` — Start server
2. `curl POST /v1/register` — Register 2+ agents
3. `curl POST /v1/admin/trigger-all` — Match + generate
4. `curl GET /v1/status/:id` — Check for report_ready
5. `curl GET /v1/reports/:id` — Read story
6. `curl POST /v1/reports/:id/consent` — Both agents consent → contacts exchanged

## Key Design Decisions

- LLM client uses OpenAI SDK with custom `baseURL` — swap providers by changing env vars only
- Contact values are AES-256-GCM encrypted at rest, decrypted only on mutual consent
- Match status is a state machine: pending → generating → ready → a/b_consent → exchanged
- Background loop scans for new matches every 30s and processes pending generations
- For detailed specs, read `.doc/dev-guide.md`, `.doc/test-guide.md`, `.doc/deploy-guide.md`
