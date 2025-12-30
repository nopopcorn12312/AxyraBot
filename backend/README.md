# AxyraBot (backend)

This folder contains a minimal Go-based Twitch bot example named AxyraBot.

What it does
- Connects to Twitch IRC over WebSocket (wss://irc-ws.chat.twitch.tv) and responds to `!test` with `SUCCESS`.
- Connects to Twitch EventSub WebSocket (wss://eventsub.wss.twitch.tv/ws) and logs incoming events.
- Optionally registers EventSub subscriptions (when enabled via env).
- Can use Postgres (Neon, etc.) to store channels/tokens and join channels via HTTP.

Files
- `main.go` — bot implementation
- `http.go` — OAuth + join HTTP endpoints
- `db.go` / `notifier.go` — Postgres schema and LISTEN/NOTIFY
- `go.mod` — module definition
- `.env.example` — example environment variables

Key environment variables
- `TWITCH_BOT_USERNAME` — bot username (default: AxyraBot)
- `TWITCH_BOT_OAUTH` — bot OAuth token (format: `oauth:xxxxxxxx...`)
- `TWITCH_CLIENT_ID` — Twitch application client ID
- `TWITCH_CLIENT_SECRET` — Twitch application client secret
- `TWITCH_CHANNEL` — default channel to join (e.g. `nopopcorn`).
- `TWITCH_TOKENS_PATH` — optional path to `tokens.json`; defaults next to the binary.
- `TWITCH_EVENTSUB_ENABLED` — set to `1` to register EventSub subscriptions, `0` to skip.
- `TWITCH_OAUTH_REDIRECT` — external redirect URL override for `/auth/start` (useful on Render).
- `DATABASE_URL` — Postgres connection string (optional for multi-channel + web join flow).

How to run locally
1. Populate environment variables (see `.env.example`).
2. From this folder run:

```bash
go mod tidy
go run ./
```

Deploying on Render (summary)
- There is a top-level `render.yaml` that defines a Go web service using this `backend` folder.
- On Render, set the same env vars as above (especially `TWITCH_BOT_OAUTH`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_CHANNEL`).
- The HTTP server will listen on `:$PORT` automatically; EventSub registration can be toggled via `TWITCH_EVENTSUB_ENABLED`.
