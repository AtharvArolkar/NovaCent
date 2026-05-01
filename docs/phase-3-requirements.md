# Phase 3 Requirements

## Purpose

Phase 3 completes the remaining advanced and end-to-end product workflows after the Phase 2 live API, notification, duplicate detection, and reporting foundation.

## Phase 3 Scope

| Priority | Requirement | Expected Outcome |
| --- | --- | --- |
| P0 | Recurring rules UI and automatic execution | Users can create, view, pause, edit, and end recurring expense rules; due expenses are created automatically in the background and synced later if needed. |
| P0 | Add existing expenses to party split | Users can select one or more existing expenses, choose to add them to an existing party split or create a new party, and carry the selected expenses into the party workspace without re-entering them. |
| P0 | Party split UI | Users can create shared expenses, split by equal amount, exact amount, percentage, or shares, and view outstanding split balances. |
| P0 | Settlement approval UI | Registered-user settlement requests can be approved or rejected in the UI; external participant settlements remain direct. |
| P1 | Backend-powered advanced reports | Advanced chart sections use real backend report data instead of fallback-shaped client data wherever possible. |
| P1 | Scanned PDF/image OCR | Support async/background OCR parsing for scanned PDFs/images, with extracted rows synced later into import review. |
| P1 | Password-protected statement import | If an uploaded bank statement is password locked, users can provide the statement password so the app can parse the file. |
| P1 | Production SMTP password reset | Send real forgot-password emails through configured SMTP instead of returning development reset URLs. |
| P1 | Google login verification | Verify Google OAuth once `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are available. |
| P1 | Customer support form | Users can submit a support request with name, request type, and comments for feature requests, issue reports, or praise. |

## Acceptance Criteria

- Recurring rule UI is fully account-scoped and reflects active account changes.
- Recurring rules create due expenses automatically in the background; manual-only recurring execution is not required.
- Recurring rule runs create expenses with immutable currency snapshots.
- Recurring execution can sync later when the app/server comes back online or when the background job completes.
- Existing-expense split flow supports multi-select from the expense ledger and does not duplicate expense rows.
- Existing-expense split flow converts selected expenses into party expenses instead of duplicating them.
- Existing-expense split flow asks whether to add selected expenses to an existing party or create a new party.
- Adding selected expenses to an existing party creates a new split group inside that party.
- Creating a new party from selected expenses opens the party creation flow with selected expenses staged; the user can add party details, add participants, add more expenses manually, and save.
- Manual, imported, and recurring expenses can be selected for party splitting.
- Settlement rows and already-settled party expenses are blocked from the add-to-split picker.
- Party split UI validates that all split participants belong to the party.
- Percentage and share split modes include the payer by default, while allowing the payer's share to be set to `0`.
- Settlement approval UI clearly distinguishes pending, approved, rejected, and settled states.
- Advanced report APIs return the data needed for merchant trends, budget variance, recurring analysis, party settlements, and currency exposure.
- OCR import files can be processed in the background, and extracted rows can sync into import review later.
- OCR import rows go through the same review/delete/approve and duplicate-detection workflow as text-based imports.
- Password-protected statement imports prompt for a statement password when needed.
- Statement passwords are used only for parsing/decryption and are not stored after processing.
- If a password is missing or incorrect, the import batch is marked failed with a clear reviewable error state.
- SMTP reset emails use secure, expiring, single-use reset tokens.
- Google login is tested locally and in the target Vercel environment.
- Customer support form validates required name, request type, and comments before submission.
- Customer support request types include Add feature, Report issue, and Praise.
- Customer support submissions are account/user associated when the user is signed in.
- Customer support is available after login only.
- Customer support submissions are saved to MongoDB first; admin email delivery can be added once SMTP is configured.
- SMTP integration uses generic provider-neutral environment variables so Gmail SMTP, Brevo, SendGrid SMTP, or custom SMTP can be used.
- Phase 3 work passes `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit --omit=dev`.

## Suggested Build Order

1. Build recurring expense management UI with automatic/background execution.
2. Build existing-expense-to-party split flow.
3. Build remaining party split modes and balance UI.
4. Build settlement approval/rejection UI.
5. Expand backend report APIs for all advanced chart data.
6. Wire advanced charts to backend-powered report payloads.
7. Add customer support form and persistence.
8. Add SMTP email sending for password reset.
9. Add OCR import pipeline.
10. Verify Google OAuth with real credentials.

## Decisions Captured

- Existing expenses selected for splitting are converted to party expenses.
- Adding to an existing split means choosing an existing party first, then creating a new split group inside that party.
- Manual, imported, and recurring expenses are eligible for splitting; settlement rows and already-settled party expenses are blocked.
- Payer is included in percentage/share split modes by default and can be assigned `0`.
- Customer support form is available after login so submissions can be tied to the user/account.
- Customer support submissions are saved to MongoDB first, with admin email delivery added after SMTP configuration.
- SMTP is provider-neutral through generic environment variables.
- Recurring expenses run automatically in the background; manual-only execution is out of scope.
- OCR workflow runs asynchronously/background, with extracted rows synced later into import review.
- Password-protected bank statement passwords are accepted only for parsing and are not persisted.

## Notes

- OCR should remain free/open-source unless explicitly approved otherwise.
- Avoid payment integrations in Phase 3; settlement remains record-keeping only.
- Keep browser push/email budget alerts out of scope unless separately approved.
- Trip functionality is removed from the current product direction; shared spending should be handled through Parties unless the requirement is reopened later.

## Current Implementation Status

- Implemented: recurring rules UI and Vercel Cron-compatible automatic execution.
- Implemented: existing expense multi-select staging/conversion into party splits without duplicating ledger rows.
- Implemented: party split modes for equal, manual amount, percentage, and shares.
- Implemented: customer support form with MongoDB persistence and optional SMTP admin email.
- Implemented: SMTP forgot-password email sending with development reset fallback when SMTP is not configured.
- Implemented: backend-powered advanced report data for category, cashflow, budget variance, merchant, party, and currency charts.
- Implemented: password-protected text PDF statement import with transient password handling.
- Remaining: scanned PDF/image OCR worker implementation and real Google OAuth verification once credentials are available.
