# Report Card — Mobile (Expo)

Mobile app for the Report Card school-management system, covering every role: students,
subject teachers, class teachers, and admins. Talks directly to the same Next.js backend
as the web app (`../src/app/api/**`) — no separate mobile API, no separate database. Auth
is the same Clerk project as the web app; a Clerk session token is sent as
`Authorization: Bearer <token>` on every request, which the backend already accepts
(`clerkMiddleware`'s route matcher covers `/api/**`, and `auth()` reads either a Bearer
token or the web session cookie).

## Roles & routing

After sign-in, `GET /api/auth/me` resolves the account's real role (not the possibly-stale
Clerk JWT claim — same reasoning as the web app's `auth-server.ts`) and routes to one of two
tab trees:

- **`/student`** — STUDENT role: Dashboard, Results (marks + report cards), Subjects
  (+ detail), Attendance, Fees, Profile.
- **`/staff`** — ADMIN, CLASS_TEACHER, SUBJECT_TEACHER: Dashboard (role-aware KPIs),
  People (students + teachers, list + detail), Attendance (view/mark by class + date),
  Announcements (view + post), Assignments (view + create), Fees (school-wide, read-only),
  Analytics (ADMIN only — school-wide subject averages), Profile.

The staff screens are shared across all three staff roles rather than three separate apps,
because the backend already scopes list endpoints (students, classes, subjects) to what
each teacher is assigned to — the mobile client doesn't need to duplicate that filtering.

An account with no role yet (`PENDING`) or any role this app doesn't recognize sees an
"Account not ready" screen with a sign-out button, instead of crashing into a role's
screens it doesn't have data for.

## Scope

Deliberately **not** built, all desktop-oriented admin tooling better suited to the web:

- New-account activation via invite code (`/activate` on web) — a one-time setup step;
  accounts activate on the web first, then use this app day-to-day.
- Bulk student import (CSV), academic-structure editing (grades/streams/subjects/terms),
  user management (create/deactivate accounts), exam mark entry, PDF report generation.
- Fees create/edit (view is read-only on mobile; recording payments stays a web task).

## Setup

```bash
cp .env.example .env.local
# fill in:
#   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — same Clerk project as the web app
#   EXPO_PUBLIC_API_URL               — the deployed backend URL (or your LAN IP for local dev)
npm install
npm start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with Expo Go
on a physical device. `npm run web` also works for quick browser-based smoke testing.

## Structure

- `app/` — file-based routing (Expo Router). `(auth)` = sign-in stack. `app/_layout.tsx`
  gates the tree on Clerk's `SignedIn`/`SignedOut` state, then on the resolved role via
  `lib/UserContext.tsx`. `app/index.tsx` redirects to `/student` or `/staff` once the role
  is known.
- `lib/api.ts` — thin fetch wrapper that attaches the Clerk token; `lib/useApiQuery.ts` is
  a small load/refresh/error hook used by most screens.
- `lib/UserContext.tsx` — fetches `/api/auth/me` once per session and exposes
  `{ role, profile, schoolName }` via context.
- `lib/types.ts` — response shapes, kept in sync with the equivalent web
  `src/app/student/**` and `src/app/dashboard/**` pages.
- `components/ui.tsx` — shared primitives (Card, Badge, EmptyState, StatTile, etc.) used by
  both role trees.

## Notes

- No backend changes were needed to support this app.
- `expo install` for compatibility checks may fail in network-restricted environments
  (it calls `reactnative.directory` / `api.expo.dev`); plain `npm install` works fine
  against the public npm registry.
