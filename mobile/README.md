# Report Card — Mobile (Expo)

Mobile app for the Report Card school-management system, covering every role: students,
parents, subject teachers, class teachers, non-teaching staff, and admins. It matches the web
feature for feature. Talks directly to the same Next.js backend
as the web app (`../src/app/api/**`) — no separate mobile API, no separate database. Auth
is the same Clerk project as the web app; a Clerk session token is sent as
`Authorization: Bearer <token>` on every request, which the backend already accepts
(`clerkMiddleware`'s route matcher covers `/api/**`, and `auth()` reads either a Bearer
token or the web session cookie).

## Roles & routing

After sign-in, `GET /api/auth/me` resolves the account's real role (not the possibly-stale
Clerk JWT claim — same reasoning as the web app's `auth-server.ts`), including a subject
teacher's switch to the class-teacher view, and routes to one of three tab trees. Each tree
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
    (+ submissions grading), Classes, Subjects (+ subject teachers, combinations, senior
    placement), Users, Settings (modules, duties, payment providers and bank accounts,
    grading systems).
  - School operations, each shown only when the school runs the module and the person's
    role or duty allows it: Calendar, Exam papers, Timetable, Lesson records (schemes,
    plans, records of work), CBC assessment, Library, Inventory, Staff leave, Discipline,
    Health, Boarding (+ roll call), Expenses, Billing, Transport (fleet, routes, riders,
    live map, driver mode with GPS sharing), Parent accounts.
  - Exams also take scanned mark sheets (camera or photo) and CSV/Excel fill; People
    takes bulk CSV/Excel student import.
- **`/parent`** — each linked child's overview: results, attendance, fees, and profile.

Accounts with no school yet get the web's onboarding (`components/Onboarding.tsx`): set
up a school in five steps (sent for approval), or join one with an invite code; the
waiting and not-approved states come from `/api/school/approval-status`. Invite links
open `(auth)/activate`.

A screen is only reachable when the web would show the same page
(`PAGE_ACCESS` / `canViewPage` from `src/lib/platform/pages.ts`, via
`components/RequireScreen.tsx`); the backend still enforces the finer rules.

## Shared code with the web

`@shared/*` resolves to `../src/lib/*` (a custom resolver in `metro.config.js`, and
`paths` in `tsconfig.json`). Form fields, row types, workflow rules, payload builders and
page access live there once and both apps use them, for example `src/lib/ops/forms/*`,
`src/lib/onboarding/plan.ts`, `src/lib/marks/scan-match.ts` and
`src/lib/payments/settings.ts`. Files under `src/lib` that the app imports must use
relative imports only (no `@/`), and must not pull in server-only code.

Native modules added for parity: `expo-location` (driver GPS), `expo-keep-awake`,
`react-native-webview` (live map), `expo-image-picker` (mark-sheet photos), plus `zod`,
`xlsx` and `papaparse` for the shared validation and file parsing. The app asks for
location and camera/photo permissions only when those features are used.

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

## Building with EAS

`eas.json` has two profiles:

- `preview` — an installable Android `.apk` and an internal iOS build, for testing on phones.
- `production` — store builds (`.aab` for Google Play, App Store for iOS), with the build
  number raised automatically.

EAS uploads the whole repository, so the shared `../src/lib` code is included.
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL` must be set as EAS environment
variables for the `preview` and `production` environments (expo.dev → project →
Environment variables), because `.env.local` is not uploaded.

```bash
npx eas-cli login              # or set EXPO_TOKEN
npx eas-cli init               # first time only: links the project (adds projectId to app.json)
npx eas-cli build -p android --profile preview
npx eas-cli build -p all --profile production
```

## Structure

- `app/` — file-based routing (Expo Router). `(auth)` = sign-in stack. `app/_layout.tsx`
  gates the tree on Clerk's `SignedIn`/`SignedOut` state, then on the resolved role via
  `lib/UserContext.tsx`. `app/index.tsx` redirects to `/student` or `/staff` once the role
  is known (`/parent` for parents).
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

- Every screen uses the same API routes as the web; there is no mobile-only backend.
- Run `npx expo export --platform web` to check that the shared `@shared` imports bundle.
- `expo install` for compatibility checks may fail in network-restricted environments
  (it calls `reactnative.directory` / `api.expo.dev`); plain `npm install` works fine
  against the public npm registry.
