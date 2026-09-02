# Skulbase — System Design

> A multi-tenant school management platform for Kenyan schools, covering the
> full academic workflow: enrollment → academic structure → exams & marks →
> grading → report cards → attendance → fees → parent communication.

This document describes the system **as it is built today**. Every claim here is
drawn from the code in this repository; where the implementation diverges from
what the design ideally wants, that is called out in
[§13 Known gaps & risks](#13-known-gaps--risks).

---

## 1. Scope and design drivers

### 1.1 What the system does

| Domain | Capability |
| --- | --- |
| People | Students, teachers, staff, parents/guardians, user & role management |
| Academic structure | Academic levels, grades, streams, subjects, academic years, terms |
| Curriculum | CBC pathways & subject combinations, 8-4-4 / KCSE, per-school grading systems |
| Exams & marks | Exam creation, manual entry, multi-paper (P1/P2/P3) components, photo marksheet scanning, spreadsheet import/export, publish → approve workflow |
| Report cards | Server-side aggregation, four PDF layouts, QR-verifiable results, class marksheets |
| Attendance | Daily attendance with parent SMS notification |
| Fees | Fee records, payments ledger, M-Pesa (STK Push + C2B Paybill), Pesapal, bank transfer, receipting, reconciliation of unmatched payments |
| Communication | Announcements, assignments & submissions, learning materials, SMS |
| Analytics | School-, class-, subject- and student-level performance analysis |
| Platform | School sign-up with owner approval, invite-code onboarding, printable invite directories |

### 1.2 Design drivers

These constraints shape almost every decision below.

1. **Multi-tenant SaaS.** One deployment serves many schools. Cross-school data
   leakage is the single highest-severity failure mode.
2. **Unreliable connectivity.** Mark entry happens in classrooms and staffrooms
   on flaky networks. Losing an afternoon of typed marks is unacceptable →
   offline-first mark entry.
3. **Paper-first reality.** Marks often start life on a paper marksheet, and
   students are handed printed invite codes and printed report cards → photo
   scanning, PDF everything, QR verification.
4. **Kenyan payment and messaging rails.** Money arrives by M-Pesa Paybill,
   parents are reached by SMS. Each school brings *its own* Paybill and
   merchant account — there is no platform-wide till.
5. **Two curricula in parallel.** CBC (pathways, rubrics, competency bands) and
   8-4-4/KCSE (points, mean grade) coexist, sometimes in the same school →
   grading is data, not code.
6. **Type safety end-to-end.** TypeScript strict + Zod at trust boundaries; the
   database is the source of truth for shape, and typed helpers wrap it.

### 1.3 Explicit non-goals

- No timetabling / scheduling engine.
- No payroll or general ledger accounting — fees only.
- No offline-capable *native* app; the mobile client is an online API client.
- No real-time collaboration (no websockets/presence); the concurrency model is
  idempotent last-write-wins per `(student, exam)`.

---

## 2. Architecture at a glance

```
                       ┌───────────────────────────────────────────┐
                       │              Clients                      │
                       │                                           │
   Admin / Teacher ───▶│  Next.js App Router (React 19, RSC + CSR) │
   Student / Parent ──▶│  Expo / React Native (expo-router)        │
                       └──────────────────┬────────────────────────┘
                                          │ HTTPS
                                          │ Clerk session cookie (web)
                                          │ Clerk Bearer JWT (mobile)
                                          ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  Next.js application (Vercel serverless / Docker standalone)  │
        │                                                              │
        │  middleware.ts ── Clerk edge auth + safe redirects            │
        │                                                              │
        │  /api/**  route handlers  ── the entire backend               │
        │    auth-server.ts   role & tenant resolution (DB-backed)      │
        │    lib/*            domain logic: grading, analytics, fees,   │
        │                     pathways, multi-paper, imports, PDFs      │
        │    lib/pdf/*        @react-pdf report cards, marksheets,      │
        │                     receipts, invite-code booklets            │
        └───┬───────────┬──────────┬──────────┬──────────┬─────────────┘
            │           │          │          │          │
            ▼           ▼          ▼          ▼          ▼
        ┌────────┐ ┌────────┐ ┌─────────┐ ┌────────┐ ┌──────────────┐
        │Supabase│ │ Clerk  │ │Africa's │ │ Resend │ │ Anthropic    │
        │Postgres│ │ authN  │ │Talking  │ │ email  │ │ (vision scan)│
        │+Storage│ │+webhook│ │  SMS    │ │        │ │              │
        └────────┘ └────────┘ └─────────┘ └────────┘ └──────────────┘
                                   ▲
                                   │  webhooks / IPN callbacks
                          ┌────────┴─────────┐
                          │ Safaricom Daraja │
                          │ Pesapal API 3.0  │
                          └──────────────────┘
```

**The shape in one sentence:** a single Next.js application is both the web UI
and the only backend; it owns *all* authorization and tenancy logic, talks to
Postgres with a privileged service-role key, and integrates the local payment,
messaging and AI rails behind small typed adapter modules in `src/lib`.

---

## 3. Technology choices and why

| Layer | Choice | Rationale |
| --- | --- | --- |
| App framework | Next.js 16 App Router, React 19 | One deployable for UI + API; server components keep dashboard data fetching off the client; file-system routing maps cleanly onto the domain (`/api/school/...`, `/api/admin/...`) |
| Language | TypeScript 5 (strict), Zod 4 | Compile-time safety inside, runtime validation at the edges (`src/lib/schemas.ts`) |
| Database | Supabase Postgres | Relational integrity for a deeply relational academic domain; SQL migrations; Storage for photos; RPC for set-based aggregation |
| Auth | Clerk (`@clerk/nextjs`, `@clerk/clerk-expo`) | Hosted identity, OAuth, session management, one token format shared by web and mobile |
| Styling | Tailwind CSS v4 + shadcn-style primitives (`components.json`, `@base-ui/react`) | Utility-first, responsive by default, no bespoke CSS drift |
| PDF | `@react-pdf/renderer` | Same component model as the UI; layouts are React, so report card designs are versioned, diffable and reusable server- *and* client-side |
| Charts | Recharts | Declarative, responsive analytics widgets |
| SMS | Africa's Talking | The practical Kenyan bulk-SMS rail |
| Payments | Safaricom Daraja + Pesapal | STK Push for pull payments, Paybill C2B for push payments, Pesapal for card/hosted checkout |
| Email | Resend | Transactional mail (approval requests, receipts) |
| Vision | Anthropic API | Marksheet photo → structured rows |
| Mobile | Expo + expo-router + RN 0.86 | Shares the exact same HTTP API; no separate backend |

---

## 4. Multi-tenancy model

**The tenant is a school.** `schools.id` is the tenancy key, and almost every
row reaches it either directly (`school_id` column) or through `users.school_id`.

### 4.1 How isolation is enforced

Isolation is enforced in **three layers**, of which layer 2 is the one that
actually runs on every request:

1. **Edge (`src/middleware.ts`).** Clerk middleware. Authentication only — it
   deliberately performs *no* role-based routing, because the JWT `role` claim
   can lag the database (see §5.2).
2. **Application (every route handler).** The route resolves the caller's
   `school_id` and `role` from the `users` table, then constrains every query
   with it. This is the real boundary.
3. **Database (RLS).** 26 tables have RLS enabled with 37 policies, keyed off a
   `get_my_role()` helper and `auth.uid()`.

```ts
// The canonical shape of every protected route (src/lib/auth-server.ts)
const session = await requireAdmin();          // or requireAuth()
const supabase = createSupabaseAdmin();        // service-role client
const { data } = await supabase
  .from('grade_streams')
  .select('...')
  .eq('school_id', session.schoolId);          // ← the tenancy constraint
```

### 4.2 The important caveat

`createSupabaseAdmin()` uses `SUPABASE_SERVICE_ROLE_KEY`, which **bypasses RLS
entirely**. Because effectively all API routes use it, layer 3 is *defence in
depth for direct database access*, not the live guard. Two consequences follow:

- Tenant scoping is only as good as the `.eq('school_id', …)` (or the explicit
  ownership check) in each handler. Every new route must add it by hand.
- Inside the service-role connection `auth.uid()` and `get_my_role()` are null,
  so `SECURITY DEFINER` functions cannot self-authorize. This is why
  `/api/school/generate-reports` re-implements the class-teacher check in
  TypeScript before calling `generate_term_reports` — its own internal guard is
  inert under the service-role client.

Later migrations (`20260722163736_tenant_scope_payment_rls.sql`) tighten RLS to
be genuinely tenant-scoped for the payment tables; the older "public read for
any authenticated user" policies on core academic tables remain the weakest
link if the anon key is ever used for direct reads.

---

## 5. Identity, roles and onboarding

### 5.1 Roles

`user_role` enum: `ADMIN`, `CLASS_TEACHER`, `SUBJECT_TEACHER`, `STUDENT`,
`PENDING` — with a `STAFF` role and `job_title` added later
(`20260724070000_add_staff_role_and_job_title.sql`) for non-teaching staff.

`PENDING` is load-bearing: it is the role every route already refuses, so an
unapproved school is unusable **without a single per-route gate to maintain**.

### 5.2 The authorization rule that matters

```ts
// src/lib/auth-server.ts
const dbUser = await getUserDbRecord(clerkAuth.userId);
if (!dbUser || dbUser.is_active === false || !dbUser.role) return null;
```

Authorization is driven **entirely by the database row, never by Clerk session
claims**. Claims are client-influenceable and can be stale; a missing or
deactivated row is unauthorized, full stop. This closes the hole where a
deleted admin's still-valid Clerk session would otherwise remain fully
authorized until token expiry.

### 5.3 School sign-up approval flow

```
requester signs up
      │
      ▼
school row created with approval_status = 'PENDING_APPROVAL'
requester keeps role = 'PENDING'            ← system is unusable in this state
      │
      ├──▶ Resend email to platform owner: details + single-use Approve/Reject links
      └──▶ Africa's Talking SMS nudge (token too long to text)
      │
      ▼
GET /api/platform/schools/[schoolId]/decision?token=…
      │
      ▼
approval_status = 'APPROVED'  →  requester promoted to ADMIN
```

Notification failure never lets a sign-up through — the school stays locked and
the failure is logged. Owner contacts default in `src/lib/school-approval.ts`
and are overridable by `PLATFORM_OWNER_EMAIL` / `PLATFORM_OWNER_PHONE`.

### 5.4 Invite-code activation

Admins create users; the system mints a **6-character invite code**
(`src/lib/invite-codes.ts`) from a confusion-free alphabet (`0/O`, `1/I/L`
excluded) using **rejection sampling to remove modulo bias**, retrying on unique
violations. Codes carry `role`, `school_id`, `expires_at` (30 days default).

- `POST /api/auth/activate` — unauthenticated, therefore **IP rate-limited to
  10 requests/minute** to blunt code guessing. Verifies the code, creates the
  Clerk user, marks the code used.
- `GET /api/admin/invite-codes/pdf` — admin-only, school-scoped. Produces a
  combined PDF (one page per category) or a ZIP of per-category PDFs, filtered
  to active or all codes, so codes can be handed out physically.

### 5.5 Clerk → database sync

`POST /api/webhooks/clerk` verifies Svix signatures (`svix-id`,
`svix-timestamp`, `svix-signature`) against `CLERK_WEBHOOK_SECRET` before
processing `user.created` / `user.updated` / `user.deleted`, mirroring identity
into the `users` table. Verification failure returns 400 — unsigned payloads
never reach the database.

---

## 6. Data model

### 6.1 Core entities

```
schools ──┬── users ──┬── students ── student_subjects ── subjects
          │           ├── class_teachers ── grade_streams
          │           └── subject_teacher_assignments
          │
          ├── academic_levels ── grades ── grade_streams
          ├── academic_years ── terms
          ├── subjects ── subject_combinations ── subject_combination_subjects
          ├── grading_systems ── grading_scales
          └── exams ── exam_marks ── exam_mark_components
                   └── exam_subject_component_schemes ── exam_subject_components

report_cards ── report_card_subjects
student_fees ── fee_payments        school_payment_settings, school_bank_accounts
daily_attendance ── attendance_notifications
announcements, assignments, assignment_submissions, learning_materials
invite_codes, pending_invites, student_goals, performance_history
```

### 6.2 Notable modelling decisions

**Grading is data, not code.** `grading_systems` carries a `system_kind`:

- `SUBJECT` — `min_percentage`/`max_percentage` are percentage bands producing a
  grade symbol and the points that grade is worth.
- `OVERALL` — the same columns hold **total-points** bounds; the summed 8-4-4
  points of a student's best subjects are looked up to produce the mean/overall
  grade.

`src/lib/analytics.ts` then resolves grades through the school's own scales
(`getGradeFromScales`, `getGradeFromPointsScales`, `overallKindFromScales`)
rather than hardcoding a national table. A school that invents its own banding
is a data change, not a deploy.

**Multi-paper subjects are first-class.** English P1/P2/P3 is not a hack:
`exam_subject_component_schemes` → `exam_subject_components` →
`exam_mark_components` model per-paper scores, and the aggregate lands in
`exam_marks`. Component upserts key on `(component_id, student_id)`.

**Exams carry a publish workflow.**
`exams.status ∈ {DRAFT, PENDING_APPROVAL, APPROVED}` with `published_by/at` and
`approved_by/at`. Report cards and result exports gate on `APPROVED`, so a
teacher mid-entry cannot leak provisional marks to parents.

**CBC pathways.** `cbc_pathway ∈ {STEM, SOCIAL_SCIENCES, ARTS_SPORTS}` with
`subject_combinations` and `student_subjects`; `src/lib/pathway/` keeps a
student's subject list in sync with their chosen combination and ranks
combinations.

**Marks are idempotently upserted** on `(student_id, exam_id)` — this is the
property that makes the offline sync queue in §8.2 safe to replay.

---

## 7. API design

The API is entirely Next.js route handlers under `src/app/api`, organised by
audience rather than by table:

| Prefix | Audience | Guard |
| --- | --- | --- |
| `/api/auth/*` | Public / self | Rate-limited where unauthenticated |
| `/api/admin/*` | School admins | `requireAdmin()` — ADMIN + a school |
| `/api/school/*` | Any authenticated staff/student | `requireAuth()` + per-route role check + school scoping |
| `/api/reports/*` | Staff | Role check + stream/class ownership |
| `/api/platform/*` | Platform owner | Single-use approval token |
| `/api/mpesa/*`, `/api/pesapal/*` | Payment gateways | Secret URL token / provider verification |
| `/api/webhooks/clerk` | Clerk | Svix signature |
| `/api/verify/[studentId]` | Public | Opaque expanded ID from a report-card QR |

Conventions: JSON in/out; `NextResponse.json({ error })` with 400/401/403/404/429/500;
Zod schemas at the boundary; `src/lib/api-errors.ts` for internal-error shaping
so stack traces never reach a client.

**One backend, two clients.** `mobile/lib/api.ts` sends the Clerk token as
`Authorization: Bearer …`; `auth()` from `@clerk/nextjs/server` reads either a
cookie or a bearer token, so the mobile app required *zero* API changes.

---

## 8. Key subsystem designs

### 8.1 Marks entry — three input paths, one write path

```
   Manual typing         Photo of a marksheet        Excel/CSV upload
        │                        │                          │
        │                POST /exam-marks/scan       lib/import/parse-tabular-file
        │                 (Claude vision →                   │
        │                  structured rows,                  │
        │                  per-row confidence)               │
        │                        │                          │
        └────────────┬───────────┴──────────────────────────┘
                     ▼
        Teacher reviews & confirms every row in the UI
                     ▼
        POST /api/school/exam-marks   ── upsert on (student_id, exam_id)
                                      ── components upsert on (component_id, student_id)
```

The scanning endpoint enforces a strict extraction JSON schema (`row`,
`student_name`, `admission_number`, `score`, `confidence`, plus
`sheet_readable` and `notes`), an allow-list of media types, and a ~10 MB
base64 cap. **Extraction never writes marks** — matching against the roster and
saving both happen through the normal reviewed flow. This is the correct trust
boundary for an OCR/vision step: the model proposes, a teacher disposes.

### 8.2 Offline-first mark entry

Entirely client-side (`src/lib/offline-marks.ts`, `localStorage`), no schema
change:

| Mechanism | Key | Behaviour |
| --- | --- | --- |
| Drafts | `skulbase:mark-draft:v1:<examId>` | Every row, including per-paper scores, autosaved as typed; restored on reload |
| Sync queue | `skulbase:mark-sync-queue:v1` | "Save All" batches that could not reach the server are queued and flushed automatically when the browser comes back online |

Namespacing by exam lets several exams be entered side by side. Replaying a
queued batch is always safe because the write is an idempotent upsert. The UI
surfaces an Online/Offline badge, the pending-batch count, and the last local
save time — the user can always see whether their work is safe.

### 8.3 Report card generation

```
POST /api/school/generate-reports          (ADMIN, or the stream's CLASS_TEACHER)
   │  ├─ verify stream belongs to caller's school
   │  └─ verify class-teacher assignment  ← done in TS; the RPC's own guard is
   │                                         inert under the service-role client
   ▼
RPC generate_term_reports(year, term, stream)   ── one set-based SQL statement
   ├─ upsert report_cards for every ACTIVE student in the stream
   ├─ delete stale report_card_subjects
   └─ insert per-subject aggregates:
        SUM(raw_score), SUM(max_score), percentage
   ▼
Rendering: src/lib/pdf/*  (@react-pdf/renderer)
   ├─ ReportCardLayout / …Minimal / …Modern / …Progress   ← four selectable designs
   ├─ grading context resolved per school (lib/reports/grading-context.ts)
   ├─ exam round selection (lib/reports/exam-round.ts)
   └─ comparatives: class rank, stream mean, subject means (lib/reports/comparatives.ts)
   ▼
QR code → /verify/[studentId] → public, read-only result verification
```

Aggregation is deliberately **pushed into Postgres**: one round trip regenerates
an entire stream's report cards, instead of N queries per student.

Fonts are a real deployment concern and are handled explicitly: report cards are
typeset in Merriweather + Syne read off disk at render time, so
`next.config.ts` uses `outputFileTracingIncludes` to trace the `.ttf` files and
logo into the serverless bundle — nothing imports them, so Next cannot infer the
dependency. `serverExternalPackages` keeps the `@react-pdf/*` native-ish
packages out of the bundler.

### 8.4 Fees and payments

Each school supplies **its own** credentials — there is no platform-wide
merchant account.

```
Pull payment (STK Push)                    Push payment (Paybill C2B)
POST /api/mpesa/stkpush                    parent pays the school's Paybill
   → Daraja OAuth → STK Push                          │
   → parent's phone prompts                           ▼
   → callback:                              /api/mpesa/c2b/confirmation/[schoolId]/[token]
   /api/mpesa/stkpush/callback/[schoolId]/[token]
                     │                                │
                     └────────────┬───────────────────┘
                                  ▼
                       fee_payments ledger row
                                  ▼
                match account_reference → student_fees
                     ├─ matched   → applied, receipt available
                     └─ unmatched → /api/school/fees/unmatched
                                    admin assigns it to a student

Hosted checkout                            Bank transfer
POST /api/pesapal/checkout → redirect_url  school_bank_accounts
   → IPN: /api/pesapal/ipn/[schoolId]/[token]  → manual capture
   → browser returns to /pesapal/callback
```

Two security decisions carry this subsystem:

1. **Secret webhook URLs.** Safaricom does not sign its callbacks, so the URL
   itself carries the secret: `generateWebhookToken()` mints 24 random bytes as
   an unguessable path segment per school. *A callback arriving without the
   right token is a forgery.*
2. **Encrypted credentials at rest.** `src/lib/crypto.ts` encrypts consumer
   secrets and the Daraja passkey with **AES-256-GCM**, versioned
   (`v1:iv:tag:ciphertext`), keyed by `PAYMENT_SECRETS_ENCRYPTION_KEY` which
   lives only in the server environment. Reading the row — via the Supabase
   dashboard, a backup, or even a leaked service-role key — does not hand over
   usable credentials.

Phone numbers are normalized to Kenyan E.164 before every gateway call
(`normalizeMpesaPhone`) and before every SMS (`normalizeKenyanPhone`, which also
strips spreadsheet artifacts like a leading apostrophe on `'0712…`).

### 8.5 Attendance and SMS

`daily_attendance` records per-student status; `POST /api/school/attendance/notify`
sends guardians an SMS and records the send in `attendance_notifications` so a
parent is not texted twice for the same absence. Without `AT_API_KEY`, SMS is
disabled rather than failing the request — messaging is a best-effort side
channel, never a transaction blocker. The same principle governs approval
notifications (§5.3).

### 8.6 Analytics

`src/lib/analytics.ts` is a pure, dependency-free calculation module —
percentages, grades from scales, points, GPA, per-student aggregation, class
ranks. Being pure makes it reusable across the dashboard, the report-card
renderer, the marksheet and the public `/verify` endpoint, and makes it the one
part of the domain that is trivially unit-testable.

---

## 9. Frontend architecture

```
src/app/
  page.tsx, features/*, pricing, contact   ← public marketing surface
  login, signup, activate, sso-callback    ← auth funnel (Clerk components)
  dashboard/*                              ← staff/admin app (22 sections)
  student/*                                ← student portal
  verify/[studentId]                       ← public result verification
src/components/
  ui/          ← shadcn-style primitives (the design system)
  layout/      ← shell, sidebar
  modules/, dashboard/, exams-marks/, marks/, reports/, charts/, settings/, users/, student/
src/hooks/     ← useSettingsPage, useUsersPage (page-level state extraction)
src/lib/       ← domain logic, shared by server routes and client components
```

Conventions:

- **Server components fetch; client components interact.** Data loading lives in
  RSC/route handlers; `'use client'` is confined to interactive surfaces.
- **Tailwind v4 utilities, no ad-hoc CSS.** `cn()` (`clsx` + `tailwind-merge`)
  composes variants; `class-variance-authority` types component variants so an
  invalid variant is a compile error.
- **Responsive by construction.** Mobile-first utility stacks, breakpoint
  prefixes on layout containers, `next-themes` for dark mode.
- **DRY through `src/lib`.** Grading, abbreviations
  (`subject-abbreviations.ts`), subject definitions, exam types and term
  calendars are single sources of truth shared by UI, API and PDF renderers —
  which is exactly why the Zod `ExamType` is derived from `ALL_EXAM_TYPES`
  rather than re-listing codes.

---

## 10. Mobile client

`mobile/` is an Expo app (expo-router, RN 0.86, React 19) with two route
groups — `staff/` and `student/` — mirroring the web portals. It holds:

- `@clerk/clerk-expo` with `expo-secure-store` token caching,
- `lib/api.ts` — a typed `useApi()` wrapper (`get/post/patch/del`) with an
  `ApiError` carrying the HTTP status,
- `lib/theme.ts` — design tokens mirroring the web palette,
- `lib/types.ts` — response shapes mirroring the web pages' contracts.

It is a **pure client of the same API**. No mobile-specific backend, no
divergent auth path.

---

## 11. Cross-cutting concerns

| Concern | Implementation |
| --- | --- |
| Type safety | TS strict; Zod schemas at every untrusted boundary; enums derived from single sources of truth; `ExamMarkWithDetails`, `ServerSession` and friends typed rather than `any` at the seams |
| Validation | `src/lib/schemas.ts` — academic year, term, level, student, exam, marks |
| Error handling | `src/lib/api-errors.ts`; `dashboard/error.tsx` + `loading.tsx` route boundaries; `sonner` toasts client-side |
| Rate limiting | `src/lib/rate-limit.ts` — in-memory sliding window with periodic cleanup, applied to unauthenticated endpoints |
| Secrets | All in env; payment credentials additionally encrypted at rest; service-role key strictly server-only (`supabase-admin.ts` documents "NEVER import this in client components") |
| Idempotency | Marks upsert on natural keys; invite codes single-use; approval tokens single-use |
| Auditability | `generated_by_user_id`, `published_by/at`, `approved_by/at`, `fee_payments` as an append-only ledger, `attendance_notifications` as a send log |

---

## 12. Deployment

| Aspect | Detail |
| --- | --- |
| Primary target | Vercel (serverless functions per route) |
| Alternative | `Dockerfile` — multi-stage node:20-alpine, `output: 'standalone'` behind `DOCKER_BUILD=1`, runs as non-root `nextjs:nodejs`, plus `docker-compose.yml` |
| Database | Supabase managed Postgres; `supabase/migrations/*.sql` is the schema history; `supabase_schema.sql` + `supabase_seed.sql` bootstrap a fresh instance |
| CI | `.github/workflows/ci.yml` — `npm ci --ignore-scripts` → `tsc --noEmit` → `eslint` (non-blocking) → `next build`, with placeholder env values so no real service is contacted |
| Config | Environment variables documented in `README.md` |

**Scaling profile.** The workload is read-heavy with bursty writes at end of
term. The horizontal tier is stateless (Vercel scales it automatically); the
bottleneck is Postgres, and the mitigations already in place are set-based
aggregation via RPC, indexed tenant/status columns, and pushing report-card
rendering to a per-request PDF stream rather than materialising files.

---

## 13. Known gaps & risks

Listed by severity, with the fix each implies.

1. **RLS is not the live guard.** Service-role usage in essentially every route
   means one forgotten `.eq('school_id', …)` is a cross-tenant leak with no
   second line of defence. *Fix:* a shared query helper that takes the session
   and injects the scope, so scoping cannot be forgotten; and/or route reads
   through an RLS-respecting client carrying the user's JWT, reserving
   service-role for genuinely privileged writes.
2. **Legacy RLS policies are tenant-blind.** Several core academic tables still
   carry `USING (auth.role() = 'authenticated')` — any authenticated user of
   *any* school would read them if the anon key were used directly. *Fix:*
   extend the `tenant_scope_payment_rls` treatment to `students`, `exams`,
   `exam_marks`, `users` and the structure tables.
3. **In-memory rate limiting does not survive serverless.** `rate-limit.ts`
   keeps a per-instance `Map`, so on Vercel the effective limit is
   *per warm instance*, not global — the invite-code brute-force guard is
   weaker than it reads. *Fix:* a shared store (Upstash Redis, or a Postgres
   counter table).
4. **`PAYMENT_SECRETS_ENCRYPTION_KEY` is undocumented in the README env table**
   despite being required for any payment configuration to work. *Fix:* add it,
   with the `openssl rand -hex 32` instruction the code's error message already
   gives.
5. **`generate_term_reports` records a null author** under the service-role
   client, because `auth.uid()` is null there — `generated_by_user_id` and the
   RPC's internal authorization are both inert. *Fix:* pass the caller id as an
   explicit parameter.
6. **No automated test suite.** CI typechecks, lints and builds, but nothing
   asserts behaviour. The highest-value first targets are the pure modules:
   `analytics.ts`, `offline-marks.ts`, `crypto.ts`, `invite-codes.ts`, and phone
   normalization — all dependency-free and all correctness-critical.
7. **Payment callbacks are only partially authenticated.** The secret-URL scheme
   is the right call for unsigned Daraja callbacks, but it should be paired with
   replay protection (store and reject duplicate `TransID`) and a
   status-lookup confirmation before crediting a fee.
8. **Cross-instance offline queue.** Drafts are per-browser `localStorage`; a
   teacher who types marks on one device and opens another sees nothing. This is
   an accepted trade-off today; a server-side draft table would remove it.

---

## 14. Evolution roadmap

**Near term (hardening).** Items 1–5 above; a shared tenant-scoped query
helper; unit tests on the pure domain modules; replay protection on payment
webhooks.

**Medium term (capability).** Server-side mark drafts to make offline entry
device-independent; background jobs for bulk PDF generation and bulk SMS
(currently in-request); a per-school audit log table; parent accounts as
first-class users rather than phone numbers on a student row.

**Longer term (scale).** Read replicas or materialised views for analytics;
caching of grading contexts and school settings; queue-backed SMS with delivery
receipts reconciled from Africa's Talking; extraction of report-card rendering
into its own service if PDF volume outgrows request timeouts.
