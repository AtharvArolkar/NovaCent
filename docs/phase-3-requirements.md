# Phase 3 Requirements

## Purpose

Phase 3 completes the remaining advanced and end-to-end product workflows after the Phase 2 live API, notification, duplicate detection, and reporting foundation.

## Phase 3 Scope

| Priority | Requirement | Expected Outcome |
| --- | --- | --- |
| P0 | Recurring rules UI | Users can create, view, pause, edit, end, and manually run recurring expense rules from the app UI. |
| P0 | Party split UI | Users can create shared expenses, split by equal amount, exact amount, percentage, or shares, and view outstanding split balances. |
| P0 | Settlement approval UI | Registered-user settlement requests can be approved or rejected in the UI; external participant settlements remain direct. |
| P0 | Trip expense workflow | Users can create trip expenses, assign participants/currencies/categories, and view trip-specific spend summaries. |
| P1 | Backend-powered advanced reports | Advanced chart sections use real backend report data instead of fallback-shaped client data wherever possible. |
| P1 | Scanned PDF/image OCR | Support OCR parsing for scanned PDFs/images, preferably through an async workflow compatible with Vercel constraints. |
| P1 | Production SMTP password reset | Send real forgot-password emails through configured SMTP instead of returning development reset URLs. |
| P1 | Google login verification | Verify Google OAuth once `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are available. |

## Acceptance Criteria

- Recurring rule UI is fully account-scoped and reflects active account changes.
- Recurring rule runs create expenses with immutable currency snapshots.
- Party split UI validates that all split participants belong to the party.
- Settlement approval UI clearly distinguishes pending, approved, rejected, and settled states.
- Trip expense creation updates trip reports and global reports.
- Advanced report APIs return the data needed for merchant trends, budget variance, recurring analysis, trip reports, party settlements, and currency exposure.
- OCR import rows go through the same review/delete/approve and duplicate-detection workflow as text-based imports.
- SMTP reset emails use secure, expiring, single-use reset tokens.
- Google login is tested locally and in the target Vercel environment.
- Phase 3 work passes `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit --omit=dev`.

## Suggested Build Order

1. Build recurring expense management UI.
2. Build party split creation and balance UI.
3. Build settlement approval/rejection UI.
4. Build trip expense creation workflow.
5. Expand backend report APIs for all advanced chart data.
6. Wire advanced charts to backend-powered report payloads.
7. Add SMTP email sending for password reset.
8. Add OCR import pipeline.
9. Verify Google OAuth with real credentials.

## Notes

- OCR should remain free/open-source unless explicitly approved otherwise.
- Avoid payment integrations in Phase 3; settlement remains record-keeping only.
- Keep browser push/email budget alerts out of scope unless separately approved.

