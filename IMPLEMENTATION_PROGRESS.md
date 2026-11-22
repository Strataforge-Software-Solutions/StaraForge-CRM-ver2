# CRM improvement implementation

Authorized scope: all four improvement batches discussed on November 23, 2026.

- [x] Correct dates, dashboard actions/counts, pagination, sorting, and save feedback.
- [x] Stable record identities and relationships; conflict-aware persistence, refresh, validation, history.
- [x] Connect proposal acceptance, deposits, projects, payment schedules, balances, and reports.
- [x] Ownership, next actions, follow-up queue, customer history, contacts, loss reasons, filters, CSV preview and duplicate detection.
- [x] Responsive workflows and accessible alternatives to dragging.
- [x] Build and meaningful regression checks; user-facing change guide.

Preserve existing workspace data. Do not seed sample records. Existing uncommitted changes predate this work and must remain intact.

Validation scope: frontend build, API typecheck, 18 mocked regression checks and read-only browser inspection passed. Full authenticated multi-user writes and complete mobile interaction acceptance remain unverified; see CRM_CHANGE_GUIDE.txt.
