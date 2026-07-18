# Report Card — Mobile (Expo)

Student-portal mobile app for the Report Card school-management system. Talks directly
to the same Next.js backend as the web app (`../src/app/api/**`) — no separate mobile API,
no separate database. Auth is the same Clerk project as the web app; a Clerk session
token is sent as `Authorization: Bearer <token>` on every request, which the backend
already accepts (`clerkMiddleware`'s route matcher covers `/api/**`, and `auth()` reads
either a Bearer token or the web session cookie).

## Scope (v1)

Student-facing screens only, mirroring `src/app/student/**` on the web:

- Dashboard, Results (marks + report cards), Subjects (+ detail), Attendance, Fees, Profile

Sign-in only (email/password + Google) for existing accounts. New-account activation via
invite code (`/activate` on web) is intentionally **not** replicated here — it's a one-time
setup step; new students activate on the web first, then use this app day-to-day.

Admin/teacher screens are out of scope for v1 (much larger API surface — bulk imports,
exam mark entry, report generation).

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

- `app/` — file-based routing (Expo Router). `(auth)` = sign-in stack, `(tabs)` = the
  authenticated student tab bar. `app/_layout.tsx` gates the whole tree on Clerk's
  `SignedIn`/`SignedOut` state.
- `lib/api.ts` — thin fetch wrapper that attaches the Clerk token; `lib/useApiQuery.ts` is
  a small load/refresh/error hook used by most screens.
- `lib/types.ts` — response shapes, kept in sync with the web app's `student/**/page.tsx`.
- `components/ui.tsx` — shared primitives (Card, Badge, EmptyState, StatTile, etc.).

## Notes

- No backend changes were needed to support this app.
- `expo install` for compatibility checks may fail in network-restricted environments
  (it calls `reactnative.directory` / `api.expo.dev`); plain `npm install` works fine
  against the public npm registry.
