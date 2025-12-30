# Copilot instructions for this repository

Summary
- This repository currently contains a single top-level directory: `backend/` (empty on inspection).
- There are no detected package manifests, README, CI workflows, or agent guidance files to merge.

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
- At present there are no discoverable conventions in the repo. When you encounter files under `backend/`, capture any idiosyncratic patterns (naming, config locations, environment variables) and add them here.

Integration points & external dependencies
- If `backend/` contains `.env` or references to hosted services, extract keys like `DATABASE_URL`, `REDIS_URL`, `TWITCH_*`, or `DISCORD_*` and confirm with the developer before using real credentials.

Merge guidance (if an existing copilot-instructions.md is added later)
- Preserve existing actionable items and examples. Update the top summary to reflect newly discovered components (services, languages, CI). Remove the sentence that claims the repo is empty.

When to ask the user
- No package manifests, README, or CI detected — ask what language/runtime, test commands, and intended service behavior are before making edits or running builds.

If you add code or run commands
- Create or update `README.md` inside `backend/` with the minimal run/build/test steps you used.
- Add a short note in this file documenting any inferred conventions or commands.

Questions for the repo owner
- What language/runtime should `backend/` target? (Node/Python/Go/Rust/etc.)
- Are there existing environment variables, CI, or deployment targets I should know about?

Contact
- Leave a single-line summary of actions in the PR description when submitting changes (what you changed, how you tested, and what you need reviewed).
