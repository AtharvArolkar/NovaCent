# Vercel Setup Guide

## Prerequisites

- Vercel account connected to this repository.
- MongoDB Atlas cluster or another MongoDB endpoint reachable from Vercel.
- Google OAuth app if Google sign-in is enabled.
- Strong `NEXTAUTH_SECRET`.

## Environment Variables

| Variable | Required | Visibility | Notes |
| --- | --- | --- | --- |
| `NEXTAUTH_URL` | Yes | Server only | Production URL, for example `https://your-app.vercel.app`. |
| `NEXTAUTH_SECRET` | Yes | Server only | Strong random value for NextAuth JWT/session signing. |
| `MONGODB_URI` | Yes | Server only | MongoDB connection string. Do not expose to the browser. |
| `MONGODB_DB` | Recommended | Server only | Use `rupee-flow` unless you choose another DB name. |
| `GOOGLE_CLIENT_ID` | Yes for Google login | Server only | From Google Cloud OAuth credentials. |
| `GOOGLE_CLIENT_SECRET` | Yes for Google login | Server only | From Google Cloud OAuth credentials. |
| `SMTP_HOST` | Optional | Server only | Used for real password reset emails. |
| `SMTP_PORT` | Optional | Server only | Defaults depend on your SMTP provider. |
| `SMTP_USER` | Optional | Server only | SMTP username. |
| `SMTP_PASSWORD` | Optional | Server only | SMTP password. |
| `SMTP_FROM` | Optional | Server only | Sender address for password reset emails. |
| `CURRENCY_PROVIDER` | Optional | Server only | Defaults to `frankfurter`; no API key needed. |

Only variables prefixed with `NEXT_PUBLIC_` are browser-safe. This app currently keeps secrets server-only.

## Google OAuth

Add this authorized callback URL in Google Cloud:

```text
https://your-domain.vercel.app/api/auth/callback/google
```

For local development:

```text
http://localhost:3000/api/auth/callback/google
```

## Deployment Steps

1. Import the repository in Vercel.
2. Select the Next.js framework preset.
3. Add the environment variables above.
4. Deploy a preview build.
5. Register a user with email/password.
6. Test Google login if configured.
7. Add a foreign-currency expense and confirm INR conversion.
8. Upload a CSV/XLSX/text-PDF statement and approve rows from review.
9. Test offline behavior by loading reports, disabling the network, and confirming cached report UI remains visible.

## Offline And PWA Notes

- `public/manifest.webmanifest` defines installable app metadata.
- `public/sw.js` caches the app shell and same-origin static GET requests.
- API GET requests use network-first caching with fallback.
- Mutating offline writes should be queued through `src/lib/offline/outbox.ts`.
- Currency rates can be cached through `src/lib/offline/currencyRates.ts`.
- Reports can be cached through `src/lib/offline/reports.ts`.

## Import Flow

1. Upload statement file.
2. Extract candidate rows.
3. Delete original file after extraction.
4. Store metadata such as original file name, status, and optional hash.
5. Let the user edit, delete, or approve rows.
6. Save only approved rows as account-scoped expenses.

