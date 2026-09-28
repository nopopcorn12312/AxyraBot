# Copilot instructions for this repository

Summary
- This repository contains a Go backend in `backend/`, a Next.js frontend in `frontend/`, and a Render deployment manifest.
- Backend routes, Discord integration, and database operations are implemented in the Go service; frontend pages use Next.js and TypeScript.

Primary goal for AI agents
- Be conservative: the codebase has minimal discoverable structure. Ask the developer before making assumptions about language, runtime, or CI.

What to do first (quick checklist)
- Inspect `backend/` for language-specific files: `package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, `Dockerfile`, `.env`, `README.md`.
- If none exist, ask the user: "Which language/runtime and entrypoint should I target for `backend/`?" and request any missing READMEs or run instructions.

How to infer architecture (when files exist)
- Look for `src/`, `cmd/`, or `app/` for service code; `routes`, `controllers`, or `api` indicate HTTP services.
- Presence of `migrations/`, `prisma/`, or `alembic/` implies a relational DB; check `DATABASE_URL` in env files.
- `Dockerfile` or `docker-compose.yml` often encode build/run commands — prefer those as authoritative.

Developer workflows (what to look for and use)
- Preferred run/build commands are taken from manifest files: `npm run`, `poetry run`, `go build`, `cargo build`, etc. Only run them after confirming with the user if manifests are missing.
- Tests: look for `tests/`, `pytest.ini`, `jest.config.js`, or `*_test.go`. Run tests only after confirming the environment and installing deps.

Project-specific conventions
- Backend environment settings are read from environment variables; webhook endpoints should authenticate provider signatures before processing events.
- The Go backend test command is `go test ./...` from `backend/`; the frontend type check is `npx tsc --noEmit` from `frontend/`.

Integration points & external dependencies
- If `backend/` contains `.env` or references to hosted services, extract keys like `DATABASE_URL`, `REDIS_URL`, `TWITCH_*`, or `DISCORD_*` and confirm with the developer before using real credentials.

Merge guidance (if an existing copilot-instructions.md is added later)
- Preserve existing actionable items and examples. Update the top summary to reflect newly discovered components (services, languages, CI). Remove the sentence that claims the repo is empty.

When to ask the user
- Ask when an external integration needs credentials, a destination identifier, or deployment values that are not present in the repository; do not invent or commit secrets.

If you add code or run commands
- Update `backend/README.md` with setup details for new backend integrations.
- Keep environment variable names and commands documented here when they become stable repository conventions.

Questions for the repo owner
- Are there external credentials or deployment values that are not represented in the repository?

Contact
- Leave a single-line summary of actions in the PR description when submitting changes (what you changed, how you tested, and what you need reviewed).
