# Escabot — spec

Public chat agent that answers Formula 1 questions in Spanish (Mexico). Fan homage to podcast host Alex Escalera: the persona is **Escabot**, an aluminum step ladder with eyes and a red cap. Hobby, non-commercial.

Avatar mockup: [`docs/escabot-mockup.html`](docs/escabot-mockup.html).

## Scope

- **In:** F1 questions, seasons 1950–2025.
- **Out:** 2026+ data, F1TV, OpenF1, telemetry, logins, stored chat history, voice, RAG (all v2-or-never).
- Off-topic questions are refused in character.

## Data

- Source: Jolpica-F1 CSV dump, free delayed tier, no key: `GET https://api.jolpi.ca/data/dumps/download/delayed/?dump_type=csv` (zip, ~15 MB → 43 MB CSV, 18 tables, `formula_one_*.csv`).
- License: **CC BY-NC-SA 4.0** → visible credit, no monetization.
- Jolpica's schema is **not** Ergast's. Chain: `driver → teamdriver (season, team) → roundentry (round) → sessionentry (session)`.
  - `session.type`: `R` race, `Q1/Q2/Q3` + `QA/QB/QO` qualifying variants, `SR` sprint, `SQ1-3` sprint quali, `FP1-3` practice.
  - `sessionentry.status` is a numeric code; human text in `detail`. Map codes from Jolpica source before writing views.
  - `driverchampionship` / `teamchampionship` hold standings **per round**; final standings = last round of the season.
  - Dump includes 2026 rows → filter `year <= 2025` at import.
- Storage: **SQLite file `data/f1.db` (~17 MB, committed)** shipped with the app, built by `npm run build:db` (`scripts/build-db.mjs` + `db/build.sql`), checked by `npm run check:db`. Driver: built-in `node:sqlite` (Node ≥22.13), no dependency.
- Lap-by-lap times are dropped for size; only each entry's fastest lap stays (`fastest_lap`, also exposed as `best_lap_time`). Pit stops keep their lap number.
- Qualifying sessions only exist from 1994. **Poles = race grid 1** (`poles` view), which matches official totals.
- **Flat tables/views for the model:** `races`, `session_results` (+ views `race_results`, `sprint_results`, `qualifying_results`, `poles`), `driver_standings_final`, `team_standings_final`, `drivers`, `teams`, `circuits`. The model queries these first; raw Jolpica tables are the fallback.
- Opened with `readonly: true` + `PRAGMA query_only = ON`.

## Agent

- Next.js (App Router) + TypeScript + npm, one repo, deployed to Vercel Hobby at `escabot.vercel.app`.
- Vercel AI SDK: `streamText` + `useChat`, provider `@ai-sdk/openai-compatible`.
- Model-agnostic via env: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (start: DeepSeek `deepseek-chat`).
- Tools:
  - One tool, `run_sql(query)`: single SELECT only, 200-row cap, read-only connection. The schema (columns read from the DB) and query notes live in the system prompt, so no `describe_schema` round trip.
  - Code: `lib/agent.ts` (model, prompt, tool), `lib/db.ts`, `app/api/chat/route.ts` (last 10 messages, 1000 chars max per message).
- Max **6** steps per answer. The model does all queries first, then writes one message.
- Answer rules (system prompt, Spanish):
  - Always reply in es-MX.
  - **No number without a query.** Rules, nicknames and history may come from model knowledge.
  - Every answer ends with **"🪜 Alex facts:"**, a related fact that must come from an extra DB query.
  - Off-topic → refuse with humor + a random Alex fact (from a query).
  - Short glossary in prompt: Mexican nicknames/slang (Checo → `perez`, Hermanos Rodríguez → `rodriguez`, …).
  - Persona tone + catchphrases: `docs/persona.md` (goes into the system prompt).
- The answer's first line is a mood tag `[mood:neutral|happy|surprised|offtopic|error]`; the UI strips it and sets the avatar. `thinking` is set by the UI while tools run.

## UI

- Single chat, comic speech bubbles from Escabot; user bubbles on the right; tables inside bubbles.
- Collapsible **"¿Cómo lo calculé?"** showing the SQL that ran.
- Escabot is inline SVG + CSS animations (see mockup), honors `prefers-reduced-motion`. `thinking` while tools run.
- Welcome screen: greeting + 4 clickable example questions.
- Chat lives in `localStorage` only; "Nueva conversación" button; last 10 messages sent to the model.
- Errors/rate limit shown in character ("No se me abrió el DRS, intenta en un rato"; see `docs/persona.md`) with the `error` state.
- Footer: `Datos: Jolpica-F1 (CC BY-NC-SA 4.0) · Homenaje de fans, no oficial ni afiliado a Alex Escalera`.

## Abuse & cost

- Rate limit: 20 messages / IP / hour (Upstash Redis free tier).
- DeepSeek: prepaid credit only, no auto-recharge.
- No server-side logging of questions beyond Vercel defaults.

## Quality

- `evals/golden.json`: 20–30 Spanish questions with expected answers, **written by the user** (include Checo, sprints, wins vs podiums, 1950s shared drives).
- `npm run eval` runs them against the agent locally. Not in CI (costs credit).

## Repo

- Public GitHub repo. `.env` git-ignored; keys only in Vercel env vars.

## Phases

1. **Data:** ✅ done. `npm run build:db` + `npm run check:db` (26/26 golden data checks pass).
2. **Agent:** ✅ done. Last full `npm run eval`: 29/30 (model-graded, plus mood tag and Alex facts checks); the failure was the golden wording for #27, fixed and passing 3/3 since.
3. **UI:** ✅ built (`app/page.tsx`, `app/Escabot.tsx`, `app/globals.css`, rate limit in `lib/ratelimit.ts`; production refuses requests when Redis isn't configured). Deploy pending: GitHub repo, Vercel project, Upstash Redis, `LLM_API_KEY` in Vercel.
4. **Later (maybe):** OpenF1 tool, Wikipedia ES RAG, 2026 updates.
