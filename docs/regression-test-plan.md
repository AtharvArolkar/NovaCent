# NovaCent Regression Test Plan

Last updated: 2026-05-01

This document defines the QA regression process for NovaCent. After every product or code change, run the relevant regression checks before calling the work complete. If any check fails, report it as a developer-facing defect with reproduction steps, expected result, actual result, affected files/routes, and severity.

## QA Operating Rule

- Run automated checks after every code change: `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.
- For documentation-only changes, verify links and file presence instead of running the full build unless code behavior was affected.
- For feature changes, test the changed feature plus adjacent flows that share data or UI.
- For UI changes, run the responsiveness checklist in `docs/responsiveness-checklist.md`.
- For money-moving features, verify ledger, budget, report, account ownership, and deletion side effects.
- Do not mark a feature complete when a regression fails. Report the defect to the developer/implementation agent and keep the failed area listed in the final response.

## Defect Report Format

```text
Severity: Critical | High | Medium | Low
Feature:
Environment:
Steps to reproduce:
Expected:
Actual:
Evidence:
Suggested owner:
```

## Core Automated Regression

| Check | Command | Pass Criteria |
| --- | --- | --- |
| Type safety | `npm.cmd run typecheck` | No TypeScript errors. |
| Lint | `npm.cmd run lint` | No ESLint warnings or errors. |
| Production build | `npm.cmd run build` | Build completes and all routes compile. |

## Smoke Regression Checklist

| Area | Checks |
| --- | --- |
| Auth | Register, login, logout/session redirect, forgot password development URL, change password. |
| Accounts | Default INR account exists, global account switcher changes visible account-scoped data. |
| Expenses | Quick add defaults date to today, save succeeds without false error, search filters, delete confirms and removes ledger row. |
| Budgets | Create/edit monthly and yearly overall/category budgets, progress displays from existing matching expenses, threshold notifications are generated, delete confirms and removes budget. |
| Parties | Create party, open workspace, add registered friend, add external placeholder, create party expense, even split, manual split. |
| Settlements | External settlement closes directly, registered settlement creates approval request, approval creates settlement ledger rows, rejection reopens split. |
| Delete Locks | Settled party expenses cannot be deleted, settlement ledger rows cannot be deleted directly, non-admin party users do not see party delete controls. |
| Imports | Upload supported statement, review rows, filter possible duplicates, delete row, approve row, approved row appears in expenses. |
| Reports | Charts render, CSV export works, reports include settlement cashflow and exclude ledger-excluded party expenses. |
| Offline | Offline banner appears, offline expense queues, Sync now replays outbox when online. |
| Settings | Theme, language, and account preferences persist locally. |

## Money And Ownership Regression

Run these checks whenever expenses, parties, settlements, budgets, reports, imports, or delete behavior changes:

- Expense created under one account must not appear under another account.
- Budget spend increases on normal expense creation and reverses on normal expense deletion.
- Budget spend recalculates for the active month/year when budgets are created, edited, or listed.
- Overall budgets include every visible ledger expense in the active month/year.
- Budget spend must match existing expenses by category id and by visible category name to cover older records.
- Settlement expense rows do not affect budget spend.
- Party expense paid by another participant is excluded from the selected account ledger until settlement.
- Paid-to-friend settlement creates a positive `Party settlements` row in the payer ledger.
- Reimbursement creates a negative `Reimbursements` row in the receiver ledger.
- Reports net settlement reimbursements against the original party expense category, so category spend reflects final personal spend rather than gross paid amount.
- Budgets net settlement reimbursements against the original party expense category for the active budget period.
- Deleting a party expense removes it from the overall ledger.
- Settled party expenses and settlement ledger entries remain locked.

## Accessibility Regression

- Inputs must have visible labels or accessible labels.
- Tables must retain captions and header cells.
- Status/success/error messages must use status or alert semantics where appropriate.
- Buttons that reveal sections should expose expanded state when practical.
- Keyboard users must be able to reach and use create, delete, approve, reject, import, export, and search controls.

## Responsiveness Regression

Use `docs/responsiveness-checklist.md` after every UI change. At minimum, check mobile, tablet, and desktop widths. If layout overlap, clipped text, broken wrapping, inaccessible controls, or unintended page-level horizontal scrolling appears, report it as a frontend defect and do not accept the UI change until fixed.

## Developer Handoff Rule

When a regression fails, tell the developer/implementation agent:

1. What failed and why it matters.
2. Exact steps to reproduce.
3. The likely affected module or route.
4. Whether work should stop until the defect is fixed.
5. Which regression checks must be rerun after the fix.
