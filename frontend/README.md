# AxyraBot Frontend

This is the Next.js + Tailwind CSS frontend for AxyraBot.

## Tech Stack

- Next.js (App Router, TypeScript)
- React 18
- Tailwind CSS

## Getting Started (local)

From the `frontend` folder:

```bash
npm install
npm run dev
```

Then open http://localhost:3000 in your browser.

The home page is a dark landing screen with a hero card and a **Connect my Twitch** button.

### Backend URL

The CTA on the home page points to your backend `/auth/start` endpoint using the `NEXT_PUBLIC_BACKEND_URL` environment variable.

Set it in a `.env.local` file in the `frontend` folder:

```bash
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
```

Replace the URL with your actual backend (for example, your Render service URL).

## Deploying to Vercel

1. Push this project to GitHub (it already lives inside your main repo under `frontend/`).
2. In Vercel, create a new project and import your GitHub repo.
3. When asked for the framework, Vercel will auto-detect **Next.js**.
4. Set the **root directory** to `frontend`.
5. Add `NEXT_PUBLIC_BACKEND_URL` in the Vercel project environment variables.
6. Deploy. Vercel will run `npm install` and `npm run build` automatically.

After deploy, your homepage should render the same landing view you see locally, and the **Connect my Twitch** button will call your backend `/auth/start` endpoint.