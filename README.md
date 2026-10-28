# LabLedger — Frontend

The mobile-first web app for the LabLedger inventory and audit system, built with Next.js 16, Tailwind 4 and daisyUI 5.
The API is in `../moratuwa_backend`. The full plan is in [`docs/PLAN.md`](docs/PLAN.md).

## Run locally

Start the backend first (see `../moratuwa_backend/README.md`), then:

```bash
cp .env.example .env.local   # API_URL=http://localhost:4000
npm install
npm run dev                  # http://localhost:3000
```

Sign in with the admin account from the backend's `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

**On your phone:** connect to the same Wi-Fi and open `http://<laptop-LAN-IP>:3000`. Add that address to the backend's `CORS_ORIGINS` first, or sign-in will be rejected.

## How it talks to the API

- The browser only calls this app's own origin. `/api/v1/*` is rewritten to the backend (`next.config.ts`), so auth cookies are first-party, `httpOnly` and `SameSite=Strict`.
- Server Components fetch with `lib/api-server.ts`, which forwards the user's cookies. Client Components use `lib/api-client.ts`, which retries once after refreshing an expired token.
- `src/proxy.ts` sends page loads without an access cookie to `/api/v1/auth/session`, which renews the session silently or redirects to `/login`.

## Theme

There are two daisyUI themes in `src/app/globals.css`:
- **bumblebee**: yellow primary, white surfaces, black secondary
- **hive**: the same yellow on black, with white secondary

The app follows the phone's dark-mode setting until the user taps the toggle, and then remembers their choice.

## Screens

| Route | Status |
|---|---|
| `/login` | ✅ |
| `/` dashboard: totals, pending book entries, awaiting HOD | ✅ |
| `/ledger` search + filters, `/ledger/new`, `/ledger/[id]` with mark-in-book / submit / approve | ✅ |
| `/scan` (manual tag entry) → `/items/[tag]` | ✅ (camera QR is next) |
| `/audit`, `/reports` | placeholders (Phase 1 wk 4 / Phase 2) |
