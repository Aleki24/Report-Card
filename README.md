# Skulbase

Skulbase is a modern school/student management system for schools —
covering the full academic workflow from enrollment to exams, attendance,
fees, and results delivery, with SMS notifications keeping parents in the
loop.

## Modules

Every school turns on only what it runs (**Settings → Modules**, with presets
such as *Day secondary* or *Boarding secondary*). Modules that existed before
the registry stay on by default; the rest start off. A module that is off
disappears from menus and dashboards, its API answers 404, and its data is
kept.

**Always available** — people and user management, classes and subjects,
announcements, settings.

| Area | Modules |
| --- | --- |
| Academics | Exams & Marks (with photo scanning), Report Cards, Attendance, Analytics, Assignments, School Calendar, **Exam Paper Bank** (moderation, printing, watermarked downloads), **Timetable** (generator, publishing, lesson cover), **Professional Records** (schemes of work with AI drafting, lesson plans, records of work, syllabus coverage), **CBC Assessment** (EE/ME/AE/BE rubric) |
| Finance | Fees & Payments (M-Pesa, Pesapal, bank), **Fee Structures & Billing** (vote heads, 50:30:20 split, bulk invoicing, bursaries, vote-head statement, SMS reminders), **Expenses** (vouchers, approval, suppliers) |
| Welfare | **Boarding** (dorms and beds, roll call, exeats with gate pass, inspections), **Health & Sick Bay** (clinic visits, medical profiles, medication and stock, outbreak alert), **Discipline** |
| Operations | **Transport** (fleet and NTSA compliance, crew, routes and stops, trips with boarding check-in), **Live Bus Tracking** (driver phone GPS, live map, speeding alerts), **Library**, **Inventory & Stores** |
| People | **Parent Portal** (parents follow each child: results, fees, attendance, bus, notices), **Staff Leave** |

### Roles and duties

A login role (`ADMIN`, `CLASS_TEACHER`, `SUBJECT_TEACHER`, `STAFF`, `STUDENT`,
`PARENT`) says what kind of account someone has. **Duties** (Settings → Roles &
duties) are the jobs they hold — Principal, Deputy, DOS, HOD, Timetabler,
Exams Officer, Bursar, Accountant, Matron, Patron, Nurse, Discipline Master,
Transport Manager, Driver, Librarian, Storekeeper, HR — and grant permissions
on top of the role, optionally limited to a class, dorm or route. A teacher
can also be DOS and a patron; a bursar or nurse signs in as Staff and gets
their module. Code checks permissions (`can('fees.collect')`), and every
permission belongs to a module, so one check covers both.

Where it lives: `src/lib/platform/` (modules, permissions, access, audit),
`src/lib/ops/` (the shared school-scoped record API behind
`/api/ops/[resource]`), and one migration per area in `supabase/migrations/`
dated `20260927…`. The full plan is in `docs/SCHOOL_OPERATIONS_PLAN.md`.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service role key (server-side) |
| `CLERK_SECRET_KEY` | yes | Clerk authentication |
| `CLERK_WEBHOOK_SECRET` | yes | Clerk webhook verification |
| `NEXT_PUBLIC_APP_URL` | yes | Base URL of the deployed app |
| `AT_API_KEY` | for SMS | Africa's Talking API key |
| `AT_USERNAME` | for SMS | Africa's Talking username (defaults to `sandbox`) |
| `AT_SENDER_ID` | optional | Africa's Talking sender ID |
| `RESEND_API_KEY` | for email | Resend API key for transactional email |
| `PLATFORM_OWNER_EMAIL` | optional | Overrides who is emailed to approve new school sign-ups (comma-separated). Defaults to the owner addresses in `src/lib/school-approval.ts` |
| `PLATFORM_OWNER_PHONE` | optional | Overrides who is texted about new school sign-ups (comma-separated). Defaults as above |
| `ANTHROPIC_API_KEY` | for scanning | Powers marksheet photo scanning |
| `ANTHROPIC_SCAN_MODEL` | optional | Overrides the default scan model (`claude-opus-4-8`) |
| `ANTHROPIC_DRAFT_MODEL` | optional | Overrides the model that drafts schemes of work (`claude-opus-5`, with an Opus 4.8 refusal fallback) |
| `NEXT_PUBLIC_MAP_TILE_URL` | optional | Map tiles for live bus tracking (defaults to OpenStreetMap; use your own tile provider for heavy use) |

### School sign-up approval

Anyone can sign up, but **creating a school requires your approval** — a
sign-up cannot use the system until then.

When someone requests a school, it is stored with `approval_status =
'PENDING_APPROVAL'` and the requester keeps the `PENDING` role. That role is
what every route already refuses, so an unapproved school is unusable without
any per-route gate to maintain.

You are notified two ways: an **email** with the school and contact details
plus one-click **Approve** / **Reject** links, and an **SMS** nudge to go read
it (the approval token is too long to put in a text). Approving is what
promotes the requester to `ADMIN`; the links carry a single-use token so they
work straight from your inbox and stop working once used.

Owner contacts are defaulted in `src/lib/school-approval.ts` so notifications
work without any deployment config, and `PLATFORM_OWNER_EMAIL` /
`PLATFORM_OWNER_PHONE` override them when you want to change recipients
without a code change. SMS additionally needs `AT_API_KEY`; if it is not
configured the email still goes out on its own.

Schools that already existed when this was introduced were grandfathered to
`APPROVED` by the migration, so no live school was affected.

> Notification failures never let a sign-up through: the school stays
> `PENDING_APPROVAL` and locked regardless, and the server logs the failure.

### Marksheet scanning (photo mark entry)

The Exams & Marks page can read marks straight from a photo of a paper
marksheet (📷 Scan Sheet). Extraction never writes marks directly — teachers
review and confirm every row before anything is saved.

### Offline-first mark entry

Manual mark entry keeps working when the network is flaky — like a Google
Doc, nothing typed is lost:

- **Autosave drafts.** Every row (including per-paper P1/P2/P3 scores on
  multi-paper subjects) is autosaved to the browser as it's typed, keyed per
  exam. Reload or come back later and entry continues exactly where it
  stopped.
- **Offline sync queue.** If **Save All** is pressed while offline (or a
  request drops mid-flight), the batch is stored on the device and synced
  automatically once the connection returns. The `exam_marks` upsert is
  idempotent, so re-sending a queued batch is always safe.
- **Live status.** The Manual Entry card shows an Online/Offline badge, the
  count of batches waiting to sync, and when the local draft was last saved.

This is entirely client-side (`localStorage`) — no schema changes required.

### Printing invitation codes

Admins can print a directory of user invitation codes grouped by category
(Administrators / Teachers / Students) from **User Management → 🖨️ Print
Invite Codes**, to hand each person their activation code in person:

- One **combined PDF** with each category on its own page, or a **ZIP of one
  PDF per category**.
- Filter to **active codes only** (unused & not expired) or include used and
  expired codes.
- Served by `GET /api/admin/invite-codes/pdf` (admin-only, school-scoped;
  params `category`, `status`, `format`).

### SMS notifications

Attendance and results notifications are sent to parents via
[Africa's Talking](https://africastalking.com/). Phone numbers are normalized
to Kenyan E.164 format before sending; without `AT_API_KEY` set, SMS sending
is disabled.

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- [Supabase](https://supabase.com) for the database
- [Clerk](https://clerk.com) for authentication
- [Africa's Talking](https://africastalking.com) for SMS
- [Anthropic API](https://www.anthropic.com) for marksheet scanning
- [Resend](https://resend.com) for transactional email

## Deployment

The project deploys to [Vercel](https://vercel.com). See the
[Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying)
for general guidance, and `Dockerfile`/`docker-compose.yml` for containerized
deployment.
