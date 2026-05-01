# NovaCent

NovaCent is a Next.js + TypeScript expense tracker for multi-user personal finance, INR-first multi-currency expenses, budgets, trips, parties, statement-import review, offline caching, and Vercel deployment.

## Quick Start

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Required Environment Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXTAUTH_URL` | Yes | Local: `http://localhost:3000`. Vercel: your deployed URL. |
| `NEXTAUTH_SECRET` | Yes | Strong random value for signing auth tokens. |
| `MONGODB_URI` | Yes | MongoDB Atlas or another MongoDB connection string. |
| `MONGODB_DB` | Yes | Defaults to `novacent` if omitted. |
| `NEXT_PUBLIC_USE_MOCKS` | Optional | Phase 2 default is `false`; set `true` only for demo-data UI development. |
| `GOOGLE_CLIENT_ID` | For Google login | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | For Google login | Google OAuth client secret. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Optional | If omitted, forgot-password returns a development reset URL. |
| `CURRENCY_PROVIDER` | Optional | Defaults to `frankfurter`; no API key needed. |

## Google OAuth Callback

For local development, add this callback URL in Google Cloud:

```text
http://localhost:3000/api/auth/callback/google
```

For Vercel production:

```text
https://your-domain.vercel.app/api/auth/callback/google
```

## Verification

The app has been verified with:

```bash
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

## Current Scope

- Email/password and Google authentication.
- Default INR account creation.
- Global account switcher.
- Account-scoped APIs for expenses, budgets, trips, parties, settlements, import batches, notifications, and reports.
- Automatic INR conversion using Frankfurter exchange rates.
- Statement upload parsing for CSV, XLS/XLSX, and text PDF, with review-before-save.
- Party-only external participants and direct external settlement.
- Registered settlement approval endpoint.
- Offline helpers for IndexedDB cached reports, cached rates, and sync outbox.
- PWA manifest and service worker.
- Central branding in `src/lib/app-config.ts`.
- Central translations in `src/lib/client/dictionary.ts`.

## Phase 2 Backlog

Remaining product requirements are stored in [docs/phase-2-requirements.md](docs/phase-2-requirements.md). Phase 2 focuses on live API wiring, offline sync replay, import review completion, recurring expenses, split workflows, settlement approvals, advanced reports, exports, OCR, and production password-reset email.

## Phase 3 Backlog

Remaining end-to-end workflow and advanced production requirements are stored in [docs/phase-3-requirements.md](docs/phase-3-requirements.md). Phase 3 covers recurring-rule UI, party split UI, settlement approval UI, trip expense creation, backend-powered advanced reports, OCR, SMTP reset emails, and Google OAuth verification.

## Notes

Scanned PDF OCR is intentionally treated as the next import phase. CSV, spreadsheet, and text-PDF parsing are implemented first because they are more reliable inside Vercel serverless limits.
