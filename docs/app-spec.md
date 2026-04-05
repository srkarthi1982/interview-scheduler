# App Spec: interview-scheduler

## 1) App Overview
- **App Name:** Interview Scheduler
- **Category:** Career / Scheduling
- **Version:** V1
- **App Type:** DB-backed
- **Purpose:** Help an authenticated user organize interview sessions, add participants across time zones, and generate deterministic schedule suggestions for a chosen meeting date.
- **Primary User:** A single signed-in user coordinating interviews.

## 2) User Stories
- As a user, I want to create an interview record with candidate and role details, so that I can manage interview logistics in one place.
- As a user, I want to add interview participants with availability windows and time zones, so that suggestions reflect real participant constraints.
- As a user, I want ranked scheduling suggestions and a final selected slot, so that I can choose a practical interview time without manual time-zone math.

## 3) Core Workflow
1. User signs in and opens `/app`.
2. User creates an interview with title, candidate, role, stage, date, and duration.
3. User adds participants with required/optional status, local time zone, availability, and optional preferred hours.
4. User generates suggestions and reviews ranked options on `/app/interviews/[id]`.
5. User selects one suggestion, which becomes the chosen interview slot for that record.

## 4) Functional Behavior
- Interview records, participants, and generated suggestions are stored in Astro DB per authenticated user.
- Suggestions are deterministic rather than AI-generated; the engine computes overlap windows from participant availability and ranks them.
- Participant edits invalidate prior suggestion state by resetting the interview back to a draft-style regeneration state.
- The current implementation includes parent dashboard/activity and notification integration around interview lifecycle events.
- Public landing content lives at `/`, while actual scheduling workflows live behind the parent-authenticated app routes.

## 5) Data & Storage
- **Storage type:** Astro DB
- **Main entities:** `Interviews`, `InterviewParticipants`, `InterviewSuggestions`
- **Persistence expectations:** Interview plans and suggestion history persist per user until updated or deleted.
- **User model:** Single-user ownership of each interview record

## 6) Special Logic (Optional)
- Required and optional participants are scored separately, so coverage and ranking can prefer stronger overlap without pretending every participant must always match.
- Time-zone validation uses supported IANA-style time zone values and normalized local time windows.
- Selecting a final suggestion stores the chosen suggestion reference on the interview record rather than just keeping it in browser state.

## 7) Edge Cases & Error Handling
- Invalid participant input: Missing valid time zone, missing availability bounds, or partial preferred-hour input should be rejected server-side.
- Invalid interview input: Missing date, invalid stage, or too-short duration should not save.
- Stale suggestions: Participant or interview changes should force regeneration rather than silently reusing outdated slots.
- Missing records: Invalid interview or participant IDs should return a safe not-found path instead of exposing cross-user data.

## 8) Tester Verification Guide
### Core flow tests
- [ ] Create an interview, add participants in different time zones, and generate suggestions.
- [ ] Select a suggestion and confirm it remains associated with the interview after refresh.
- [ ] Update participant availability and confirm previous suggestions are cleared or regenerated truthfully.

### Safety tests
- [ ] Submit a participant with invalid or partial preferred hours and confirm the action rejects it clearly.
- [ ] Open an invalid `/app/interviews/[id]` route and confirm the app fails safely.
- [ ] Confirm unauthenticated access to `/app` routes redirects through the parent auth boundary.

### Negative tests
- [ ] Confirm there is no calendar sync, email invite sending, or AI scheduling analysis in V1.
- [ ] Confirm suggestion ranking is deterministic from participant data rather than opaque/generated behavior.

## 9) Out of Scope (V1)
- Google or Microsoft calendar sync
- External invitation emails
- Multi-day interview workflows
- Interview scorecards or evaluation forms
- Team/org workspaces

## 10) Freeze Notes
- V1 freeze: this document reflects the current deterministic interview scheduling implementation and authenticated DB-backed flows.
- Current implementation appears stable from repo structure and action contracts; final QA should still browser-verify suggestion ranking, selection persistence, and regeneration behavior.
- During freeze, only verification fixes, cleanup, and documentation hardening are allowed.
