# Report-Card App — Full Redesign & UX Plan

Goal: a coherent, modern, responsive school-management app (Zeraki-inspired) with
every advertised page functional, a navigation system that scales down to mobile,
and an AI-assisted "scan a marksheet photo" entry flow for marks.

This plan is grounded in a code audit done on the `claude/modern-dashboard-design-1iczib`
branch (the admin dashboard redesign already merged into this branch is Phase 2's
reference implementation).

---

## 1. Current-state audit

### 1.1 Pages and their status

| Route | Size | Status (from code reading) |
|---|---|---|
| `/dashboard` | rebuilt | ✅ Redesigned (reference for the new visual system) |
| `/dashboard/exams-marks` | 43 + tabs | Works; two dense tabs, mark entry UX is multi-step |
| `/dashboard/people` | 804 | Works (students/teachers/parents tabs); heavy page, tables not mobile-friendly |
| `/dashboard/reports` | 265 | Works; report generation flow |
| `/dashboard/fees` | 801 | Works vs API; needs responsive + UX pass |
| `/dashboard/attendance` | 709 | Works vs API; needs responsive + UX pass |
| `/dashboard/analytics` | 553 | Works vs API; dashboard search deep-links here with `?search=` — verify it's honored |
| `/dashboard/announcements` | 207 | CRUD wired to API |
| `/dashboard/assignments` | 405 | CRUD + submissions wired to API |
| `/dashboard/classes`, `/subjects` | ~300 | Work; admin setup pages |
| `/dashboard/users` | 88 | Thin; overlaps conceptually with People — IA confusion |
| `/dashboard/settings` | 223 + tabs | Works (school, calendar, grading, structure tabs) |
| `/dashboard/onboarding` | 503 | Works |
| 8 stub routes (`/students`, `/teachers`, `/parents`, `/exams`, `/report-cards`, `/my-results`, `/academic-structure`, `/administration`) | 5 each | Redirects — fine, but they reveal IA drift (see 1.2) |
| `/student/*` portal | — | Separate layout; dashboard/results/subjects/attendance/profile |

**Functional bug triage needed** (user reports "pages not working / features
unfunctional" — first sprint includes a QA pass to confirm and enumerate; known
candidates from code):

- Subject-teacher dashboard "Pending Entry" KPI is a permanent `—` placeholder.
- Dashboard search pushes to `/dashboard/analytics?search=…` — the analytics page
  must actually consume that param.
- `comingSoonModules` (M-Pesa, SMS, Parent Portal, Library, Transport, …) are
  advertised on the marketing pages; SMS API (`/api/sms/send`, Africa's Talking)
  exists but the module is still flagged coming-soon — decide ship or hide.
- Assignments file upload takes a raw URL field, not an actual upload — half-built.
- Announcements/assignments error handling: failed fetches fail silently in places.

### 1.2 Structural problems found in code

1. **Sidebar group config is broken.** `sidebarGroups` in `Sidebar.tsx` references
   labels that don't exist in `navItems` ("Academic Structure", "Administration"),
   so those groups silently render partial/empty and the leftovers (Classes,
   Subjects, Users, Settings) fall into a generic "More" bucket. The pinned
   bottom "Settings" link searches for label `'Administration'`, never finds it,
   and **never renders** (dead code).
2. **Fake data in the sidebar.** `getItemCount()` returns hardcoded counts
   (Students: "542", Teachers: "48", …). Currently computed-but-unrendered dead
   code — must be deleted before someone wires it up.
3. **Mobile nav is an arbitrary slice.** Bottom bar = first 4 of the filtered
   nav array + "More" containing ~9 items for admins. Not curated per role.
4. **Hover-expand sidebar.** Desktop sidebar expands on `mouseenter` and
   collapses on `mouseleave` — content jumps 260px↔80px constantly. Jarring.
5. **Two theming systems.** Legacy `--color-*` vars + shadcn tokens coexist;
   Sidebar is 600 lines of inline `style={{}}` objects while the rest of the app
   is Tailwind. Duplicate `.dark` blocks in `globals.css`.
6. **`dark:` Tailwind variant is dead app-wide.** ThemeProvider sets
   `data-theme="dark"` but the custom variant is defined as `.dark *` — every
   `dark:` utility in the codebase silently does nothing. (The dashboard redesign
   worked around this with CSS vars.)
7. **Font stack is broken.** `globals.css` imports Lora + Inter but declares
   `--font-sans: Merriweather, serif` — Merriweather is never loaded, so the app
   renders in each device's fallback serif; the two downloaded fonts are unused.
8. **IA duplication.** "Users" vs "People", "Settings" vs "Academic Structure",
   redirect stubs — one concept should have one home.
9. **Hardcoded colors everywhere.** `roleBadgeColors`, chart hexes, emerald/amber
   utility classes that ignore the earthy theme (dashboard now fixed; the other
   ~15 pages still do this).

---

## 2. Phase 0 — Foundation (design system) *(1 PR, blocks everything else)*

1. **Fix theming plumbing**
   - Point the Tailwind dark variant at the real mechanism:
     `@custom-variant dark (&:is(.dark *, [data-theme="dark"] *));` (or have
     ThemeProvider set both `data-theme` and `.dark` on `<html>`).
   - Collapse the duplicate `.dark` token blocks in `globals.css` into one.
   - Keep the legacy `--color-*` aliases temporarily; delete them at the end of
     Phase 2 when no page references them.
2. **Fix fonts deliberately**
   - Decision: keep the warm serif identity (load Lora for `--font-display`) and
     use Inter for UI/body/numbers (`--font-body`, tables, charts). Serif for
     headings only — body text, tables and figures in a UI sans reads far better
     at dashboard sizes. Load via `next/font` (self-hosted, no FOUT), delete the
     Google `@import`s.
3. **Canonical component kit** (extend `src/components/ui`)
   - `PageHeader` (title, subtitle, actions, breadcrumbs) — every page uses it.
   - `Card`/`InsightCard`, `KpiTile`, `SectionTitle` (promote the dashboard's
     versions to shared components).
   - `DataTable` with built-in: sticky header, row actions, empty state,
     skeleton, pagination, and a **mobile card-list fallback** (< `md`, tables
     render as stacked cards — this is the single biggest responsiveness fix).
   - `FilterBar` (one row above content; class/stream/term/exam selects) —
     shared by marks, analytics, attendance, fees.
   - `Modal`, `ConfirmDialog`, `Toast` — already exist; unify styles.
   - Status/viz colors: the `--viz-*` vars added in the dashboard PR are the
     single source for chart/status color (validated against both surfaces).
4. **Spacing/typography scale** — document in `docs/DESIGN.md`: page padding,
   card radius (16px), gaps, type ramp. Everything else references it.

**Definition of done:** `dark:` works; fonts load; a `StyleGuide` route
(`/dashboard/_styleguide`, dev-only) renders every primitive in both themes.

---

## 3. Phase 1 — Navigation & information architecture *(1 PR)*

### 3.1 Desktop sidebar (rebuilt, Tailwind, no inline styles)

Role-scoped groups — max ~7 visible items per role before grouping:

```
ADMIN                       TEACHER (class/subject)      STUDENT
─ Dashboard                 ─ Dashboard                  ─ Dashboard
ACADEMICS                   ACADEMICS                    ─ My Results
─ Exams & Marks             ─ Exams & Marks              ─ My Subjects
─ Report Cards              ─ Report Cards (CT only)     ─ Attendance
─ Attendance                ─ Attendance (CT only)       ─ Profile
─ Analytics                 ─ Assignments
SCHOOL                      COMMUNICATION
─ People (Students/         ─ Announcements
   Teachers/Parents tabs)
─ Classes & Subjects        (pinned bottom: Settings→My Profile)
FINANCE
─ Fees
COMMUNICATION
─ Announcements
─ Assignments
(pinned bottom: Settings, Users → merge into Settings > Users tab)
```

- Groups defined **next to navItems in one file** (`navItems.ts` exports
  `navGroups`), typed so a group label that doesn't match an item is a compile
  error — the current silent-mismatch bug becomes impossible.
- Collapse is **click-to-toggle** (persisted in localStorage), not hover.
  Collapsed rail shows icons + tooltips.
- Delete `getItemCount` fake counts. If counts return, they come from the
  dashboard stats API.
- Merge "Users" into Settings as a tab (admin user management is settings, not
  daily navigation). Keep `/dashboard/users` as a redirect.
- ⌘K search: promote the sidebar filter into a real command palette (jump to
  page, find student by name) — Phase 5 nicety, structure for it now.

### 3.2 Mobile navigation

- Bottom bar = **4 curated items per role + More**, not `slice(0,4)`:
  - Admin: Dashboard · Exams & Marks · People · Fees · More
  - Teacher: Dashboard · Exams & Marks · Attendance · Assignments · More
  - Student: Dashboard · Results · Subjects · More
- "More" opens the existing sheet, but organized with the same group headers,
  plus profile/theme/logout. Everything reachable in ≤ 2 taps.
- Page headers on mobile: sticky top bar with page title + primary action only.

---

## 4. Phase 2 — Page-by-page redesign *(one PR per page, in this order)*

Apply the dashboard's visual system everywhere: `PageHeader`, quiet cards,
token colors, `FilterBar` on data pages, `DataTable` with mobile card fallback,
loading skeletons, purposeful empty states with a CTA.

Priority = daily-use frequency:

1. **Exams & Marks** (teachers live here)
   - Split the two mega-tabs into a clear left-to-right flow:
     *Exams list → pick exam → enter marks → results/broadsheet*.
   - Mark entry: full-width grid, keyboard-first (Enter = next student, arrows
     move, auto-advance on max digits), sticky student column, autosave with
     per-cell save state, out-of-range validation inline.
   - Entry method chooser: **Manual · CSV upload · 📷 Scan sheet** (Phase 4).
   - Mobile: one-student-at-a-time entry card (grid is unusable at 360px).
2. **People** — split the 800-line page into per-tab components; card-list on
   mobile; student profile drawer (bio, marks trend, attendance, fees) instead
   of navigating away.
3. **Report Cards** — stepper UI (Scope → Comments → Settings → Generate);
   progress via the existing SSE stream; PDF preview inline.
4. **Fees** — Zeraki-Finance-style: term summary header (billed/collected/
   balance meter reusing the dashboard's FinanceSnapshot), student ledger,
   record-payment flow ≤ 3 fields; defaulters list → SMS action.
5. **Attendance** — register-style daily grid (tap to cycle P/A/L/E), class
   summary bar reusing the dashboard's stacked status bar; date navigation.
6. **Analytics** — Zeraki parity is here (see Phase 5): merit list, subject
   averages, stream comparison, term-on-term deltas. Recolor all recharts to
   `--viz-*`/`--chart-*` tokens; every chart gets a table-view toggle.
7. **Settings** — tabbed (School · Academic Calendar · Structure · Grading ·
   Users · Modules); each tab is already a component, mostly a reskin.
8. **Announcements & Assignments** — simple list + composer redesign; wire the
   assignments file field to the existing `/api/school/upload` instead of a URL
   input.
9. **Student portal** — apply same system; results page mirrors the report card.
10. **Landing page** — last; align hero/branding with the new system.

**Responsiveness contract (every page PR must pass):**
- Verified at 360, 768, 1024, 1440 px; no horizontal body scroll ever.
- Tables → card lists below `md`; filter bars → horizontally scrollable chips.
- Touch targets ≥ 44px; modals become bottom sheets on mobile.
- Test matrix: 4 roles × page × 2 themes × 4 widths (screenshot script in CI —
  Playwright is available in the dev environment).

---

## 5. Phase 3 — Functional repair sprint *(parallel with Phase 2)*

1. Build the **bug inventory** first: run through every page as each role with
   seeded data, log breakages in GitHub issues with `bug` + page label.
   (Owner input needed: the known-broken list from real usage.)
2. Fix the audit items from §1.1/§1.2 that aren't covered by redesign PRs:
   - Analytics `?search=` deep-link handling.
   - "Pending Entry" KPI — compute (exams with missing marks for the teacher's
     subjects) or remove.
   - Assignments upload; silent fetch failures → toast + retry.
   - Decide SMS module status: API exists — surface it (announcements → "also
     send as SMS", fees → "remind defaulters") behind a school-level setting,
     or hide the marketing claim.
   - Delete dead code: fake counts, unused imports, `RecentAnnouncementsCard`-
     style leftovers on other pages.
3. **Error surfaces**: every page gets `error.tsx` + not-found handling; API
   errors render a retry card, never a blank screen.

---

## 6. Phase 4 — 📷 Photo mark entry (AI marksheet scanning)

The headline feature: photograph a paper marksheet; the app extracts
student ↔ mark pairs and pre-fills the entry grid for review.

### 6.1 UX flow

1. In Mark Entry, teacher picks exam + class as today, chooses **Scan sheet**.
2. Capture: `<input type="file" accept="image/*" capture="environment">` (native
   camera on mobile, file picker on desktop). Multi-page supported (one photo
   per page, queued).
3. Client-side: downscale/compress to ≤ ~1.5 MB (canvas), quick quality check
   (blur/darkness warning before upload).
4. Upload → `POST /api/school/exam-marks/scan` (multipart; exam_id, stream_id).
5. Server pipeline:
   - Send image to a **vision LLM** (Anthropic `claude-haiku-4-5` for cost,
     `claude-sonnet-5` fallback for hard handwriting) with a strict JSON schema:
     `[{ row, admission_number?, student_name, mark, confidence }]`.
     LLM vision beats classical OCR (Tesseract) decisively on handwriting and
     table structure; no template training needed.
   - **Roster matching** server-side: exact match on admission number, else
     fuzzy name match (normalized Levenshtein) against the selected stream's
     roster. Statuses: `matched` / `ambiguous` (top-2 candidates) / `unmatched`.
   - Validation: mark within exam `max_score`, duplicates flagged.
   - Return rows + statuses. **Nothing is written to the DB at this stage.**
6. **Review screen** (the safety gate): split view — photo (zoom/pan) beside the
   pre-filled entry grid.
   - Confidence < threshold → amber cell; ambiguous match → dropdown of
     candidates; unmatched → row parked in a "needs assignment" tray.
   - Teacher fixes cells inline, then **Confirm & Save** — writes through the
     existing marks API (same validation/audit path as manual entry).
7. Post-save toast: "34 marks entered from scan · 3 skipped" with undo window.

### 6.2 Accuracy lever: printable scan-friendly marksheets

The app already generates marksheet PDFs (`marksheetPdfGenerator.tsx`). Add a
"print entry sheet" variant: roster pre-printed (adm no + name), empty boxed
mark column, and a header code (exam id + page) — teachers write marks into
boxes. Photos of this sheet make extraction near-perfect and let the header
auto-select the exam. Free-form marksheets remain supported, just lower
confidence.

### 6.3 Engineering notes

- New API route `api/school/exam-marks/scan/route.ts`; Anthropic SDK server-side
  only, `ANTHROPIC_API_KEY` env; per-school daily scan quota + rate limit.
- Privacy: images processed in-memory / short-lived storage, deleted after
  review session; note it in the privacy policy (student PII in photos).
- Cost: a Haiku-class vision call per page is fractions of a cent — negligible
  vs SMS costs; still meter it per school.
- Failure modes: unreadable photo → actionable message ("retake closer, more
  light"); partial extraction is fine (review screen handles gaps).
- Rollout: feature-flag per school; pilot with one class; log
  correction-rate (edited cells ÷ extracted cells) as the quality metric.

### 6.4 Milestones

1. Backend scan endpoint + JSON extraction against test photos (goldens in repo).
2. Roster matcher + unit tests (names with typos, shared surnames).
3. Review UI on top of the redesigned entry grid.
4. Printable entry-sheet PDF variant.
5. Pilot, tune prompts/thresholds, then remove flag.

---

## 7. Phase 5 — Zeraki-parity feature depth

Ordered by value to Kenyan schools:

1. **Merit lists & rankings** (analytics): per exam — class/stream/overall rank,
   subject ranks, most-improved, printable merit list PDF (schools pin these on
   boards). Data already exists in exam marks; mostly aggregation + a page.
2. **Broadsheet polish**: frozen columns, deviation vs previous exam, grade
   color-coding using `--viz-*`, export XLSX.
3. **SMS suite** (API already present): results notification to parents
   ("Mean: B+, position 4/38"), fee reminders, absentee alerts. Templates +
   send-log + cost counter per school.
4. **Parent portal** (phase-two module already advertised): reuse student portal
   layout; parent account links to ≥1 students; results, fees, attendance,
   announcements. Clerk invite flow already exists for users.
5. **Timetable** (Zeraki has it; big) — keep on backlog, don't block redesign.
6. **M-Pesa reconciliation** — after Fees redesign; Daraja STK push + manual
   reconciliation screen. Backlog until fees UX is solid.

---

## 8. Sequencing & effort summary

| # | Phase | Scope | Est. PRs |
|---|---|---|---|
| 0 | Foundation | theming fix, fonts, UI kit, styleguide | 1–2 |
| 1 | Navigation/IA | sidebar rebuild, mobile nav, route merges | 1 |
| 2 | Page redesigns | 10 pages, priority order above | ~10 small |
| 3 | Repair sprint | bug inventory + fixes, error surfaces | rolling |
| 4 | Photo mark entry | scan endpoint, matcher, review UI, print sheet | 3–4 |
| 5 | Zeraki depth | merit lists, SMS, parent portal, … | per-feature |

Rules of engagement:
- One page/feature per PR, each passing the responsiveness contract + both themes.
- No new hardcoded hex colors — tokens or `--viz-*` only (lint rule via
  `eslint-plugin-tailwindcss`/custom rule to enforce).
- Every data page ships skeleton + empty + error states, or it doesn't ship.
