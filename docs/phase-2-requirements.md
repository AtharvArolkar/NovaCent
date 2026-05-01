# Phase 2 Requirements

## Purpose

Phase 2 turns the current working MVP foundation into an end-to-end product by wiring the UI to live APIs, completing offline sync, finishing financial workflows, and adding the remaining advanced requirements.

## Implementation Status

| Status | Area |
| --- | --- |
| Implemented | Live API mode by default with optional mock fallback. |
| Implemented | Client services for accounts, expenses, budgets, reports, parties, imports, and notifications. |
| Implemented | Manual expense quick-add with live API save and offline outbox fallback. |
| Implemented | Online sync replay for pending outbox items. |
| Implemented | Import upload, review, delete, approve, and possible-duplicate filtering. |
| Implemented | Backend duplicate detection across prior imported rows and saved expenses. |
| Implemented | In-app notification center plus budget/import/settlement notification generation. |
| Implemented | Recurring expense APIs and manual run endpoint. |
| Implemented | Party split APIs and settlement approval/rejection flow. |
| Implemented | Advanced Recharts-based reporting with accessible data tables. |
| Implemented | CSV export and browser print/PDF export path for reports. |
| Implemented | Modern transitions, skeleton states, interaction feedback, and reduced-motion handling. |
| Deferred | Scanned PDF/image OCR. |
| Deferred | Production SMTP email sending for password reset links. |

Remaining deferred/end-to-end workflow items are tracked in `docs/phase-3-requirements.md`.

## Phase 2 Scope

| Priority | Requirement | Expected Outcome |
| --- | --- | --- |
| P0 | Mock-to-live API switch | Add a `NEXT_PUBLIC_USE_MOCKS` feature flag so the app can run with demo data during UI development and switch to live API calls when MongoDB/auth are configured. |
| P0 | Live frontend API integration | Dashboard, expenses, budgets, reports, parties, imports, and settings read/write real MongoDB-backed APIs instead of demo data. |
| P0 | Manual expense submission | Expense form validates input, fetches exchange rate when needed, stores the expense in MongoDB, updates dashboard/report data, and works for active account only. |
| P0 | Offline mutation replay | Offline-created expenses are stored in IndexedDB, queued in the sync outbox, replayed when online, and deduplicated with `clientMutationId`. |
| P0 | Import review UI integration | Statement upload, parsed row review, edit/delete/approve actions, and approved-row save are fully wired to `/api/imports` and `/api/imports/[batchId]/approve`. |
| P0 | Bank statement duplicate detection | Re-uploading the same or overlapping bank statement does not create duplicate expenses for entries already imported from previous uploads. |
| P0 | Budget alert generation | Custom budget thresholds trigger in-app notifications, with 80 percent as the default threshold. |
| P0 | In-app notification center | Notifications for budgets, imports, sync failures, and settlement approvals are visible from the app shell with unread/read states. |
| P1 | Recurring monthly expenses | Users can create monthly recurring rules with end dates; generated/forecasted expenses appear in reports and avoidable-expense analysis. |
| P1 | Party split workflow | Parties support equal, percentage, exact, and share-based splits across registered and external participants. |
| P1 | Settlement workflow UI | External participant settlement completes directly; registered-user settlement requires approval from the affected account owner. |
| P1 | Advanced charts and graphs | Add richer interactive charts for merchant trends, budget variance, recurring analysis, party settlements, currency exposure, and cash-flow patterns while keeping the existing simple summaries. |
| P1 | Report exports | Export reports to CSV and PDF. |
| P1 | Modern animated UX | Add polished modern transitions, subtle animations, responsive motion states, and interaction feedback while respecting reduced-motion accessibility settings. |
| P1 | NovaCent branding polish | Apply the NovaCent name and logo consistently across app shell, auth screens, manifest, README, and future generated exports/reports. |
| P2 | Scanned PDF/image OCR | Add OCR-backed statement parsing for scanned PDFs/images, preferably as an async job if Vercel serverless limits are tight. |
| P2 | Real password reset email | Add SMTP email sending for forgot-password links instead of development reset-link responses. |

## Acceptance Criteria

- `src/lib/client/expense-service.ts` supports both mock data and live API mode.
- `NEXT_PUBLIC_USE_MOCKS=true` keeps the current demo-data behavior.
- `NEXT_PUBLIC_USE_MOCKS=false` routes client reads/writes through `/api/*` endpoints.
- Live API mode requires authenticated session, `MONGODB_URI`, `MONGODB_DB`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`.
- API requests pass the active account ID through query params and/or the `x-account-id` header.
- All financial screens use the selected global account and never leak data from another account.
- Frontend forms use client-side and server-side validation.
- All create/update/delete workflows show loading, success, error, and empty states.
- Offline-created records are clearly marked pending until synced.
- Sync retries do not create duplicate expenses, imports, or settlements.
- Import approval checks for duplicate rows using stable fingerprints such as account ID, date, amount, currency, merchant/description, normalized reference text, and optional statement file hash.
- Duplicate or overlapping statement rows are shown in review as possible duplicates and are not saved unless the user explicitly confirms.
- Imported statement files are deleted after parsing while file metadata remains.
- Deleted import review rows are not saved to the expenses collection.
- Budget notifications are created once per threshold crossing unless the budget period resets.
- Charts have accessible table equivalents.
- Advanced charts support keyboard-accessible alternatives and summary tables.
- Animations honor `prefers-reduced-motion`.
- NovaCent branding is configured from `src/lib/app-config.ts` and reused consistently.
- Phase 2 work passes `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit --omit=dev`.

## Suggested Build Order

1. Add `NEXT_PUBLIC_USE_MOCKS` and split client services into mock/live implementations.
2. Replace demo client services with typed API client functions.
3. Wire expenses, budgets, accounts, reports, and notifications to live APIs.
4. Complete offline outbox replay for expense creation.
5. Complete import upload/review/approve UI with duplicate detection for overlapping bank statements.
6. Add notification center and budget/import/sync/settlement notification generation.
7. Add recurring rules and generated/forecasted expense handling.
8. Complete party split workflows.
9. Complete settlement approval UI.
10. Add advanced charts, reports, and exports.
11. Add NovaCent motion/UX polish.
12. Add OCR and production email sending.

## Bank Statement Duplicate Detection

When a statement is uploaded, the app should compute a transaction fingerprint before save. Fingerprints should be account-scoped and based on normalized values:

```text
accountId + spentAt + amount + currency + normalizedMerchant + normalizedReference
```

For imported rows without a reliable reference, use a fallback fingerprint:

```text
accountId + spentAt + amount + currency + normalizedMerchant
```

Expected behavior:

- Existing approved expenses with the same fingerprint should be detected during review.
- Duplicate rows should be marked as possible duplicates before approval.
- Deleted duplicate rows should not be stored in the expenses collection.
- If the user manually confirms a duplicate-looking row is valid, save it with an override reason.
- Store the original statement file name and optional file hash for import history, but delete the uploaded file after parsing.

## Advanced Charts And UX

Phase 2 reporting should add richer visuals without removing the current simple summaries:

- Multi-series monthly cash-flow chart.
- Category drill-down chart.
- Merchant trend chart.
- Budget variance chart.
- Recurring avoidable-expense chart.
- Party settlement balance graph.
- Currency exposure chart showing original currency and INR converted totals.

UX polish should include:

- Page transitions and panel entrance transitions.
- Button/form interaction feedback.
- Skeleton loading states.
- Toast or notification animations.
- Reduced-motion fallback with no essential information conveyed only through motion.

## Mock-To-Live API Switch Details

Use this environment variable during Phase 2. Live API mode is the default:

```env
NEXT_PUBLIC_USE_MOCKS=false
```

When `true`, the UI should continue using local demo data for fast layout and UX work. When `false`, client services should call the existing backend routes:

| Client Need | Live API Route |
| --- | --- |
| Accounts | `/api/accounts` |
| Expenses | `/api/expenses` |
| Budgets | `/api/budgets` |
| Category rules | `/api/category-rules` |
| Currency rate | `/api/currency/rate` |
| Statement imports | `/api/imports` |
| Import approval | `/api/imports/[batchId]/approve` |
| Reports | `/api/reports/summary` |
| Parties | `/api/parties` |
| Settlements | `/api/parties/[partyId]/settlements` |
| Notifications | `/api/notifications` |

Recommended implementation pattern:

```ts
const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
```

Then branch inside `src/lib/client/expense-service.ts` or split into `mock-expense-service.ts` and `api-expense-service.ts`.

## Out Of Scope For Phase 2 Unless Approved

- Paid OCR, paid exchange-rate APIs, or paid chart/reporting packages.
- Actual payment transfer integrations.
- Browser push/email budget alerts beyond in-app notifications.
- Shared account membership beyond the current owner-scoped account model.
