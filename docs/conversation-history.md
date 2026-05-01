# NovaCent Conversation History Export

Last updated: 2026-05-01

This file captures the user-visible project conversation and decisions available in the current Codex project context. It intentionally excludes hidden system/developer instructions, raw terminal logs, internal tool output, and any secret values.

## 1. Initial Product Requirement

- User asked Codex to act as an SDLC manager, architect, UX designer, and Next.js developer for an expense tracker application.
- Core requirements included robust workflow planning, modern responsive UX, Next.js UI/backend, MongoDB integration, authentication, authorization, middleware, forgot/change password, accessibility, reports, graphs, categories, account-scoped expenses, PDF bank statement upload, dark/light mode, translations from one file, centralized logo/app name configuration, recurring expenses, different report types, and trip-specific expenses.
- Codex analyzed the requirements and identified missing areas such as multiple users, currency handling, bank statement review, budgets, groups/splits, offline behavior, deployment, and import safety.

## 2. Clarified Product Scope

- User confirmed the app is for multiple users.
- User wanted both username/password and Google authentication.
- User wanted multiple currency support with INR as default base currency.
- User preferred support for many bank statement formats.
- User accepted a review-before-save workflow for scanned/imported bank statement rows, including deleting rows before approval.
- User wanted budget alarms as in-app notifications, defaulting to 80 percent unless customized.
- User wanted trips and shared group expenses with participants, split tracking, and settlement handling.
- User wanted Vercel deployment.
- User wanted offline use where data is stored locally and synced later.
- User required TypeScript throughout.
- User asked to avoid paid packages unless no free alternative exists.

## 3. Account, Participant, And Currency Rules

- User clarified that one user can have multiple accounts, but one main account is the focus.
- Non-registered participants should be supported as placeholders, mainly inside parties.
- Exchange rates should be fetched automatically when adding expenses and cached for offline use.
- Bank statement uploads should not store the PDF after extraction, but should store the uploaded file name.
- Settlements between registered users require approval by the owner of the relevant expense.
- Settlements for non-registered placeholders settle directly without approval.
- Account switching should be globally visible.
- Imported statement rows should support category auto-suggestions, such as merchant-based rules.

## 4. Initial Build And Phase Tracking

- User asked Codex to begin building the web application using orchestral agents and to provide setup steps, API keys, environment variables, and a working app.
- User told Codex not to ask for command permissions related to product development.
- User later asked whether all features were implemented or whether some were remaining.
- Remaining requirements were captured for later phases.
- Markdown requirement and planning documents were kept inside the project directory.
- Running development servers were stopped when the user requested it.
- Port `3000` conflicts were diagnosed as a running server/process issue.

## 5. Early UI And Mock/Live Mode Issues

- User reported the login UI was misaligned.
- Codex adjusted auth form layout and styling.
- User asked how to switch from mock data to live APIs later.
- Codex explained the mock/live toggle and later added the live API switch as a Phase 2 requirement.
- User added Phase 2 items: richer charts, notifications, bank statement duplicate prevention, modern UX with animations/transitions, and app branding as NovaCent with logo.

## 6. Phase 2 And Phase 3 Planning

- User asked to begin Phase 2 using orchestral agents.
- User clarified Phase 2 should switch the app to live APIs by default.
- User requested Phase 3 to be fully implemented.
- User clarified Google login credentials were not ready, but wiring should be kept.
- User requested possible duplicate rows during import, with a filter to remove duplicates.
- User asked to use free libraries.
- Remaining Phase 3 items were added to `docs/phase-3-requirements.md`.
- User added new Phase 3 requirements: adding existing expenses into splits and a customer support form.

## 7. Expense Page Fixes

- User reported UI distortion in the quick-add expense form and asked that the default date be today's date.
- Codex adjusted responsive form alignment and default date behavior.
- User reported expenses were saved but the UI still showed "unable to save expense."
- Codex fixed save-state handling.
- User reported the top "Add expense" button did nothing.
- Codex connected it to the quick-add form/focus behavior.
- User later requested Quick Add to appear above the ledger table.
- Codex moved the Quick Add section above the expense ledger.
- User requested delete expense behavior with confirmation and ledger removal.
- Codex implemented delete controls and locking rules for settlement rows and settled party expenses.

## 8. Buttons And CRUD Workflows

- User reported that Add Budget, Add Party, and Add Trip buttons did not work.
- Codex wired these buttons to their corresponding forms and actions.
- User later requested delete buttons for expenses, parties, trips, and budgets with confirmation popups.
- Codex implemented delete actions and admin-scoped visibility.
- User required that once deleted, related entries disappear from overall expenses as well.
- Codex ensured party expense deletions remove ledger impact where allowed.
- User required that settled trip/party expenses cannot be deleted.
- Codex enforced delete locks for settled party expenses and settlement rows.

## 9. Parties, Splits, And Settlements

- User requested careful party architecture:
  - Parties can be opened and clicked.
  - Expenses can be added inside parties.
  - Friends can be searched from registered users.
  - If not found, users can be added as non-registered placeholders.
  - Expenses can be split evenly or manually.
  - Registered users require settlement approval.
  - External placeholders settle directly.
- Codex implemented parties as shared-spending workspaces with participants, splits, settlement requests, approval flows, and ledger impact.
- User clarified that expenses paid by or reimbursed by friends should reflect in overall expenses.
- Codex updated settlement cashflow behavior so reimbursements and paid settlements affect the ledger/reporting correctly.
- User asked whether trips and parties were the same.
- Codex explained overlap and later removed trip functionality in favor of parties as the shared-spending workspace.
- User requested removing trips from the app and keeping only parties.
- Codex removed Trips from navigation and redirected `/trips` to Parties.

## 10. Party UX Iterations

- User requested that external placeholders should not be a separate field.
- Codex changed friend search so a "Add entered name/email as non-registered person" option appears only when no registered match exists.
- User asked that if a user exists in search results, non-registered add messaging should not appear.
- Codex refined participant search result behavior.
- User asked to remove users before saving a party.
- Codex supported removal before party save.
- User requested focus to move to the form when clicking "Open party."
- Codex added focus/scroll behavior.
- User requested party list and party form not be visible at the same time.
- Codex changed Parties to a list/workspace flow with Back to parties.
- User requested party creation only capture the party name, with participants added after opening a party.
- Codex simplified create-party form and moved participant management into party workspace.

## 11. Budget Behavior

- User asked for budget edit options.
- Codex added edit budget workflow.
- User reported budgets were not picking up expense amounts.
- Codex fixed budget spend calculation across current monthly/yearly windows and category matching.
- User clarified budgets can be monthly or yearly.
- User clarified monthly budgets always run from the first of the month and yearly from the first of the year.
- Codex implemented period windows.
- User asked to remove verbose period dropdown text and keep only "Monthly" and "Yearly."
- Codex simplified period labels.
- User requested budget expansion to show which expenses are included in calculation.
- Codex added expandable included-expense details to budget cards.

## 12. Reports And Analytics

- User asked whether showing full original party expense in category spend was correct after reimbursement.
- Codex adjusted reports so settlement reimbursements net back to original party expense category, showing final personal spend.
- User asked for report timeframe filters: calendar date range, past 15 days, 1 month, 3 months, 1 year, 3 years, and All, with 1 year default.
- Codex added report timeframe filters and backend report summary support.
- User later reported reports were not loading after timeframe changes.
- Codex fixed report loading/range behavior.
- User asked for additional categories: Fuel, Loan/EMI, Others.
- Codex added these categories to category pickers and translations.

## 13. Bank Statement Import

- User reported PDF upload was not fetching records properly.
- User said parsing should check withdrawal amount, deposit amount, date, reference number, and description.
- User clarified withdrawals are spend and deposits are gains.
- User noted row names vary by statement and asked for common pattern support.
- Codex expanded parser patterns for common statement columns and transaction table extraction.
- User asked to remove confidence/ref/withdrawal/deposit columns and use a single signed amount column.
- Codex simplified import review columns.
- User reported statement metadata, such as account opening date and minimum balance, was being treated as expenses.
- Codex improved parsing to prefer transaction sections and skip account-level metadata.
- User asked for mobile import review cards with expandable details and minimal visible info.
- Codex implemented responsive import cards.
- User asked for category dropdown assignment or Uncategorized for each import row.
- Codex added category selection on import rows.
- User requested password input for locked bank statement PDFs.
- Codex added transient statement password handling for protected PDFs without storing the password.

## 14. Recurring Expenses

- User clarified that manual-run recurring rules were not needed.
- User wanted recurring expenses to be created automatically in the background and synced later if needed.
- Codex implemented recurring expense rules, background run endpoint, edit/pause/resume/end flows, and ledger/budget/report inclusion.
- User reported date pickers were not working.
- Codex introduced a shared date picker control across forms, including recurring rules and reports.

## 15. Notifications

- User asked for budget alarms as in-app notifications.
- Codex implemented budget threshold notifications.
- User requested clear notification functionality and fixed-height notification panels with scroll on desktop and mobile.
- Codex implemented clearing notifications and fixed-height scrollable notification panels.
- User asked to style the scrollbar smoothly.
- Codex styled the notification scrollbar.

## 16. Customer Support

- User requested a customer support form with name, dropdown type, and comments.
- User clarified the support form should be after login so submissions can be tied to a user.
- User wanted support requests saved to MongoDB first, then emailed to admin once SMTP is configured.
- Codex implemented authenticated Support page, support API, MongoDB storage, and generic SMTP email support.
- User asked where the customer feedback page was.
- Codex exposed/linked Support in the app navigation.
- User asked about free SMTP providers.
- Codex recommended free SMTP/email options and discussed Brevo configuration.
- User asked how to configure Brevo and which SMTP envs are required.
- Codex explained required SMTP variables.

## 17. Google OAuth And Email

- User asked how to configure Google OAuth 2.
- Codex explained Google Cloud OAuth client setup and environment variables.
- User reported no reset-password email was received.
- Codex guided SMTP verification and environment configuration.

## 18. PWA And Offline

- User asked whether the app has PWA functionality.
- Codex confirmed/implemented PWA manifest and offline service-worker foundation.
- User requested a PWA install prompt configuration.
- Codex added install prompt behavior and manifest shortcuts.
- User wanted offline expense additions and cached report viewing support.
- Codex implemented offline queueing and sync foundation.

## 19. App Shell, Header, And Responsiveness

- User repeatedly reported UI responsiveness issues on desktop, tablet, and mobile.
- Codex added a responsiveness checklist and adjusted app shell layout.
- User requested a mobile navigation panel sliding right-to-left from hamburger.
- Codex implemented mobile drawer navigation.
- User requested greeting and logout at the bottom of the navigation panel.
- Codex moved `Hi <first name>` and logout to the nav footer.
- User requested settings as a gear icon beside logout with an approximate 5:1 width ratio.
- Codex moved Settings to a square gear shortcut beside the wider logout button.
- User requested mobile top section to take less vertical space and notification icon beside hamburger.
- Codex compacted mobile header and moved account/language/theme controls into the drawer bottom area.

## 20. Translation And Guide

- User requested Hindi, Marathi, French, and Spanish translations.
- Codex added those language options.
- User repeatedly pointed out untranslated strings.
- Codex audited and moved more labels, headings, captions, buttons, placeholders, confirmation text, and guide text into translation dictionaries.
- User requested a "How to use NovaCent" guide page linked from Settings.
- Codex created the guide page with user-friendly sections and later made the guide translation-ready.

## 21. Documentation And Feature Lists

- User asked to note down all implemented features and update the document whenever features are added.
- Codex created and maintained `docs/features-list.md` as a detailed living inventory.
- User asked for a QA tester/regression role.
- Codex created regression testing expectations and checklist documentation.
- User asked for a responsiveness checker role.
- Codex maintained a responsiveness checklist.
- User requested a broad available-features list in one-liners.
- Codex created `docs/available-features.md`.
- User asked to make available features more concise.
- Codex condensed it into a short product summary and broad one-line bullets.

## 22. Login/Auth UX Iterations

- User asked to beautify the login page for desktop and mobile.
- Codex redesigned the auth layout with NovaCent logo/app name, branded desktop split panel, improved form rhythm, and responsive mobile behavior.
- User said desktop was good but mobile was missing desktop intro text.
- Codex brought the brand intro copy into mobile.
- User asked for the brand intro to be background and form to come on top.
- Codex changed mobile auth so the brand panel became a background layer with form over it.
- User said the form was still pushed too far down and that the form is the main item.
- Codex moved the mobile form higher and reduced the background intro visual weight.

## 23. Current Request

- User requested an export of the entire project conversation history into a Markdown file.
- Codex created this file at `docs/conversation-history.md`.

## Related Project Documents

- `docs/features-list.md` contains the detailed living implementation inventory.
- `docs/available-features.md` contains the concise user-facing feature summary.
- `docs/phase-2-requirements.md` contains Phase 2 backlog/history.
- `docs/phase-3-requirements.md` contains Phase 3 requirements and decisions.
- `docs/regression-test-plan.md` contains QA regression guidance.
- `docs/responsiveness-checklist.md` contains UI responsiveness checks.
- `docs/vercel-setup.md` contains deployment/setup notes.
