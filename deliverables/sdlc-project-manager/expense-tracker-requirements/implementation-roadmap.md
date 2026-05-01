# Expense Tracker Implementation Roadmap

## Delivery Strategy

Build in vertical slices so every phase produces a usable application. Prioritize account isolation, offline-safe data design, and currency snapshots early because later modules depend on those foundations.

## Current Phase 2 Backlog

The active remaining backlog after the initial working app build is tracked in `docs/phase-2-requirements.md`. Treat that document as the source of truth for the next development pass.

## Phase 0: Foundation

| Work Item | Outcome |
| --- | --- |
| Project setup | Next.js App Router, TypeScript, linting, formatting, environment config. |
| MongoDB setup | Database client, connection pattern, indexes, seed data strategy. |
| Auth foundation | Email/password, Google login, sessions, protected routes. |
| Authorization foundation | Active account context and account-scoped server functions. |
| App config | Central app name, logo, supported locales, default locale, base currency. |
| Design foundation | Responsive shell, global navigation, theme switch, accessible components. |

## Phase 1: Core Personal Finance

| Work Item | Outcome |
| --- | --- |
| Account management | User can create and switch between accounts globally. |
| Categories | System categories and custom category rules. |
| Expenses | Manual expense entry with account scope. |
| Currency conversion | Fetch rate online, store INR base amount, cache rate for offline use. |
| Dashboard | Monthly spend, category breakdown, recent expenses. |
| Accessibility | Keyboard navigation, labels, focus states, chart table equivalents. |

## Phase 2: Offline And Budgets

| Work Item | Outcome |
| --- | --- |
| IndexedDB storage | Local cache for reports, exchange rates, and pending expense mutations. |
| Sync outbox | Offline expenses sync when online without duplicate writes. |
| Cached reports | Last generated reports visible offline. |
| Budgets | Category/month budgets with custom thresholds. |
| In-app alerts | Default 80 percent alert and user-configured thresholds. |

## Phase 3: Recurring, Trips, And Parties

| Work Item | Outcome |
| --- | --- |
| Recurring rules | Monthly expense rules with end date. |
| Trips | Multi-currency trip expenses and trip reports. |
| Parties | Registered and external party participants. |
| Splits | Equal, percentage, exact, and share-based split records. |
| Settlements | External participants settle directly; registered settlements need approval. |
| Reports | Trip, party balance, settlement, recurring, and avoidable expense reports. |

## Phase 4: Statement Import

| Work Item | Outcome |
| --- | --- |
| Upload pipeline | Secure temporary upload and file metadata capture. |
| CSV/XLSX parser | Structured transaction extraction. |
| Text PDF parser | Extract transaction text from readable PDFs. |
| Import review UI | User edits, deletes, and approves parsed rows. |
| Category suggestions | Apply merchant and pattern rules. |
| Save approved rows | Approved rows become expenses; deleted rows are discarded. |
| File cleanup | Original uploaded file is deleted after extraction. |

## Phase 5: Advanced Import And Reporting

| Work Item | Outcome |
| --- | --- |
| OCR import | Scanned PDF/image extraction where feasible. |
| Bank adapters | Bank-specific parsing templates for frequent formats. |
| Advanced reports | Merchant trends, currency exposure, budget variance, recurring analysis. |
| Exports | CSV/PDF report exports. |
| Admin diagnostics | Import confidence, failed sync, and failed parser review tools. |

## Suggested First Sprint

| Priority | Story | Acceptance Signal |
| --- | --- | --- |
| P0 | User can register, log in, and log out. | Protected dashboard is unavailable without session. |
| P0 | User has a default INR account. | Account is created and active after onboarding. |
| P0 | User can add an INR expense. | Expense appears in list and dashboard total. |
| P0 | User can add a foreign-currency expense online. | Rate is fetched, INR equivalent is stored, and rate snapshot is visible. |
| P1 | User can switch accounts globally. | Dashboard and expenses update to selected account only. |
| P1 | User can view dashboard offline from cache. | Last report remains visible offline. |
| P1 | User can add an expense offline. | Expense appears locally as pending and syncs when online. |
| P1 | User receives an 80 percent budget alert. | In-app notification is created once threshold is crossed. |

## Technical Defaults

| Concern | Default |
| --- | --- |
| Runtime | Next.js App Router with TypeScript. |
| Database | MongoDB. |
| Auth | Auth.js or equivalent maintained library. |
| Validation | Zod or equivalent. |
| Forms | React Hook Form or equivalent. |
| Charts | Recharts, Tremor-free stack, or another accessible/free charting library. |
| Offline storage | IndexedDB through a typed wrapper. |
| Currency provider | Frankfurter first, with provider abstraction for replacement. |
| Hosting | Vercel. |
| Paid services | Avoid unless explicitly approved. |

## Definition Of Done

- Feature works for the active account only.
- Server-side authorization checks are present.
- TypeScript types cover API input/output and persisted models.
- Form validation runs on client and server.
- Offline behavior is defined for the feature.
- Loading, empty, error, and permission states exist.
- Keyboard navigation and screen-reader labels are considered.
- Feature is represented in reports when financially relevant.
- Tests cover core behavior and account isolation.
