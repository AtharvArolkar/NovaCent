# NovaCent Feature Inventory

Last updated: 2026-05-03

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
| Implemented | PWA install prompt configuration with browser install event handling, install/dismiss actions, and installable manifest shortcuts. |
| Implemented | First-time signed-in users see a guide prompt for "How to use NovaCent" before the PWA install prompt is shown. |
| Implemented | Global screen loader blocks app interaction with a blurred backdrop during API requests, uses a short delay to avoid flicker, skips notification polling GET requests, and shows a dedicated statement-processing message during imports. |
| Implemented | QA regression test plan for validating working features after every change. |
| Implemented | Non-deviation QA guard requiring existing working functionality to remain unchanged unless the user explicitly requests a behavior change. |
| Implemented | Responsiveness checker process for validating UI changes across mobile, tablet, and desktop widths. |

## Authentication And Accounts

| Status | Feature |
| --- | --- |
| Implemented | Email/password registration and sign-in. |
| Implemented | Logout action from the authenticated app shell sidebar/footer. |
| Implemented | Google OAuth wiring with placeholder credentials until real Google keys are configured. |
| Implemented | Forgot-password, reset-password, and change-password APIs and screens. |
| Implemented | Forgot-password can send reset links through generic SMTP when SMTP variables are configured; development reset URL remains available only when SMTP is not configured. |
| Implemented | Authenticated navigation panel displays `Hi <first name>` at the bottom, using the formatted first word of the profile name with email/user fallback. |
| Implemented | Default INR account creation for new users. |
| Implemented | Multiple account support with a global account switcher. |
| Implemented | Global account preference sanitization in live mode so stale demo account ids do not drive refresh-time API calls. |
| Implemented | Account-scoped expenses, budgets, parties, imports, reports, and notifications. |

## App Configuration And UX

| Status | Feature |
| --- | --- |
| Implemented | NovaCent branding through centralized app configuration. |
| Implemented | Login, registration, and password recovery pages use a responsive NovaCent-branded auth layout with prominent logo/app-name treatment, desktop split-panel presentation, and a form-first mobile brand-background layout. |
| Implemented | Central translation dictionary for changing app text from one file, with English, Spanish, French, Hindi, and Marathi language options. |
| Implemented | App-shell, auth screens, dashboard, expenses, budgets, imports, parties, reports, settings, chart captions, empty states, and common action/status labels are wired through the central translation helpers. |
| Implemented | Phase 3 recurring, support, statement password, split-selection, and split-mode labels use supplemental translations for English, Spanish, French, Hindi, and Marathi flows. |
| Implemented | Translation audit coverage includes confirmation dialogs, placeholders, chart accessibility labels, table captions, notification labels, and mobile drawer controls. |
| Implemented | Light/dark theme switching. |
| Implemented | Responsive app shell with sidebar navigation and top account controls. |
| Implemented | Mobile navigation opens as a right-side slide-in drawer from the hamburger menu, while header controls reflow into compact grids on smaller screens. |
| Implemented | Mobile app shell uses a compact brand bar with notifications beside the hamburger menu; account, language, and theme controls move into the bottom of the navigation drawer to keep page content higher. |
| Implemented | Settings moved from the main nav list to a square gear shortcut beside the wider logout button in the navigation footer. |
| Implemented | Default currency preference is saved locally and preselects currency for new expenses, budgets, recurring rules, and party expenses without re-labeling existing stored transactions. |
| Implemented | Money displays include the active currency code beside formatted amounts so mixed-currency values are explicit. |
| Implemented | Default account labels use neutral "Primary Account" wording, with legacy "Primary INR Account" display names normalized in the UI. |
| Implemented | Dashboard and Reports metric cards become horizontally scrollable swipe rails on mobile. |
| Implemented | Dashboard loads account summary metrics through a lightweight overview API and shows a loading state instead of temporary zero-value metrics while the first overview request is pending. |
| Implemented | Dashboard separates remaining budget into monthly remaining and yearly remaining cards instead of showing a combined runway metric. |
| Implemented | Responsive hardening for top-bar actions, page actions, forms, tables, charts, participant chips, and mobile action buttons. |
| Implemented | Date fields use a shared accessible picker control with a visible calendar button across expenses, recurring rules, party expenses, and report filters. |
| Implemented | Native dropdown controls use consistent app-wide width, text clipping, dark-mode color-scheme, and option theme styling where browsers allow it. |
| Implemented | Refreshed multi-accent visual system with blue, teal, violet, amber, and rose tokens instead of a single green-heavy palette. |
| Implemented | Reports and charts use shared chart color tokens for clearer category, cashflow, budget, party, and currency visuals. |
| Implemented | Report timeframe presets render as compact desktop buttons and a mobile-friendly dropdown. |
| Implemented | Report export actions use compact side-by-side mobile controls to keep report content higher on the page. |
| Implemented | Dark-mode report chart tooltips use theme-aware text and surface colors for readable values. |
| Implemented | Compact mobile top-bar action wrapping so theme, logout, notifications, and status controls do not stretch into distorted blocks. |
| Implemented | Accessible labels, captions, semantic tables, status messages, and keyboard-friendly controls. |
| Implemented | Modern UI polish, chart visuals, transitions, and stable form layouts. |
| Implemented | Authenticated How to use NovaCent guide page linked from Settings with a localized broad feature overview plus centrally managed new-user steps for accounts, expenses, budgets, imports, parties, recurring expenses, reports, notifications, support, bulk actions, and progress-loader behavior. |

## Expenses

| Status | Feature |
| --- | --- |
| Implemented | Overall expense ledger with search. |
| Implemented | Dashboard total spend nets eligible imported deposit/reimbursement credits against imported statement spend, while imported salary, self-transfer, sweep, and investment-transfer rows are ignored by keyword. |
| Implemented | Expense ledger, recent activity, party expense tables, group balances, split amounts, and settlement approval amounts use consistent signed money-flow display: paid/owed outflows are red negatives and received inflows are green positives. |
| Implemented | Quick-add expense form appears above the ledger and defaults the date to the local current date. |
| Implemented | Manual expense create flow with success/error feedback. |
| Implemented | Expense ledger supports row checkboxes, select-all for visible selectable expenses, and confirmed one-request bulk deletion of selected deletable expenses. |
| Implemented | Expense rows preserve and display the original saved amount and currency; converted values are kept as calculation metadata only. |
| Implemented | Category pickers include Food, Shopping, Travel, Fuel, Loan/EMI, Subscriptions, Health, Others, plus import-specific Uncategorized/Reimbursements options. |
| Implemented | Offline expense queueing when the device is offline. |
| Implemented | Expense delete button with confirmation. |
| Implemented | Delete confirmations use a responsive in-app translated dialog instead of browser popups. |
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
| Implemented | Budget calculations net eligible imported deposit/reimbursement credits against imported statement spend, while imported salary, self-transfer, sweep, and investment-transfer rows are ignored by keyword. |
| Implemented | Budget spend is calculated by converting matching expenses into the budget/default currency before summing mixed-currency rows. |
| Implemented | Dashboard Budget Health and Budgets page display budget spend, limit, and included expense amounts in the selected default currency. |
| Implemented | Budget cards can expand to show the exact expenses included in the active calculation window. |
| Implemented | Budget included expense rows are shown as red outflows for paid amounts and green inflows for received credits/reimbursements, while main budget limit values keep their normal budget styling. |
| Implemented | Main budget spend values turn red when the active usage reaches the budget alert threshold and stay green while below it. |
| Implemented | Dashboard Budget Health and Budgets page rows highlight spend, limit, and percent values for faster scanning. |
| Implemented | Default budget alert threshold of 80 percent. |
| Implemented | Budget threshold notifications. |
| Implemented | Budget spend impact on expense creation and reversal on expense deletion. |

## Recurring Expenses

| Status | Feature |
| --- | --- |
| Implemented | Recurring expense rules can be created, viewed, edited, paused, resumed, and ended. |
| Implemented | Recurring rules auto-create due expenses through a Vercel Cron-compatible background endpoint. |
| Implemented | Recurring auto-runs use idempotent client mutation ids so the same due occurrence is not duplicated. |
| Implemented | Recurring expenses preserve currency snapshots and feed normal expense, budget, and report totals. |

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
| Implemented | Registered friend search by name/email hides the party owner and people already added by user/account/email, while same-name users remain selectable with their email shown clearly in responsive result rows. |
| Implemented | Add registered users to parties. |
| Implemented | Add non-registered external placeholders from the friend search results only when no registered user matches the search. |
| Implemented | Party expense creation inside a party. |
| Implemented | Party expense creation works for owner-plus-participant parties, including older party records where the owner was stored on the party account but not yet materialized as a participant. |
| Implemented | Shared party workspaces read party expenses across the owner account and registered participant accounts while keeping splits and settlements under the party owner account. |
| Implemented | Party expense paid-by participant selection. |
| Implemented | Even split and manual split amount modes. |
| Implemented | Percentage and share split modes, with the payer included in the split math by default and allowed to have a zero share. |
| Implemented | Existing manual, imported, and recurring expenses can be selected from the ledger and converted into party split expenses without duplicating expense rows. |
| Implemented | Existing selected expenses can be added to an existing party split, or staged for a new party until participants are added. |
| Implemented | Staged split callout explains when another participant is required before selected expenses can be added. |
| Implemented | Split validation that participants belong to the party. |
| Implemented | New party splits notify registered participants who owe a share, while skipping external placeholders and the signed-in actor who created the split. |
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
| Implemented | Bank statement parser recognizes common Date, Description/Narration/Particulars, Ref/UTR/Cheque, Withdrawal/Debit/DR, Deposit/Credit/CR, Amount, Currency, and Balance column patterns across different statement layouts. |
| Implemented | Import review separates withdrawal and deposit amounts: withdrawals post as spend, while deposits post as negative gain/reimbursement cashflow when approved. |
| Implemented | Approved import expenses retain the original statement description so spend/budget rules can identify salary, self-transfer, sweep, and investment-transfer rows. |
| Implemented | Import review displays one signed amount column with deposits shown as green positive inflows and withdrawals shown as red negative outflows. |
| Implemented | Import review uses a desktop-aligned table and mobile cards with minimal description/amount/approve/delete controls plus expandable details. |
| Implemented | Import review lets each staged row be approved with a selected category from a dropdown, including leaving it as Uncategorized. |
| Implemented | Text/PDF import parsing prefers detected transaction table sections and skips account-level metadata such as account opening date, minimum balance, opening/closing balance, and statement summaries. |
| Implemented | Text/PDF import parsing merges wrapped transaction lines so rows split across multiple PDF text lines are still captured. |
| Implemented | PDF statement text extraction preserves column spacing more carefully before parsing, reducing merged date/amount/reference rows. |
| Implemented | Review-before-save import workflow. |
| Implemented | Import review header shows the current visible pending row count for all rows or duplicate-only filtering. |
| Implemented | Imported row approve and delete actions. |
| Implemented | Import review supports bulk approval for all rows or all non-duplicate rows, while preserving per-row category selections. |
| Implemented | Import review supports confirmed one-request bulk deletion for selected staged rows, with responsive bulk action controls on desktop and mobile. |
| Implemented | Bulk import approvals and deletes are sent from the UI in one API request; the backend groups rows by statement batch and uses bulk expense inserts plus bulk import-row status updates. |
| Implemented | Import batches store scalable metadata while import rows are read from the indexed `importRows` collection, avoiding repeated large embedded batch documents during review. |
| Implemented | Import approval uses bulk expense inserts, bulk import-row status updates, and grouped budget-impact updates to reduce large-statement approval time. |
| Implemented | Possible duplicate detection and duplicate filter. |
| Implemented | Category suggestions for imported rows. |
| Implemented | Uploaded file name is retained as metadata. |
| Implemented | Password-protected text PDF statements can be uploaded with a transient statement password. The password is used only for parsing and is not stored in MongoDB. |
| Implemented | Missing or incorrect statement password attempts create a failed import batch and a warning notification with a retryable error message. |
| Deferred | Scanned PDF/image OCR is planned for the OCR import phase. |

## Reports And Analytics

| Status | Feature |
| --- | --- |
| Implemented | Category breakdown chart. |
| Implemented | Monthly cash-flow chart. |
| Implemented | Report generation supports timeframe filters with calendar date range controls and presets for past 15 days, 1 month, 3 months, 1 year by default, 3 years, and All. |
| Implemented | Budget variance chart. |
| Implemented | Merchant trend chart. |
| Implemented | Party settlement chart. |
| Implemented | Currency exposure chart. |
| Implemented | Live backend report summary powers category, monthly cashflow, budget variance, merchant trend, party balance, and currency exposure charts. |
| Implemented | CSV export for report data. |
| Implemented | Browser print/PDF export path. |
| Implemented | Report exports exclude the on-screen timeframe selector from PDF/print output; spreadsheet CSV exports contain only report data rows. |
| Implemented | PDF/print report export keeps summary metrics together and starts each report chart panel on a separate page. |
| Implemented | Reports ignore ledger-excluded party expenses and include finalized settlement cashflow. |
| Implemented | Report tracked spend uses the same imported reimbursement offset and ignored-cashflow keyword rules as dashboard and budgets. |
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
| Implemented | Notification center supports clearing all account notifications and uses fixed-height scrollable panels with themed smooth scrollbars on desktop and mobile. |
| Implemented | Scrollable tables and panels use the same themed smooth scrollbar styling as the notification center. |
| Implemented | Budget threshold notifications. |
| Implemented | Import and settlement notification support. |
| Implemented | Import password failures create warning notifications. |

## Customer Support

| Status | Feature |
| --- | --- |
| Implemented | Dedicated authenticated Support page in the main navigation with name, request type, and comments. |
| Implemented | Support request types include Add feature, Report issue, and Praise. |
| Implemented | Support submissions are saved to MongoDB with account/user association before optional admin email. |
| Implemented | Support admin email uses generic SMTP when `SUPPORT_ADMIN_EMAIL` and SMTP variables are configured, without blocking MongoDB persistence if email fails. |

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
| Deferred | Scanned PDF and image OCR import with async/background processing and later sync into import review. |
| Deferred | Production SMTP email delivery verification against a real provider/account. |
| Deferred | Google OAuth verification with real production credentials. |
