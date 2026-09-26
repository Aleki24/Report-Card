# Skulbase — School Operations Expansion Plan

**Goal:** give every person who runs a Kenyan school a portal built for their job:
the Director of Studies (DOS), heads of department, subject and class teachers,
students, parents, the bursar, matrons and patrons, the nurse, drivers and the
principal. **Each school turns on only the modules it needs.**

This plan starts from how the code works today (branch
`claude/school-mgmt-roles-features-ikcsqd`, after PR #198) and from research into
Kenyan school operations and competing products (see §12).

---

## 1. Where we are today

### 1.1 What already works

| Area | What exists |
|---|---|
| Academics | Exams (multi-paper, publish workflow), mark entry (offline queue, photo scan with AI), report cards, term comparison, analytics, CBC pathways and subject combinations |
| People | Students, teachers, parents as guardian fields, invite codes, bulk import |
| Attendance | Daily register, SMS to parents |
| Fees | Per-term balances, a payment ledger, M-Pesa STK and C2B, Pesapal, bank transfer, receipts, exports |
| Communication | Announcements, assignments, submissions, SMS (Africa's Talking), email (Resend) |
| Mobile | An Expo app with staff and student areas |

### 1.2 Problems the expansion must fix first

1. **Roles are one enum per user.** `users.role` is one of `ADMIN | CLASS_TEACHER |
   SUBJECT_TEACHER | STAFF | STUDENT | PENDING`. In a real school one person holds
   several duties: a chemistry teacher can also be DOS and a house patron. A
   bursar today is either given full `ADMIN` (too much access) or `STAFF` (no
   access). `job_title` is a label only and grants nothing (`src/lib/staff-roles.ts`).
2. **Access checks are hard-coded role strings.** About 190 checks like
   `role === 'ADMIN'` are spread across `src/`. Adding a DOS or bursar means
   touching every one of them unless we switch to permission checks.
3. **There is no per-school feature switch.** `src/lib/modules.ts` only describes
   the marketing pages. The sidebar (`navItems.tsx`) and the APIs cannot hide a
   module a school has not chosen.
4. **There is no parent login.** Fees, health, transport and boarding alerts all
   need a parent on the other end. Today parents exist only as fields on the
   student and receive SMS.
5. **Database access is untyped.** The Supabase clients have no generated
   `Database` type, so a column rename only breaks at runtime. With about 40 new
   tables coming, this has to change.

---

## 2. Design principles

1. **Modular by default.** A small Core is always on. Every other module can be
   switched on or off per school, and modules declare what they depend on.
2. **Duties grant permissions; code checks permissions.** Routes ask
   `can('fees.collect')`, never `role === 'ADMIN'`.
3. **One source of truth, fully typed.** Module keys, duty keys and permission
   keys are `as const` literal unions. Zod validates every API input. Supabase
   types are generated from the database.
4. **Mobile and low-bandwidth first.** Many users are on phones with unreliable
   connections: the matron at roll call, the driver, the nurse. Reuse the
   offline queue pattern from mark entry (`src/lib/offline-marks.ts`).
5. **Privacy by design.** Health, discipline and child location are *sensitive
   personal data* under Kenya's Data Protection Act, 2019. They get the narrowest
   access, an audit log, and parent consent where it applies.
6. **Responsive at every breakpoint.** Use the shared `DataTable` (card list below
   `md`) and `FilterBar`, and Tailwind tokens only, with no new inline styles.

---

## 3. Foundation: modules, duties, permissions (Phase 0, blocks everything else)

### 3.1 Module registry (typed, in code)

`src/lib/platform/modules.ts` (runtime registry; the marketing `modules.ts` will
read from it later so the two lists cannot drift apart):

```ts
export const MODULE_KEYS = [
  // Core: always on, cannot be disabled
  'core',
  // Academics
  'exams', 'report_cards', 'attendance', 'analytics', 'assignments',
  'timetable', 'exam_papers', 'lesson_records', 'cbc_assessment',
  // Finance
  'fees', 'online_payments', 'expenses',
  // Welfare
  'boarding', 'health', 'discipline',
  // Operations
  'transport', 'transport_tracking', 'library', 'inventory',
  // People and communication
  'parent_portal', 'sms', 'staff_hr',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ModuleDefinition {
  key: ModuleKey;
  name: string;
  category: 'core' | 'academics' | 'finance' | 'welfare' | 'operations' | 'people';
  description: string;
  /** Modules that must be on first (e.g. transport_tracking -> transport). */
  requires: readonly ModuleKey[];
  /** Duties that only make sense when this module is on. */
  duties: readonly DutyKey[];
  defaultEnabled: boolean;
}

export const MODULES = {
  timetable: { key: 'timetable', requires: ['core'], duties: ['DOS', 'TIMETABLER'], /* … */ },
  transport_tracking: { key: 'transport_tracking', requires: ['transport'], duties: ['DRIVER'], /* … */ },
  // …
} as const satisfies Record<ModuleKey, ModuleDefinition>;
```

`satisfies Record<ModuleKey, …>` makes the compiler reject a key that has no
definition, the same way the nav items became named constants.

### 3.2 Per-school state (database)

```sql
CREATE TABLE school_modules (
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
  module_key  TEXT NOT NULL,
  -- Platform owner: is this school allowed the module (plan/billing)?
  entitled    BOOLEAN NOT NULL DEFAULT true,
  -- School admin: did the school switch it on?
  enabled     BOOLEAN NOT NULL DEFAULT false,
  settings    JSONB   NOT NULL DEFAULT '{}',   -- per-module preferences, validated by Zod
  enabled_at  TIMESTAMPTZ,
  enabled_by  UUID REFERENCES users(id),
  PRIMARY KEY (school_id, module_key)
);
```

- **Two flags** separate *allowed by plan* (`entitled`) from *chosen by the school*
  (`enabled`). This supports future pricing tiers without another migration.
- `settings` holds module preferences (e.g. timetable: periods per day, break
  slots; boarding: roll-call times). Each module owns a Zod schema for it.
- Backfill: existing schools get every module that exists today enabled, so
  nothing disappears for live schools.

### 3.3 Duties and permissions (replacing the single role)

Keep `users.role` as the **login type** (`ADMIN | STAFF | TEACHER | STUDENT |
PARENT | PENDING`). Add **duties**, which are assignments that grant permissions
and can be scoped:

```sql
CREATE TABLE user_duties (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES users(id)   ON DELETE CASCADE NOT NULL,
  duty       TEXT NOT NULL,              -- a DutyKey; CHECK kept in sync by migration
  -- Optional scope: a department, a stream, a dorm, a vehicle, a route…
  scope_type TEXT CHECK (scope_type IN ('DEPARTMENT','STREAM','DORM','VEHICLE','ROUTE')),
  scope_id   UUID,
  starts_on  DATE, ends_on DATE,         -- e.g. a term's duty roster
  UNIQUE (school_id, user_id, duty, scope_type, scope_id)
);
```

Duties are `TEXT` with a CHECK constraint instead of a Postgres enum, because
`ALTER TYPE … ADD VALUE` cannot run inside a transaction. This is the same issue
the `STAFF` migration had to work around.

```ts
export const DUTIES = {
  PRINCIPAL:       ['*'],
  DEPUTY_ACADEMIC: ['academics.*', 'timetable.*', 'exam_papers.*'],
  DOS:             ['academics.*', 'timetable.*', 'exam_papers.*', 'lesson_records.review'],
  HOD:             ['exam_papers.moderate', 'lesson_records.review', 'academics.view'],   // scoped to DEPARTMENT
  CLASS_TEACHER:   ['attendance.mark', 'students.view', 'report_cards.comment'],        // scoped to STREAM
  SUBJECT_TEACHER: ['marks.enter', 'lesson_records.write', 'exam_papers.upload'],
  BURSAR:          ['fees.*', 'expenses.*', 'finance.reports'],
  ACCOUNTANT:      ['fees.view', 'expenses.*', 'finance.reports'],
  MATRON:          ['boarding.*'],                                                     // scoped to DORM
  PATRON:          ['boarding.view', 'boarding.rollcall', 'discipline.record'],        // scoped to DORM
  NURSE:           ['health.*'],
  TRANSPORT_MANAGER: ['transport.*'],
  DRIVER:          ['transport.trip.run'],                                             // scoped to VEHICLE
  LIBRARIAN:       ['library.*'],
  STOREKEEPER:     ['inventory.*'],
  DISCIPLINE_MASTER: ['discipline.*'],
} as const satisfies Record<string, readonly PermissionPattern[]>;
export type DutyKey = keyof typeof DUTIES;
```

### 3.4 One authorization helper, used by UI, API and database

```ts
// src/lib/auth/access.ts
export interface Access {
  userId: string; schoolId: string; loginRole: LoginRole;
  modules: ReadonlySet<ModuleKey>;
  can(p: Permission, scope?: { type: ScopeType; id: string }): boolean;
}
export async function requireAccess(p: Permission, scope?: Scope): Promise<Access>; // throws 403
export async function requireModule(m: ModuleKey): Promise<Access>;                 // throws 404 when off
```

- **API routes:** `await requireModule('health'); await requireAccess('health.visit.write')`.
  A module that is off returns **404**, not 403, so the feature does not exist
  for that school.
- **Navigation:** `NavItem` gains `module: ModuleKey` and `permission: Permission`
  in place of `roles: UserRole[]`. `getNavGroups(access)` filters by both, and
  `canAccessPath` uses the same rule.
- **Database:** add RLS helpers `has_module(school, key)` and
  `has_permission(user, perm)` (security definer, pinned `search_path`, as in
  `20260925120000_fix_rls_helpers…`).
- **Migration path:** replace the ~190 hard-coded checks module by module, with a
  lint rule (`no-restricted-syntax` on `role === '…'`) that only allows the
  existing sites until they are migrated.
- `getCaller()`'s class-teacher upgrade becomes simply "holds CLASS_TEACHER duty
  scoped to stream X".

### 3.5 Settings page: Modules tab

- Grouped cards (Academics / Finance / Welfare / Operations / People), each with
  a toggle, a one-line value statement, and "requires X" chips.
- Turning a module on walks the admin through a short setup (e.g. Transport: add
  a vehicle → a route → assign a driver). Reuse `SetupChecklist`.
- Turning a module off **hides** it but keeps its data. A confirmation dialog
  says so.
- **Onboarding** gets a step: "What does your school run?" with presets:
  *Day primary*, *Day secondary*, *Boarding secondary*, *Mixed day and boarding*,
  *Private academy with transport*.

### 3.6 Also in Phase 0

- `supabase gen types typescript` produces `src/types/database.ts`, and the
  clients become `createClient<Database>()`. Add a CI step that fails if the
  generated types are stale.
- `audit_log` table (who, what, entity, before/after JSON, IP) written by a
  single `audit()` helper. Required for fees, health and exam papers.
- `PARENT` login role linked through `student_guardians(student_id, user_id,
  relationship, is_primary)`. Every later module notifies parents through this.

---

## 4. Academics: DOS, HODs and teachers (Phase 1)

### 4.1 DOS / Deputy (Academics) portal

**Pain points we heard and read about:** timetables built by hand over days in
Excel; exam papers passed around on flash drives and WhatsApp (leaks); chasing
teachers for marks; no view of syllabus coverage; paper schemes of work and
records of work checked only when QASO or TSC visits.

| Feature | What it does |
|---|---|
| **Academic calendar** | Term dates (already exist), exam windows, CATs, mark-entry deadlines, report-release dates, all visible to every role |
| **Exam paper bank** (`exam_papers`) | Teacher uploads a paper and marking scheme → HOD moderates (comment, approve or return) → DOS locks and schedules print → released at exam time. Private Supabase bucket, 60-second signed URLs, **watermark with the viewer's name**, a full access log, and no student access until after the exam. Stores past papers for revision later. |
| **Printing queue** | Copies are computed from class sizes plus spares; status goes Pending → Printed → Packed per class |
| **Marks-entry control** | Deadline per exam; a live grid of teacher × subject × stream completion (extends `marking-progress.ts`); one-tap SMS or in-app nudge to late teachers |
| **Timetable generator** (§4.4) | Generate, edit, publish, handle substitutions |
| **Syllabus coverage** | From teachers' records of work: % covered per subject and stream compared with the term's plan, with a red flag when behind |
| **Teacher workload** | Lessons per week per teacher, compared with the school's target load |
| **Curriculum analytics** | Existing analytics plus subject trends, teacher-subject value added, and a "students at risk" list |
| **KEMIS / KNEC exports** | Learner list with UPI and assessment numbers, subject combinations, CSV in the layouts the portals expect |

### 4.2 HOD (department-scoped DOS)

A department view of the same tools: paper moderation, syllabus coverage for the
department's subjects, lesson-record review, and a department mean-score trend.

### 4.3 Subject teacher portal: "what makes my week easier"

| Feature | Why teachers want it |
|---|---|
| **Today** card: my lessons, room, the class's attendance, pending marking | Replaces the printed timetable and the staffroom notice board |
| **Schemes of work → lesson plans → records of work** | TSC TPAD and QASO ask for these. One chain: the scheme is generated from the syllabus (AI-assisted with Anthropic, which we already use for scanning), a lesson plan is one tap from a scheme week, and the record of work is a tick after the lesson that feeds syllabus coverage |
| **Lesson attendance** | Mark who was in *this* lesson, not just the morning register. Catches skipping |
| **CBC/CBE formative assessment** | Rubric entry (EE/ME/AE/BE) per strand and sub-strand on a phone grid; evidence photos; export for KNEC SBA |
| **Question bank and paper builder** | Reuse questions, generate CATs, upload to the paper bank |
| **Assignments** (exists) | Add real file upload in place of the current URL field |
| **My classes insights** | Per-stream mean, item analysis of the last exam, students who dropped |
| **TPAD evidence folder** | Auto-collects lesson records, results and attendance per appraisal period |
| **Leave and cover requests** | Request leave → DOS assigns cover → the timetable shows the substitution |

### 4.4 Timetable generator: technical design

**Inputs** (stored per school in `timetable_*` tables):

- Day structure: days, periods per day, period length, breaks and lunch,
  games afternoons, preps (boarding). Presets for 8-period secondary, primary,
  and junior school.
- Lessons per week per subject per grade (defaults from the curriculum, editable).
- Teacher ↔ subject ↔ stream allocation (already in `subject_teacher_assignments`).
- Rooms and labs with capacity and type.
- Teacher availability (part-time, days off) and per-day limits.

**Hard constraints:** no teacher, stream or room double-booked; weekly counts met;
science practicals as double periods in labs; fixed slots respected (assembly,
PPI, games, CRE combined classes); CBC elective groups scheduled in parallel
blocks across streams.

**Soft constraints (weighted, set from school preferences):** maths and sciences
in the morning; no subject twice a day; spread across the week; at most N
consecutive lessons per teacher; balanced teacher days; minimal free-period gaps.

**Algorithm:** a TypeScript constraint solver. Greedy placement ordered by the
most-constrained lesson first, then simulated annealing or tabu local search
on soft-constraint cost. It runs off the request thread (a background job
writing progress to a `timetable_runs` row, polled with the existing streaming
pattern). A typical school (≈ 30 streams × 45 slots) solves in seconds to a
minute. If larger schools need it, the solver moves behind the same interface to a
Python worker with OR-Tools CP-SAT.

**Editing:** drag-and-drop grid with live conflict highlighting; pin a lesson and
re-solve the rest; version history; publish (teachers and students see it on web
and mobile); printable PDFs per class, teacher and room.

**Substitutions:** when a teacher is absent, suggest cover ranked by free period,
subject match and weekly load, and notify the covering teacher.

### 4.5 Class teacher additions

Discipline notes, exeat and leave-out requests (to boarding), class clearance
at end of term, parent contact log, and printable class lists.

### 4.6 Students

My timetable, my assignments, past papers released by the DOS, and revision
resources. Results and fees already exist.

---

## 5. Finance: the bursar portal (Phase 2)

Current state: balances per term and a payment ledger with M-Pesa and Pesapal.
Missing: *where the fee figure comes from* and *where money goes*.

A bursar's records form a chain: **fee structure → invoice → payment →
allocation → receipt → statement → monthly report**. Each link must agree with
the next.

| Feature | Detail |
|---|---|
| **Bursar and accountant duties** | Finance without full admin rights (fixes the current "admin-only" workaround in PR #198) |
| **Fee structures with vote heads** | Per grade × boarder/day × term. Vote heads (tuition, boarding equipment and stores, maintenance and improvement, activity, medical, etc.) and the Ministry's **50:30:20** term split as a preset. Optional items: transport (from the route), lunch, uniform, trips |
| **Bulk invoicing** | Generate invoices for a term by class or category in one action; they replace the hand-typed `total_fee` |
| **Payment allocation** | Split each payment across vote heads (by priority or pro-rata) so vote-head books balance |
| **Statements** | Per student, any date range, PDF, and SMS or parent-portal delivery |
| **Reminders** | Scheduled balance SMS in bulk, filtered by amount or class |
| **Bursaries and waivers** | CDF, county and sponsor bursaries, sibling discounts; the sponsor pays against many students |
| **Capitation** | Record government capitation received per vote head |
| **Expenses and cash book** (`expenses`) | Suppliers, vouchers, approvals (bursar raises → principal approves), receipts, bank reconciliation |
| **Reports** | Collection summary, arrears ageing, vote-head statement, income and expenditure, trial balance export |
| **Fee clearance** | Optional rule: exam cards or report cards are released only when the balance is ≤ X, set by the school, with an override logged |

---

## 6. Boarding: matrons and patrons (Phase 4)

| Feature | Detail |
|---|---|
| **Houses, dorms, cubicles, beds** | Allocate learners, see occupancy, move students |
| **Roll call** | Morning, evening and night checks on a phone; works offline; absentees flagged to the patron and deputy |
| **Exeat, leave-out and gate pass** | Class teacher or parent requests → patron or deputy approves → gate checks a QR → parent gets an SMS on exit and return |
| **Visiting days** | Visitor register linked to learners |
| **Dorm inspections** | Checklist score per dorm per week; house competitions |
| **Boarding inventory** | Mattresses, lockers and linen issued to learners; cleared at end of year |
| **Incidents** | Recorded against learners, escalated to discipline |
| **Lost and found**, **laundry** schedules | Optional small tools |
| **Duty roster** | Teacher on duty and patron on night duty per week (`user_duties` with dates) |

## 7. Health: school nurse (Phase 4)

Health data is the most sensitive data in the system. Only NURSE and PRINCIPAL
can read clinical detail. Class teachers see only "in sick bay" or "excused". Every
read is audited.

| Feature | Detail |
|---|---|
| **Medical profile** | Allergies, chronic conditions (asthma, diabetes, sickle cell, epilepsy), blood group, SHA number, emergency contacts, consent forms |
| **Clinic visit log** | Complaint, vitals, diagnosis, treatment, outcome (back to class, sick bay, sent home, referred) |
| **Medication administration** | Scheduled doses for learners on long-term medication, with missed-dose alerts |
| **Sick bay** | Admit and discharge. Feeds attendance automatically (excused) |
| **Referral and parent SMS** | "Your child was taken to X hospital at 14:05", with the nurse's contact |
| **Immunisation and screening** | Campaigns and records |
| **Pharmacy stock** | Medicines with batch, expiry and reorder alerts |
| **Health trends** | Outbreak detection, e.g. 10 or more similar complaints in 48 hours → alert the principal |

## 8. Transport: vehicles, drivers and live tracking (Phase 5)

NTSA school-transport rules drive the requirements: licensed drivers and
attendants with annual criminal-record and medical checks, a seat per child,
80 km/h maximum, operation only between 5 a.m. and 10 p.m., and KEBS-approved
telematics.

### 8.1 `transport` module (fleet and compliance)

| Feature | Detail |
|---|---|
| **Vehicles** | Registration, capacity, insurance, inspection, speed-governor and telematics certificate expiry dates |
| **Drivers and attendants** | Licence class and expiry, PSV badge, good-conduct and medical dates |
| **Compliance alerts** | 30/14/3 days before any expiry, to the transport manager and principal. An expired item blocks trip start |
| **Routes and stops** | Ordered stops with pickup times; learners assigned to a stop; transport fee pulled into the fee structure |
| **Trip log** | Planned vs actual departure and arrival; odometer; fuel and maintenance log |
| **Boarding check-in** | The attendant taps learners on and off (or scans a card QR); a parent SMS says "boarded" or "dropped" |

### 8.2 `transport_tracking` module (live map)

- **Driver mode in the Expo app.** "Start trip" starts background location
  (`expo-location` + `expo-task-manager`). Positions are buffered offline and
  posted in batches every 15–30 seconds to `vehicle_positions` (trip_id, lat,
  lng, speed, heading, recorded_at).
- **Admin and principal live map.** MapLibre GL or Leaflet with free
  OpenStreetMap tiles. Updates arrive through **Supabase Realtime** on the trip
  channel. Each vehicle is colour-coded: on time, late, speeding, or stopped for
  more than N minutes.
- **Alerts.** Speed over 80 km/h, off-route (distance from the route polyline),
  unscheduled stop, trip not started on time, and trips outside 5 a.m.–10 p.m.
- **Parents** (with the parent portal): "Bus is 10 minutes from your stop". Only
  the trip their child is on is visible, and only while the trip is running.
- **Later:** ingest positions from the vehicle's KEBS-approved telematics
  provider through its API. Same `vehicle_positions` table, a different source.
- **Retention:** raw positions kept 90 days, trip summaries kept permanently.

---

## 9. Other modules (Phase 6, by demand)

| Module | Core features |
|---|---|
| **Parent portal** (web and app) | Multiple children under one login; results, fees and statements with pay-by-M-Pesa, attendance, timetable, transport ETA, exeat requests, messages. Most other modules notify through it |
| **Discipline** | Incident types, points, actions (warning, suspension), parent notification, a pattern report |
| **Library** | Catalogue (ISBN lookup), issue and return by barcode, overdue fines charged to the fee account, class book distribution (KLB etc.) |
| **Inventory and stores** | Assets register, stores issue (food, stationery), requisition → approval |
| **Staff HR** | BOM staff records, leave, duty rosters, TSC/TPAD appraisal support, optional payroll later |
| **Clubs and games** | Memberships, fixtures, results, co-curricular reports on report cards |
| **Admissions** | Online applications, interview scheduling, Grade 10 placement intake from KEMIS |

---

## 10. Principal / admin cockpit

One dashboard that adapts to the modules the school has turned on: today's
attendance, fees collected today and arrears, marks-entry completion, sick-bay
count, boarding absentees, vehicles on the road with live status, compliance
expiries, and an approvals inbox (expenses, exeats, papers, leave). Each tile
comes from the module's own `dashboardTile()` in the registry, so a module that
is off never shows a tile.

---

## 11. Roadmap

| Phase | Scope | Main tables | Size |
|---|---|---|---|
| **0 — Foundation** | Module registry + `school_modules` + Modules settings tab + onboarding presets; duties and permissions; `requireModule` / `requireAccess`; nav filtering; generated DB types; audit log; parent role and guardian links | `school_modules`, `user_duties`, `audit_log`, `student_guardians` | L (touches auth everywhere; migrate checks module by module) |
| **1 — Academics** | DOS and HOD duties, academic calendar, exam paper bank and printing, marks deadlines, timetable generator and substitutions, teacher Today view | `academic_events`, `exam_papers`, `exam_paper_reviews`, `exam_paper_access_log`, `rooms`, `timetable_*` | XL |
| **2 — Finance** | Bursar duty, fee structures with vote heads, bulk invoicing, allocation, statements, reminders, bursaries, expenses and cash book, reports | `fee_structures`, `fee_structure_items`, `vote_heads`, `invoices`, `invoice_lines`, `payment_allocations`, `bursaries`, `suppliers`, `expenses` | L |
| **3 — Teacher professional records** | Schemes, lesson plans, records of work, syllabus coverage, lesson attendance, CBC rubrics, question bank, TPAD folder | `schemes_of_work`, `lesson_plans`, `records_of_work`, `syllabus_topics`, `competency_assessments`, `questions` | L |
| **4 — Welfare** | Boarding (dorms, roll call, exeat, inventory) and Health (profiles, visits, sick bay, meds, stock) | `dorms`, `beds`, `roll_calls`, `exeats`, `medical_profiles`, `clinic_visits`, `medications`, `medicine_stock` | L |
| **5 — Transport** | Fleet and compliance, routes, trips, check-in; driver mode in the app, live map, alerts | `vehicles`, `drivers`, `compliance_documents`, `routes`, `route_stops`, `student_routes`, `trips`, `trip_events`, `vehicle_positions` | L |
| **6 — Parent portal and the rest** | Parent app, discipline, library, inventory, HR, clubs, admissions | — | by demand |

Each phase ships as its own PR series: migration → generated types → Zod schemas
→ API routes behind `requireModule` / `requireAccess` → pages (responsive,
shared UI kit) → mobile screens → the marketing page flips from coming-soon to
active.

### Definition of done for each module

- It can be switched on and off per school; when off, its pages, APIs and
  dashboard tiles are gone (404) and its data is kept.
- Every route validates input with Zod and checks a permission, not a role.
- RLS covers its tables (school isolation plus `has_module`).
- Layouts work at 360 px, `md`, `lg` and `xl`.
- Sensitive reads and every money movement are audit-logged.

---

## 12. Research notes and sources

- Zeraki, the most-used Kenyan system, sells Analytics (exams), Finance
  (receipting, expenses, balances by SMS) and Timetables as separate products.
  This supports selling modules individually.
  [zeraki.app](https://www.zeraki.app/), [Zeraki Finance](https://www.zeraki.app/zeraki-finance)
- Kenyan timetablers advertise 8-period days, double sciences, CBC presets, and
  substitution suggestions by subject match, free period and load.
  [Elimika TimeTabler](https://elimikasasa.co.ke/timetabler), [eBingwa](https://ebingwa.co.ke/timetable)
- Common pain points: timetables, duty rosters and cover managed in WhatsApp
  threads; manual report compilation; TSC/TPAD evidence; low bandwidth.
  [SchoolHub guide](https://schoolhub.tech/blog/school-management-system-kenya),
  [Zama: KCSE and TPAD integration](https://zama.co.ke/blog/school-management-systems/)
- Fees: the gazetted boarding caps, vote heads and the 50:30:20 term split; the
  bursar's seven-record chain.
  [Capital FM](https://www.capitalfm.co.ke/news/2025/12/kenya-fdse-zero-tuition-public-secondary/),
  [Bursar's guide](https://cbcedukenya.com/blog/school-fees-collection-kenya-fee-structures-invoices-receipts-bursars-guide-2026)
- KEMIS replaced NEMIS in January 2026 and uses the learner UPI. It holds school
  pathways, combinations and capacity for Grade 10 selection.
  [Education News](https://educationnews.co.ke/government-to-roll-out-kemis-on-january-9-2026-to-track-learners-nationwide/),
  [Techweez](https://techweez.com/2026/09/09/the-nemis-to-kemis-dilemma/)
- NTSA school transport rules: yellow FFD800, child seat belts, KEBS telematics,
  80 km/h, 5 a.m.–10 p.m., annual driver and attendant vetting and medicals.
  [The Standard](https://www.standardmedia.co.ke/national/article/2001545850/ntsa-tightens-school-transport-safety-rules-ahead-of-reopening),
  [Kenyans.co.ke](https://www.kenyans.co.ke/news/124552-ntsa-announces-strict-driver-requirements-school-transport)

---

## 13. Open decisions for the product owner

1. **Pricing:** one plan with every module, or tiers (Core / Academics+ /
   Complete) with add-ons such as Transport tracking and SMS bundles? The
   `entitled` flag supports either.
2. **Parent portal timing:** move it into Phase 2 alongside finance, since fees
   statements and M-Pesa payment are the strongest reason for parents to log in?
   *(Recommended.)*
3. **Live tracking source:** is driver phone GPS acceptable for launch, with
   telematics integration later? *(Recommended.)*
4. **Timetable solver:** build it ourselves in TypeScript (recommended: no new
   infrastructure) or integrate an existing timetabling product?
