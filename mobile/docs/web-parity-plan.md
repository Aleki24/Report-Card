# Mobile ↔ web parity plan

Audit of every web page (`src/app/**/page.tsx`) and every API endpoint the
web client calls, against the mobile app. An endpoint the web uses and the
app never calls marks a missing feature; pages were compared one by one.

## Already at parity

Every dashboard, student and parent page has a mobile screen: dashboard,
exams & marks, reports, attendance, analytics, calendar, timetable, exam
papers, professional records, CBC, people, parent accounts, classes,
subjects, fees, billing, expenses, boarding, health, discipline, transport,
library, inventory, leave, announcements, assignments, users, settings
(incl. payments, bank accounts and Safaricom URL registration), onboarding,
profile; student dashboard, results, subjects, timetable, fees (Pesapal,
polled instead of `/pesapal/callback`), attendance, profile; parent portal.
Sign-in, sign-up and activation were rebuilt on the web's AuthShell.

Web-only by design: the marketing site (`/features/*`, `/pricing`,
`/contact` page), `/logout`, `/register` (redirect), `/sso-callback`,
`/activate/callback|process` (the app finishes Google activation through
onboarding's join).

## Missing pages → new screens

| # | Web page | Mobile screen |
|---|----------|---------------|
| P1 | `/help`, `/help/[slug]`, `/dashboard/help`, `/student/help`, `/parent/help` | **Help & guides**: the same manuals (shared `src/lib/manual`), rendered natively with the web's screenshots, the reader's own guides first; plus **Contact support** (`/api/contact`). Reachable signed out and from every role's More/Profile. |
| P2 | `/forgot-password` | **Forgot password**: Clerk `reset_password_email_code` in the app (email → code → new password). |
| P3 | `/verify/[studentId]` | **Verify results**: what a report card's QR code shows, from `/api/verify/[id]`; opens from `skulbase://verify/<id>` and from sign-in. |
| P4 | `/dashboard/pending-schools` | **School requests** for the platform owner (`/api/platform/schools`), approve/reject links. |

## Missing features in existing screens

| # | Where | Feature (web component → endpoint) |
|---|-------|------------------------------------|
| F1 | Exams & Marks → Results | **All subjects** broadsheet for a stream (`AllSubjectsView` → `/api/school/exam-marks/stream`); median and learner count in the analysis. |
| F2 | Report Cards | **Term comparison** (`TermComparisonModal` → `/api/reports/term-comparison`); **report rounds** with how much is marked and the suggested sitting (`/api/reports/rounds`). |
| F3 | Teacher dashboard | **Marking progress**: marks to enter, exams fully marked, next exam to mark (`/api/school/teacher/marking`). |
| F4 | Admin dashboard | **Results by grade** card (`GradeResultsCard` → `/api/school/analytics`). |
| F5 | People | **Pathway** filter and **bulk pathway** assignment (`BulkPathwayModal` → `/api/admin/student-pathways`); **staff photo** upload (`/api/admin/upload-photo`). |
| F6 | Subjects | **Who takes it**: per-subject learner roster (`SubjectEnrollmentManager` → `/api/admin/student-subjects`). |
| F7 | Fees | **Unmatched payments** to reconcile (`/api/school/fees/unmatched`). |

## User friendliness and UI

- U1 Every list screen: pull to refresh, an icon empty state that says what
  to do next, section headers with the web's icon tiles.
- U2 Help is one tap away everywhere (More → Help & guides; sign-in footer).

Each item is verified with the type check and a headless web build (mocked
API), then committed; an EAS preview build follows the batch.
