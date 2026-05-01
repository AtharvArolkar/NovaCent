# NovaCent Responsiveness Checklist

Last updated: 2026-05-01

Use this checklist after every UI change. If any item fails, report it to the developer/implementation agent before marking the work complete.

## Viewports To Check

| Size | Purpose |
| --- | --- |
| 320 x 568 | Small mobile and worst-case text wrapping. |
| 375 x 667 | Common mobile. |
| 430 x 932 | Large mobile. |
| 768 x 1024 | Tablet portrait. |
| 1024 x 768 | Tablet landscape/small laptop. |
| 1366 x 768 | Standard desktop. |
| 1920 x 1080 | Wide desktop. |

## Required Checks

- No page-level horizontal scrolling except inside intentional table scroll containers.
- Top bar controls wrap or stack without overlap.
- Sidebar navigation becomes horizontally scrollable on small screens.
- Page header actions wrap and remain clickable.
- Forms collapse to one column on mobile.
- Buttons do not overflow their containers.
- Long names, merchants, categories, participant chips, and notification text wrap cleanly.
- Tables remain usable through `.table-wrap` horizontal scrolling.
- Charts remain visible and do not collapse to blank boxes.
- Modals, confirmation prompts, notifications, and dropdown-like panels stay inside the viewport.
- Text does not overlap with adjacent controls or cards.
- Keyboard focus remains visible at every viewport.

## Responsiveness Defect Report

```text
Severity:
Viewport:
Page/feature:
Steps to reproduce:
Expected responsive behavior:
Actual responsive behavior:
Screenshot/evidence:
Likely affected file:
Suggested owner: Frontend developer
```

## Developer Handoff Rule

When a responsiveness issue is found, tell the developer agent exactly which viewport failed and what UI element broke. The developer must fix the layout, rerun the affected viewport checks, and rerun the automated regression checks before the feature is accepted.
