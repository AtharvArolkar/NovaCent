# NovaCent

NovaCent is a Next.js + TypeScript personal finance app for account-scoped expenses, bank statement imports, budgets, shared party splits, recurring payments, reports, offline-friendly usage, and Vercel deployment.

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
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_ENVELOPE_FROM`, `SMTP_HELO_DOMAIN` | Optional | Generic SMTP settings for forgot-password emails and support admin emails. If omitted, forgot-password returns a development reset URL. |
| `SUPPORT_ADMIN_EMAIL` | Optional | Receives support form emails when SMTP is configured. Support requests are still saved to MongoDB without this. |
| `CRON_SECRET` | Recommended | Protects the recurring-expense cron endpoint in deployed environments. |
| `OCR_ENABLED`, `OCR_LANG`, `OCR_MAX_FILE_MB`, `OCR_WORKER_SECRET` | Optional | Reserved for the Phase 3 scanned PDF/image OCR worker path. Text PDF parsing and password-protected text PDF parsing work without OCR. |
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

The regression plan is maintained in [docs/regression-test-plan.md](docs/regression-test-plan.md). After every code or product change, run the relevant regression checks and report failures back to the developer/implementation agent before continuing.

The app has been verified with:

```bash
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

## User Guide And Feature Docs

- User-facing app guide: `/how-to-use` inside the authenticated app.
- Concise public feature summary: [docs/available-features.md](docs/available-features.md).
- Detailed living feature inventory: [docs/features-list.md](docs/features-list.md).
- Vercel deployment checklist: [docs/vercel-setup.md](docs/vercel-setup.md).

## Current Scope

The living product feature inventory is maintained in [docs/features-list.md](docs/features-list.md). Update that document whenever a feature is added, changed, deferred, or removed.

- Auth: email/password sign-in, registration, logout, forgot/reset/change password, and Google OAuth wiring.
- Accounts: global account switcher, account-scoped APIs, neutral primary account labeling, and per-account preferences.
- Expenses: quick add, search, row selection, select all, one-request bulk deletion, original-currency display, and offline queueing.
- Money flow: paid/outgoing amounts show as negative red values; received/reimbursement amounts show as positive green values.
- Currency: multi-currency entry, stored original currency per expense, default-currency preference for new entries, and Frankfurter-backed conversion for calculations.
- Budgets: monthly/yearly budget tracking, edit/delete flows, alert thresholds, default-currency calculations, and expandable included-expense details.
- Dashboard: lightweight overview API, loading state instead of misleading zeroes, monthly/yearly remaining budget cards, recent activity, and mobile swipe metric cards.
- Imports: CSV, XLS/XLSX, TXT, and text-PDF statement parsing, password-protected text PDF support, review-before-save, duplicate filtering, category assignment, and one-request bulk approve/delete.
- Statement parsing: common bank columns are detected for date, narration/description, reference, withdrawal/debit, deposit/credit, amount, balance, and wrapped PDF rows.
- Parties: shared party workspaces, registered or placeholder participants, party expense creation, split modes, staged ledger expenses, settlement approvals, and participant notifications.
- Recurring expenses: recurring rule UI with create/edit/pause/resume/end flows and Vercel Cron-compatible background execution.
- Reports: timeframe filters, category mix, cash flow, budget variance, merchant, party, and currency analytics with CSV and PDF/print export.
- Notifications: notification center with unread count, mark-read, clear-all, import, budget, settlement, password, and guide/PWA prompts.
- Support: authenticated customer support form saved to MongoDB, with optional generic SMTP admin email.
- Offline/PWA: service worker, manifest, install prompt, cached rates/reports foundation, sync outbox, and sync-now action.
- UX/accessibility: responsive app shell, mobile drawer, themed scrollbars, in-app translated confirmation dialogs, global API loader, dark/light themes, and accessible controls.
- Localization/branding: central branding in `src/lib/app-config.ts` and app text in `src/lib/client/dictionary.ts` with English, Hindi, Marathi, French, and Spanish.

## Phase Backlogs

Historical and remaining product requirements are stored in [docs/phase-2-requirements.md](docs/phase-2-requirements.md) and [docs/phase-3-requirements.md](docs/phase-3-requirements.md). Keep those files as planning records, and use [docs/features-list.md](docs/features-list.md) as the current implementation truth.

## Notes

Scanned PDF/image OCR is intentionally deferred. CSV, spreadsheet, TXT, and text-PDF parsing are implemented first because they are more reliable inside Vercel serverless limits. Password-protected text PDFs are supported through a transient statement password that is not stored.
