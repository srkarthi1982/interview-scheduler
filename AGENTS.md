⚠️ Mandatory: AI agents must read this file before writing or modifying any code.

MANDATORY: After completing each task, update this repo’s AGENTS.md Task Log (newest-first) before marking the task done.
This file complements the workspace-level Ansiversa-workspace/AGENTS.md (source of truth). Read workspace first.

# AGENTS.md
## Interview Scheduler Repo – Session Notes (Codex)

This file records the current state of the `interview-scheduler` mini-app. Read first.

---

## 1. Current Architecture

- Bootstrapped on 2026-03-17 from `app-starter` V2, not the legacy starter.
- Public-first app with:
  - landing page at `/`
  - authenticated interview list at `/app`
  - authenticated interview detail at `/app/interviews/[id]`
- Uses `APP_META` for identity plus the local mini-app bar wrapper pattern.
- Parent-app JWT auth, shared `AppShell`, shared `global.css`, and middleware parity preserved.
- One global Alpine store: `src/modules/interview-scheduler/store.ts`.
- Server actions wired through `astro:actions` under `interviewScheduler`.
- Dashboard + notifications webhooks included from V1.

---

## 2. V1 Data Model

Defined in `db/tables.ts`:

- `Interviews`
- `InterviewParticipants`
- `InterviewSuggestions`

V1 intentionally does not include organizations, team workspaces, recurring workflows, external calendar sync, email delivery, or admin tables.

---

## 3. V1 Scope

- Public marketing landing page with career-focused interview scheduling positioning.
- Saved interview CRUD for authenticated users.
- Candidate/interviewer/observer participant CRUD with IANA time zone selection and local availability windows.
- Deterministic server-side suggestion engine for one interview date.
- Ranked suggestions with `best` / `good` / `partial` classification and final slot selection.
- Dashboard summary/activity payload support for parent integration.

### Explicit V1 non-goals

- No admin pages.
- No billing-specific custom UI.
- No AI integration.
- No Google/Microsoft calendar sync.
- No multi-day or recurring interview workflows.
- No external email sending.
- No interviewer scorecards.
- No resume/portfolio auto-import.
- No organization/team management.

---

## 4. Verification Log

- 2026-03-17 `npm run typecheck` ✅ (pass; 5 existing redirect-page hints only).
- 2026-03-17 `npm run build` ✅ (pass).

---

## Task Log (Recent)

- 2026-03-18 Completed pre-launch full verification sweep (routing, interview CRUD, participant CRUD, suggestion selection states, empty/error handling, and build/typecheck). Applied safe UI fallback fix on `/app/interviews/[id]` so the Selected slot card now shows the empty-state message when `selectedSuggestionId` is stale/missing; re-verified with `npm run typecheck` and `npm run build` ✅.
- 2026-03-17 Configured `interview-scheduler` production env files to the new Turso database (`interview-scheduler-ansiversa`) and verified remote schema push success with `npm run db:push`.
- 2026-03-17 Bootstrapped Interview Scheduler V1 from `app-starter` V2: created `APP_META` identity, preserved the V2 public `/` + authenticated `/app` baseline, added interview-specific DB tables (`Interviews`, `InterviewParticipants`, `InterviewSuggestions`), implemented interview actions/store/pages and deterministic suggestion generation, included dashboard + notification integrations from day one, and documented intentional V1 deferrals. Verification: `npm run typecheck` ✅, `npm run build` ✅.
- Keep newest first; include date and short summary.
