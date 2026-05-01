# Expense Tracker Application Requirements Baseline

## Purpose

Build a multi-user, offline-capable expense tracker for personal, trip, party, recurring, imported, and budget-based expense management. The application should be built with Next.js and TypeScript, use MongoDB for persistence, support Vercel deployment, and avoid paid packages or paid services unless no practical free/open-source alternative exists.

## Locked Product Decisions

| Area | Decision |
| --- | --- |
| Users | Multiple users are supported. |
| Accounts | Each user can have multiple accounts, with the primary focus on one main/default account. |
| Account switching | Account switching must be globally visible. |
| Authentication | Support email/password login and Google login. |
| Authorization | Expenses and reports must be isolated by account and never visible across unauthorized accounts. |
| Base currency | Indian Rupee, `INR`. |
| Currency support | Expenses, trips, and parties support multiple currencies. |
| Exchange rates | Fetch live exchange rates when online at expense creation time. Cache fetched rates for offline use and reuse cached rates when offline. |
| Offline use | Support adding expenses offline and viewing cached reports offline. Sync local changes when connectivity returns. |
| Budget alarms | In-app notifications only. Thresholds are customizable. Default threshold is 80 percent if user has not configured one. |
| Statement upload | Support bank statements across PDF, scanned PDF/image, CSV, and spreadsheet-like formats over phased delivery. |
| Import review | Parsed statement rows must be reviewed before save. Users can edit or delete rows during review. Only approved rows are stored as expenses. |
| Uploaded file retention | Delete uploaded statement files after extraction. Store metadata such as original file name, upload date, status, and optional file hash. |
| Category suggestions | Imported rows should support merchant/category rules such as `Swiggy = Food`. |
| Recurring expenses | Support recurring monthly expenses up to a specific end date. |
| Trips | Support future and present trips, multiple currencies, multiple participants, and trip-specific reports. |
| Parties | Support group expenses across multiple registered accounts and external participants. |
| External participants | Non-registered participants exist only inside a party. They are not global contacts. |
| External settlement | Mark-as-settled for external participants settles directly without approval. |
| Registered settlement | Settlement affecting a registered user's account requires approval from the affected account owner. |
| Branding | App name and logo must be configurable from one central place. |
| Translation | Application text must be configurable through one translation source per locale so text updates propagate across the app. |
| Theme | Support smooth switching between light and dark modes. |
| Accessibility | Target modern accessibility standards, including keyboard navigation, accessible forms, and accessible report alternatives for charts. |
| Deployment | Vercel. |
| Technology | TypeScript throughout frontend, backend, shared types, and scripts. |

## Functional Scope

### Authentication And User Management

- Register with email/password.
- Sign in with email/password.
- Sign in with Google.
- Forgot password with secure, expiring, single-use reset token.
- Change password from authenticated settings.
- Protect authenticated routes with Next.js-compatible route/session handling.
- Enforce authorization in the data access layer for every account-scoped operation.
- Support global account switcher for users with multiple accounts.

### Accounts

- Create and manage multiple accounts per user.
- Mark one account as default.
- Use current active account for all account-scoped dashboards, reports, budgets, and expenses.
- Prevent leakage of expenses, reports, parties, trips, imports, and budgets across accounts.

### Expenses

- Add expense manually.
- Add income or adjustment records if enabled during implementation planning.
- Add future-dated and present expenses.
- Assign category, account, currency, payment mode, merchant, notes, tags, trip, party, and recurrence.
- Store original currency amount and converted INR base amount.
- Track exchange rate source, timestamp, and rate snapshot.

### Recurring Expenses

- Create monthly recurring expense rules.
- Configure start date and end date.
- Generate or forecast monthly occurrences.
- Include recurring expenses in reports and avoidable expense analysis.
- Allow users to stop or edit recurrence rules.

### Budgets And In-App Alarms

- Create budgets by account, category, and time period.
- Allow custom alert thresholds.
- Default threshold is 80 percent.
- Show in-app notifications when budget usage crosses configured thresholds.
- Include budget status in reports.

### Trips

- Create future or active trips.
- Add individual and shared trip expenses.
- Support multiple currencies.
- Support multiple participants.
- Include trip expenses in global reports and trip-specific reports.

### Parties And Split Expenses

- Create party for group expense tracking.
- Add registered users/accounts as participants.
- Add external participants scoped only to that party.
- Create shared expenses and split by equal amount, percentage, exact amount, or shares.
- Track outstanding balances by participant.
- Allow direct settlement for external participants.
- Require approval for settlement affecting a registered account.

### Statement Import

- Upload bank statements.
- Parse supported formats.
- Create temporary import batch and import rows.
- Suggest categories based on rules and merchant matching.
- Show confidence and source text where available.
- Allow user to edit, delete, and approve parsed rows.
- Save only approved rows as expenses.
- Delete uploaded statement file after extraction.
- Store statement metadata, including original file name.

### Reports

- Generate reports for selected account, date range, category, currency, trip, party, and recurrence type.
- Show visual charts and accessible table equivalents.
- Support cached report viewing offline.
- Include all expense input paths in reporting: manual, recurring, imported, trip, and party expenses.

Recommended report types:

| Report | Purpose |
| --- | --- |
| Monthly summary | Total income/expense and net movement by month. |
| Category breakdown | Spending by category and subcategory. |
| Merchant analysis | Repeated merchants and high-frequency spending. |
| Budget variance | Budget versus actual by category. |
| Recurring expense report | Monthly recurring and potentially avoidable expenses. |
| Trip report | Trip-level spend by participant, category, and currency. |
| Party settlement report | Outstanding and settled group balances. |
| Currency exposure report | Original currency totals and INR converted totals. |
| Import review report | Imported rows, deleted rows count, approved rows count, and confidence summary. |

### Offline And Sync

- Store offline-created expenses in IndexedDB.
- Store cached exchange rates in IndexedDB.
- Store cached report payloads in IndexedDB.
- Use a sync outbox for offline mutations.
- Sync when app opens, when network returns, and where supported through background sync.
- Use client mutation IDs to avoid duplicate saves.
- Mark failed sync items for user action.
- Resolve conflicts with optimistic versioning and last-modified timestamps.

## Data Model Candidates

| Entity | Purpose |
| --- | --- |
| User | Authentication identity. |
| Account | User-owned financial account/workspace. |
| AccountMembership | Links users to accounts and roles if shared account support is added. |
| Category | System and user-defined expense categories. |
| CategoryRule | Merchant or pattern based category suggestion rule. |
| Expense | Core financial record. |
| RecurringRule | Monthly recurrence configuration. |
| Budget | Category/time based budget. |
| BudgetAlert | In-app notification threshold and trigger state. |
| Notification | In-app alert record. |
| Trip | Trip container for expenses and participants. |
| Party | Group expense container. |
| PartyParticipant | Registered user/account or external party-scoped participant. |
| Split | Participant share of a party or trip expense. |
| Settlement | Settlement request, direct settlement, or approved settlement. |
| ImportBatch | Statement parsing session metadata. |
| ImportRow | Temporary parsed row before approval. |
| CurrencyRate | Cached exchange rate snapshot. |
| SyncOutboxItem | Offline mutation pending sync. |

## Architecture Direction

- Use Next.js App Router with TypeScript.
- Use MongoDB as the primary database.
- Use Auth.js or equivalent established authentication library for credentials and Google login.
- Keep account authorization checks in server-side services and database query boundaries.
- Use Zod or an equivalent TypeScript-friendly validation library for form/API validation.
- Use IndexedDB for offline data, cached reports, cached exchange rates, and sync outbox.
- Use a free/open-source exchange-rate provider first. Frankfurter is a strong candidate because it is open-source, needs no API key, and supports daily reference exchange rates.
- Use free/open-source parsing libraries for CSV, spreadsheets, text PDFs, and OCR where feasible.
- For scanned statements, treat OCR as a second-phase capability if Vercel serverless constraints make it too slow for MVP.

## MVP Recommendation

### MVP 1

- Authentication with email/password and Google.
- Global active account switcher.
- Primary account expense tracking.
- Manual expenses with multi-currency conversion to INR.
- Category management and category rules.
- Budgets with customizable in-app alerts and default 80 percent threshold.
- Dashboard reports with accessible tables.
- Light/dark theme.
- Central app branding config.
- Central translation files.
- Offline expense creation, cached exchange rates, cached reports, and sync outbox.

### MVP 2

- Recurring expenses.
- Trips with multi-currency expenses.
- Parties with registered and external participants.
- Split expense tracking.
- Direct external settlement.
- Registered-user settlement approval.

### MVP 3

- Statement import for CSV, spreadsheet-like files, and text PDFs.
- Review/edit/delete/approve flow.
- Category auto-suggestions.
- Delete original upload after parsing while preserving metadata.

### MVP 4

- Scanned PDF/image OCR.
- Advanced reports.
- Export to CSV/PDF.
- Optional browser push or email alerts.

## Key Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Bank statement variety | Parsing all formats is complex. | Start with CSV/spreadsheet/text PDF, add bank-specific adapters, then OCR. |
| OCR on Vercel | Large scanned files may exceed serverless limits. | Use async processing or defer OCR to later phase. |
| Offline conflict handling | Duplicate or stale data can corrupt reports. | Use client mutation IDs, versioning, and conflict states. |
| Multi-currency accuracy | Reports may be misleading if rates change. | Store immutable rate snapshot per expense. |
| Authorization leakage | Financial privacy risk. | Enforce account scope in every data query and service method. |
| Local device privacy | Offline financial data sits on device. | Minimize cached sensitive data and document device-level responsibility. |

## Remaining Decisions

1. Should accounts be only personal, or can a user invite another registered user to the same account later?
2. Should the app support income records in MVP, or strictly expense records?
3. Which first three import formats should be prioritized: CSV, XLSX, text PDF, or scanned PDF?
4. Should budget periods be monthly only for MVP, or also weekly/yearly?
5. Should category rules be user-specific, account-specific, or global defaults plus user overrides?
6. Should report exports be included in MVP or later?

