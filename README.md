# Skulbase

Skulbase is a modern school/student management system for schools —
covering the full academic workflow from enrollment to exams, attendance,
fees, and results delivery, with SMS notifications keeping parents in the
loop.

## Modules

- **People** — students, teachers, parents, and user/role management
- **Academic structure** — classes, subjects, and term/grading setup
- **Exams & Marks** — mark entry, including photo marksheet scanning
  (📷 Scan Sheet) for fast bulk entry
- **Report Cards** — professional, branded report card generation with
  marks, grades, comments, and PDF export
- **Attendance** — daily attendance tracking with parent notifications
- **Fees** — fee tracking and management
- **Assignments & Announcements** — classwork and school-wide communication
- **Analytics** — school-wide performance and engagement insights
- **Administration & Settings** — school onboarding, roles, and configuration
- **SMS notifications** — results, attendance, and announcements sent
  straight to parents' phones via Africa's Talking

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
| `ANTHROPIC_API_KEY` | for scanning | Powers marksheet photo scanning |
| `ANTHROPIC_SCAN_MODEL` | optional | Overrides the default scan model (`claude-opus-4-8`) |

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
