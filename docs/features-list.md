# NovaCent Feature Inventory

Last updated: 2026-05-01

This is the living feature list for NovaCent. Whenever a new feature is added, changed, deferred, or removed, update this document in the same work item.

## Maintenance Rule

- Every product feature change must update this file.
- Use `Implemented`, `Partial`, or `Deferred` as the status.
- Add the main user-facing behavior and any important backend/API behavior.
- If a feature affects money, account ownership, reports, budgets, imports, settlements, or deletion rules, note the data impact clearly.
- After any code or product change, follow the QA regression process in `docs/regression-test-plan.md`.
- After any UI change, follow the responsiveness checklist in `docs/responsiveness-checklist.md`.

## Platform

| Status | Feature |
| --- | --- |
| Implemented | Next.js App Router application built with TypeScript. |
| Implemented | MongoDB-backed API layer with account-scoped data access. |
| Implemented | Live API mode by default with `NEXT_PUBLIC_USE_MOCKS=true` available for demo UI development. Live mode does not silently fall back to demo fixtures when an API request fails. |
| Implemented | Live mode clears legacy app-shell caches and service-worker API responses are network-only, so old demo screens/data do not keep rendering after refresh. |
| Implemented | Vercel-ready configuration and setup documentation. |
| Implemented | PWA manifest and offline service-worker foundation. |
| Implemented | QA regression test plan for validating working features after every change. |
| Implemented | Responsiveness checker process for validating UI changes across mobile, tablet, and desktop widths. |

## Authentication And Accounts

| Status | Feature |
| --- | --- |
| Implemented | Email/password registration and sign-in. |
| Implemented | Logout action from the authenticated app shell sidebar/footer. |
| Implemented | Google OAuth wiring with placeholder credentials until real Google keys are configured. |
| Implemented | Forgot-password, reset-password, and change-password APIs and screens. |
| Implemented | Authenticated navigation panel displays `Hi <first name>` at the bottom, using the formatted first word of the profile name with email/user fallback. |
| Implemented | Default INR account creation for new users. |
| Implemented | Multiple account support with a global account switcher. |
| Implemented | Global account preference sanitization in live mode so stale demo account ids do not drive refresh-time API calls. |
| Implemented | Account-scoped expenses, budgets, parties, imports, reports, and notifications. |

## App Configuration And UX

| Status | Feature |
| --- | --- |
| Implemented | NovaCent branding through centralized app configuration. |
| Implemented | Central translation dictionary for changing app text from one file, with English, Spanish, French, Hindi, and Marathi language options. |
| Implemented | App-shell, auth screens, dashboard, expenses, budgets, imports, parties, reports, settings, chart captions, empty states, and common action/status labels are wired through the central translation helpers. |
| Implemented | Translation audit coverage includes confirmation dialogs, placeholders, chart accessibility labels, table captions, notification labels, and mobile drawer controls. |
| Implemented | Light/dark theme switching. |
| Implemented | Responsive app shell with sidebar navigation and top account controls. |
| Implemented | Mobile navigation opens as a right-side slide-in drawer from the hamburger menu, while header controls reflow into compact grids on smaller screens. |
| Implemented | Mobile app shell uses a compact brand bar with notifications beside the hamburger menu; account, language, and theme controls move into the bottom of the navigation drawer to keep page content higher. |
| Implemented | Settings moved from the main nav list to a square gear shortcut beside the wider logout button in the navigation footer. |
| Implemented | Responsive hardening for top-bar actions, page actions, forms, tables, charts, participant chips, and mobile action buttons. |
| Implemented | Refreshed multi-accent visual system with blue, teal, violet, amber, and rose tokens instead of a single green-heavy palette. |
| Implemented | Reports and charts use shared chart color tokens for clearer category, cashflow, budget, party, and currency visuals. |
| Implemented | Dark-mode report chart tooltips use theme-aware text and surface colors for readable values. |
| Implemented | Compact mobile top-bar action wrapping so theme, logout, notifications, and status controls do not stretch into distorted blocks. |
| Implemented | Accessible labels, captions, semantic tables, status messages, and keyboard-friendly controls. |
| Implemented | Modern UI polish, chart visuals, transitions, and stable form layouts. |

## Expenses

| Status | Feature |
| --- | --- |
| Implemented | Overall expense ledger with search. |
| Implemented | Quick-add expense form appears above the ledger and defaults the date to the local current date. |
| Implemented | Manual expense create flow with success/error feedback. |
| Implemented | Offline expense queueing when the device is offline. |
| Implemented | Expense delete button with confirmation. |
| Implemented | Settlement ledger rows are locked from direct deletion. |
| Implemented | Party expense deletion removes the item from the overall expense ledger. |
| Implemented | Budget spent totals are reversed when a normal expense is deleted. |

## Budgets

| Status | Feature |
| --- | --- |
| Implemented | Budget create, list, progress, and delete workflows. |
| Implemented | Budget edit workflow for category, limit, period, currency, and alert threshold. |
| Implemented | Budget create/edit form uses an aligned responsive action row for Save and Cancel controls. |
| Implemented | Budget delete confirmation. |
| Implemented | Monthly and yearly budget periods. Monthly budgets run from the 1st of the current month to month end; yearly budgets run from Jan 1 to Dec 31. Budget spend is recalculated for the active month/year and includes existing matching expenses when a budget is listed, created, or edited. |
| Implemented | Overall spend budgets track every visible expense in the active month/year, while single-category budgets track only their matching category. |
| Implemented | Budget spend matching supports both category id and category name so older existing expenses still count when the visible category matches. |
| Implemented | Default budget alert threshold of 80 percent. |
| Implemented | Budget threshold notifications. |
| Implemented | Budget spend impact on expense creation and reversal on expense deletion. |

## Parties, Splits, And Settlements

| Status | Feature |
| --- | --- |
| Implemented | Parties are the single shared-spending workspace; Trips are removed from navigation and `/trips` redirects to Parties. |
| Implemented | Party creation captures only the party name; participants are added from the opened party workspace. |
| Implemented | Opening a party scrolls to the party workspace and focuses the party expense form. |
| Implemented | Parties use a list/workspace flow: opening a party replaces the card list with the workspace, and Back to parties returns to the cards. |
| Implemented | Shared parties are visible when the selected account is the owner, when the selected account is a registered participant, or when the signed-in user is a registered participant. |
| Implemented | Party delete with confirmation for the managing account only. |
| Implemented | Parties with settled expenses are locked from deletion. |
| Implemented | Registered friend search by name/email. |
| Implemented | Add registered users to parties. |
| Implemented | Add non-registered external placeholders from the friend search results only when no registered user matches the search. |
| Implemented | Party expense creation inside a party. |
| Implemented | Shared party workspaces read party expenses across the owner account and registered participant accounts while keeping splits and settlements under the party owner account. |
| Implemented | Party expense paid-by participant selection. |
| Implemented | Even split and manual split amount modes. |
| Implemented | Split validation that participants belong to the party. |
| Implemented | Mark split as settled. |
| Implemented | External placeholder settlements settle directly without approval. |
| Implemented | Registered-user settlements require payer approval. |
| Implemented | Settlement approval and rejection UI. |
| Implemented | Settlement notifications for approval requests and decisions. |
| Implemented | Party expense delete with confirmation for managing account only. |
| Implemented | Party admins can delete unlocked party expenses even when the expense was recorded under a registered participant account; the row is removed from that participant ledger too. |
| Implemented | Settled party expenses cannot be deleted. |
| Implemented | Settlement cashflow reflects in the overall ledger: paid-to-friend creates a settlement expense, reimbursement creates a negative credit. |
| Implemented | Party expenses paid by another participant can be excluded from the main ledger until settlement occurs. |

## Bank Statement Imports

| Status | Feature |
| --- | --- |
| Implemented | Upload statement files for review. |
| Implemented | CSV, XLS/XLSX, TXT, and text-PDF parsing path. |
| Implemented | Review-before-save import workflow. |
| Implemented | Imported row approve and delete actions. |
| Implemented | Possible duplicate detection and duplicate filter. |
| Implemented | Category suggestions for imported rows. |
| Implemented | Uploaded file name is retained as metadata. |
| Deferred | Scanned PDF/image OCR is planned for the OCR import phase. |

## Reports And Analytics

| Status | Feature |
| --- | --- |
| Implemented | Category breakdown chart. |
| Implemented | Monthly cash-flow chart. |
| Implemented | Budget variance chart. |
| Implemented | Merchant trend chart. |
| Implemented | Party settlement chart. |
| Implemented | Currency exposure chart. |
| Implemented | CSV export for report data. |
| Implemented | Browser print/PDF export path. |
| Implemented | Reports ignore ledger-excluded party expenses and include finalized settlement cashflow. |
| Implemented | Spend by category nets settlement credits/debits back to the original party expense category, so a reimbursed shared expense shows the user's final personal spend. |
| Implemented | Budget spend also nets settlement reimbursements back to the original party expense category for the active budget period. |

## Currency

| Status | Feature |
| --- | --- |
| Implemented | INR as default base currency. |
| Implemented | Multi-currency expense entry. |
| Implemented | Automatic exchange-rate lookup through Frankfurter. |
| Implemented | Currency-rate caching for fallback/offline resilience. |

## Notifications

| Status | Feature |
| --- | --- |
| Implemented | Notification center in the app shell. |
| Implemented | Unread count and mark-read behavior. |
| Implemented | Budget threshold notifications. |
| Implemented | Import and settlement notification support. |

## Offline And Sync

| Status | Feature |
| --- | --- |
| Implemented | Online/offline banner. |
| Implemented | IndexedDB outbox for offline mutation queueing. |
| Implemented | Sync-now action from dashboard. |
| Implemented | Automatic sync attempt when the browser comes back online. |
| Partial | Cached report viewing exists as a foundation; richer report cache controls are still future polish. |

## Deletion And Ownership Rules

| Status | Feature |
| --- | --- |
| Implemented | Delete buttons use confirmation popups. |
| Implemented | Expense, budget, party, and party-expense delete flows are account/admin scoped. |
| Implemented | Non-admin party users do not see party delete controls. |
| Implemented | Settled party expenses cannot be deleted. |
| Implemented | Direct settlement ledger entries cannot be deleted from the expense ledger. |
| Implemented | Deleting party expenses removes them from the overall ledger. |

## Known Deferred Work

| Status | Feature |
| --- | --- |
| Deferred | Scanned PDF and image OCR import. |
| Deferred | Production SMTP email delivery verification. |
| Deferred | Full recurring-expense management UI. |
| Deferred | Google OAuth verification with real production credentials. |
