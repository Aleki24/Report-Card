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
Clerk JWT claim — same reasoning as the web app's `auth-server.ts`), including a subject
teacher's switch to the class-teacher view, and routes to one of two tab trees. Each tree
mirrors the web's phone navigation: four curated tabs per role, everything else under
**More** (`lib/roles.ts` holds the same role lists as the web sidebar's `navItems.tsx`).

- **`/student`** — Dashboard (next-exam alert, trend, assignments with submission, notes,
  study goals), Results (filtered marks + report cards with PDF download), Subjects
  (+ detail), Fees (history, receipts, M-Pesa prompt / Pesapal checkout, bank details),
  Attendance (by month), Profile (phone editing).
- **`/staff`** — ADMIN, CLASS_TEACHER, SUBJECT_TEACHER and non-teaching STAFF:
  - Dashboard: the web's figures — marks outstanding, class performance weakest-first,
    pass rate, needs-attention list; role KPIs for teachers; a welcome for STAFF.
  - Exams & Marks: exam picker, roster mark entry (multi-paper, auto-grading from the
    school's own scales, drafts kept on the device), results with CSV/PDF export,
    release/withdraw with the readiness check; admins set up and create exams.
  - Report Cards: class cards, mark sheet and single-learner PDFs, comments, SMS results.
  - Attendance, Analytics (school → class), People (students, staff, parents), Fees
    (billing, payments, receipts, ledger, unmatched M-Pesa), Announcements, Assignments
    (+ submissions grading), Classes, Subjects (+ subject teachers), Users, Settings.

A screen is only reachable by the roles the web allows on the same page
(`components/RequireScreen.tsx`); the backend still enforces the finer rules. An account
with no role yet (`PENDING`) or a deactivated account gets a clear screen with sign-out.

## Web-only

- Account activation via invite code (`/activate`), school onboarding and the landing site.
- Bulk CSV/Excel student import and scanned mark sheets.
- Payment provider credentials (paybill keys, callback registration) — secrets belong on
  a trusted computer; the app shows the configured status and bank accounts.
- Editing grading-band boundaries and subject combinations (viewing works on mobile).

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
- `lib/api.ts` — fetch wrapper that attaches the Clerk token, plus authenticated file
  download → share sheet (PDF/XLSX from the server) and image upload.
  `lib/useApiQuery.ts` is the load/refresh/error hook used by every screen.
- `lib/roles.ts`, `lib/format.ts`, `lib/academics.ts`, `lib/useSchoolData.ts` — role/nav
  config, shared formatting, exam types/terms/grading helpers, and reference-data hooks.
- `lib/UserContext.tsx` — fetches `/api/auth/me` once per session and exposes
  `{ role, profile, schoolName }` via context.
- `lib/types.ts` — response shapes, kept in sync with the equivalent web
  `src/app/student/**` and `src/app/dashboard/**` pages.
- `components/ui.tsx` — shared primitives (Screen, Card, ListRow, Button, ChipSelect,
  SegmentedTabs, TextField, …) used by both role trees; feature components live in
  `components/{exams,fees,people,student}`.

## Notes

- No backend changes were needed; every screen uses the same routes as the web.
- `expo install` for compatibility checks may fail in network-restricted environments
  (it calls `reactnative.directory` / `api.expo.dev`); plain `npm install` works fine
  against the public npm registry.
