# Skulbase: status and how to continue

Written 22 October 2026, when the full-file review was paused. Everything below can be checked against the repository, Vercel and Supabase.

## 1. What is live

| | State |
|---|---|
| Website (skulbase.com) | `main` at `5bb60f5` (PR #246). Production build id `lnortEvJyD9tfxKHa6DJF`. |
| Android app | Over-the-air update published on branch `preview`, update group `051f6b2e-ae64-4b0f-8ff7-5fe1ad2b38f8`, runtime `9896c6867f5099c299ab12da5a4066eb680afefe`. No new native build is needed. |
| Errors | Vercel showed no runtime errors for the 48 hours before 21 Oct 16:20 UTC. Supabase logs showed no failed queries. |
| Checks on `main` | Web and mobile `tsc` pass. `next build` and `expo export` pass. ESLint has fewer errors than before these changes (69, against 74). |

## 2. What was shipped (PRs #232 to #246, all merged)

| PR | Change |
|---|---|
| #232 | Sign-in recovers accounts whose school was deleted; unenrolled students see one clear screen. |
| #233 | Dashboard figures add up; students can read and hand in assignments. |
| #234 | Kept the camera permission text so fixes ship over the air. |
| #235 | Uploads go straight to storage; form errors are visible; one-tap release. |
| #236 | Students can activate again; mobile forms say what is missing. |
| #237 | A class's class teacher changes in one step. |
| #238 | Every file upload from the phone works. |
| #239 | Exam papers: submit on upload, next steps, moderators; in-app file viewer. |
| #240 | Signatures: photographed once, printed on every report card and mark sheet. |
| #241 | School sections with their own heads; each level's principal signs its classes. |
| #242 | Full audit: security, data integrity, complete lists and UX fixes across web, API and app. |
| #243 | The results card reads each exam's totals, not every mark of the term. |
| #246 | Audit round 2: grading (8-4-4 best-7, shared positions), report cards for every released term, Pesapal and fee balances, locking out deactivated or transferred learners, invite links on shared phones, forgot-password by username, learner portal limited to the learner's own subjects, accented names on PDFs, and six new database indexes. |

## 3. Owner actions (you)

1. ~~Run `supabase/migrations/20261011090100_close_photos_listing.sql`.~~ **Done 22 Oct**, run by you in the SQL Editor. All four photos policies are gone. Listing the bucket with the public key now returns nothing, and photos still load from their public links.
2. ~~Run `supabase/migrations/20261019090000_attachment_bucket_limits.sql`.~~ **Done 22 Oct.** The photos and assignment-files buckets are capped at 10 MB with their allowed file types. Because both ran in the SQL Editor, they do not appear in Supabase's migration history.
3. Supabase → Authentication → Providers: turn off email sign-ups. The app signs in with Clerk. The Supabase security report also flags leaked-password protection as off. It only applies to Supabase sign-ins, so turning off sign-ups covers it, but you can switch it on under Authentication too.
4. Vercel (project report-card → Settings → Environment Variables):
   - Set `ANTHROPIC_API_KEY` as Sensitive, then delete the variable named `claude`.
   - Set `AT_USERNAME`, and re-create `AT_API_KEY` as Sensitive.
   - Set `AT_SENDER_ID` only if Africa's Talking has approved one.
   - Check that `NEXT_PUBLIC_APP_URL` is `https://skulbase.com` and that the Clerk webhook secret is set.
   - Redeploy after any change.
5. Optional: delete `NEXTAUTH_SECRET`, `NEXTAUTH_URL` and `CLERK_SECRET_KEY_PROD`. Add the WhatsApp and `PLATFORM_OWNER_*` variables if you want those features.

**Waiting on your answer:** should each section's deputies or leaders also sign, and if so, on which documents?

## 4. The full-file review: where it stopped

**Method.** All 891 source files (117,246 lines) are split into 25 slices; `sweep-slices.json` lists every file in each. One reviewer reads every file in a slice in full and reports on each file. Then a separate reviewer tries to disprove each finding, and only findings that survive are fixed.

**Progress.** 4 of the 25 slices are reviewed: s02, s10, s11 and s19, which is 141 files. They produced **74 leads, none verified yet**. In earlier rounds, roughly a third of leads turned out wrong on checking, so treat these as leads, not confirmed bugs. The review stopped because the account hit its usage limits, first the weekly limit and then the session limit.

**Not yet reviewed (21 slices, 750 files):**

| Slice | Area | Files |
|---|---|---|
| s01 | API: academics, account, admin | 48 |
| s03 | API: reports, school (analytics → fees payments) | 28 |
| s04 | API: school (fees → upload), signatures, sms, transport, verify, webhooks, welfare | 48 |
| s05 | lib: academics, client, finance, grading, import, manual, marks, onboarding, ops | 44 |
| s06 | lib: ops, parents, pathway, payments, pdf, platform | 37 |
| s07 | lib: platform, preview, reports, root (account → exam-types) | 41 |
| s08 | lib: root (fees → school-sections) | 44 |
| s09 | lib: root (school-subjects → whatsapp), student, timetable, transport, welfare | 47 |
| s12 | Web pages: activate, contact, features, help, login, parent, pesapal, pricing, student, verify | 50 |
| s13 | Web components: academics, account, analytics, attendance, auth, charts, classes, dashboard | 48 |
| s14 | Web components: exam-results, exams-marks, fees, finance, landing (part) | 21 |
| s15 | Web components: landing, layout, manual, marks (part) | 38 |
| s16 | Web components: marks, modules, onboarding, ops, people, platform, preview, reports, settings (part) | 42 |
| s17 | Web components: settings, student, subjects, transport, ui (part) | 44 |
| s18 | Web components: ui, users, welfare | 25 |
| s20 | Mobile screens: staff (people → users), student, verify | 19 |
| s21 | Mobile components: academics, account, auth, dashboard, exams (part) | 30 |
| s22 | Mobile components: exams, fees, finance, help, ops, people, platform, reports, root, settings (part) | 36 |
| s23 | Mobile components: settings, student, subjects, transport, welfare | 16 |
| s24 | Mobile lib | 32 |
| s25 | Web hooks and types | 12 |

## 5. The 74 unverified leads

Full detail for each lead (trigger, impact, evidence with file:line, proposed fix) is in `sweep-leads.json`.

### s02 · API: auth, contact, finance, health, hr, inventory, mpesa, ops, parent, pesapal, platform, reports (19)

- **medium** · `src/app/api/auth/activate/route.ts:219` · Failed activation rollback deletes the learner's whole student record
- **medium** · `src/app/api/finance/reports/vote-heads/route.ts:75` · Vote-head statement books unallocated spending to Transport and drops spending on unbilled vote heads
- **medium** · `src/app/api/finance/invoices/generate/route.ts:50` · Billing run reads fee awards and transport riders without paging
- **medium** · `src/app/api/mpesa/stkpush/route.ts:139` · STK push never checks that the CheckoutRequestID was saved, so a charged payment can stay PENDING forever
- **medium** · `src/app/api/platform/schools/[schoolId]/decision/route.ts:125` · Approving a school ignores a failed promotion of the requester, and the single-use token is already burnt
- **medium** · `src/app/api/auth/available-roles/route.ts:47` · A future-dated academic year makes every class teacher lose class-teacher rights
- **medium** · `src/app/api/finance/reminders/route.ts:43` · Fee-reminder blast can time out mid-send and re-send, and its rate limit does not hold
- **low** · `src/app/api/finance/invoices/generate/route.ts:100` · Invoice regeneration is not atomic and misreports an empty real run
- **low** · `src/app/api/mpesa/c2b/confirmation/[schoolId]/[token]/route.ts:73` · Paid C2B confirmations with a missing reference or bad amount are inserted without checking the result
- **low** · `src/app/api/mpesa/stkpush/callback/[schoolId]/[token]/route.ts:78` · A successful M-Pesa payment can be shown to the payer as failed
- **low** · `src/app/api/reports/student/[studentId]/route.ts:208` · Report routes return internal error details to the browser
- **low** · `src/app/api/mpesa/stkpush/route.ts:155` · Payment gateway errors are passed straight to the payer
- **low** · `src/app/api/ops/overview/route.ts:102` · Overview 'next on the calendar' tile ignores event audience
- **low** · `src/app/api/ops/[resource]/route.ts:6` · Class teachers can read whole-school boarding data (exeats, bed allocations) through the shared ops and residence endpoints
- **low** · `src/app/api/ops/[resource]/route.ts:6` · Ops list endpoint silently truncates at 1,000 rows
- **low** · `src/app/api/auth/signup/route.ts:92` · Signup deletes the just-created Clerk account when the webhook wins the users-row race
- **low** · `src/app/api/parent/children/[id]/route.ts:26` · Parent child overview turns failed queries into empty data
- **low** · `src/app/api/health/visits/[id]/notify/route.ts:29` · Clinic visit notify can text the guardian twice and ignores its own bookkeeping failure
- **low** · `src/app/api/auth/activate-google/route.ts:109` · Google activation has no rollback and leaves the invited account half-linked

### s11 · Web dashboard: onboarding → users (15)

- **medium** · `src/app/dashboard/transport/page.tsx:82` · Transport compliance panel says every document is current when the request failed
- **medium** · `src/app/dashboard/transport/page.tsx:104` · Newly added vehicles, drivers and routes are missing from the Trips, Routes and Fuel-log forms until a full reload
- **medium** · `src/app/dashboard/transport/page.tsx:36` · Route drawer's Stop picker and default stop order do not update after stops are added or removed
- **medium** · `src/app/dashboard/reports/page.tsx:303` · Unsaved report-card remarks are silently discarded when the Comments panel is hidden and shown again, or when class or term changes
- **medium** · `src/app/dashboard/reports/page.tsx:76` · Failed class, term or year load on Report Cards looks like 'No classes assigned to you'
- **medium** · `src/app/dashboard/parent-accounts/page.tsx:36` · A parent entered with a differently formatted phone creates a second parent account instead of reusing the first
- **medium** · `src/app/dashboard/parent-accounts/page.tsx:53` · Learner picker cannot find learners added after its first load, and a failed load shows 'No matches'
- **medium** · `src/app/dashboard/reports/page.tsx:153` · SMS dialog lists and pre-selects transferred, graduated and deactivated learners
- **low** · `src/app/dashboard/parent-accounts/page.tsx:26` · Learner list and guardian table can show another learner's parents, and show 'No parents linked' while loading
- **low** · `src/app/dashboard/parent-accounts/page.tsx:38` · 'Invite code sent by SMS' is shown although the route never reports whether the SMS went out
- **low** · `src/app/dashboard/parent-accounts/page.tsx:67` · Unlinking a parent is one tap on an icon with no confirmation and no busy state
- **low** · `src/app/dashboard/reports/page.tsx:161` · A failed class-roster load is cached as 'no learners' and never retried
- **low** · `src/app/dashboard/page.tsx:234` · Dashboard shortcuts, tiles and to-dos link to modules the school has switched off and bounce silently
- **low** · `src/app/dashboard/onboarding/page.tsx:112` · Setup wizard sits on 'Loading grades…' forever if the grade list request fails
- **low** · `src/app/dashboard/error.tsx:23` · Dashboard error boundary prints the raw exception message to users

### s10 · Web dashboard: analytics → library (21)

- **high** · `src/app/dashboard/fees/page.tsx:485` · Deleting a fee record cascades away its payment receipts, with only a soft warning
- **medium** · `src/app/dashboard/fees/page.tsx:314` · A failed fee-list load is shown as 'No Fee Records Yet' with zero KPIs
- **medium** · `src/app/dashboard/fees/page.tsx:786` · Batch save wipes typed values for failed rows and names only the first four failures
- **medium** · `src/app/dashboard/fees/page.tsx:578` · Payment history modal shows a failed load as 'No payments recorded yet' and keeps a stale paid total after a void
- **medium** · `src/app/dashboard/announcements/page.tsx:254` · Icon-only action buttons use a `btn-icon` class that has no CSS, leaving 14-16px tap targets
- **medium** · `src/app/dashboard/expenses/page.tsx:152` · Cancelling an expense decision leaves note/reference behind that prefill the next expense
- **medium** · `src/app/dashboard/cbc/page.tsx:43` · CBC grid load has no stale-response guard, so rows from an old filter can be saved under the new strand/term/subject
- **medium** · `src/app/dashboard/assignments/page.tsx:286` · 'N submissions' button opens an empty drawer for assignments set by another teacher
- **medium** · `src/app/dashboard/library/page.tsx:82` · Library 'Available' count is wrong: total copies for non-managers, stale or failed-load for managers
- **low** · `src/app/dashboard/fees/page.tsx:813` · Unsaved batch-entry values are discarded with no confirmation
- **low** · `src/app/dashboard/fees/page.tsx:600` · Payments log has no stale-response guard, so a slower earlier filter overwrites the newer result
- **low** · `src/app/dashboard/fees/page.tsx:415` · Add-record student picker silently ends up empty when the student list request fails with an HTTP error
- **low** · `src/app/dashboard/cbc/page.tsx:89` · CBC pickers offer every class and subject but Save is refused for ones the teacher does not teach
- **low** · `src/app/dashboard/assignments/page.tsx:463` · 'Late' flag compares the UTC date of the hand-in with a local due date
- **low** · `src/app/dashboard/calendar/page.tsx:16` · Calendar agenda shows a failed load as 'Nothing coming up on the school calendar'
- **low** · `src/app/dashboard/health/page.tsx:24` · Health 'Today' panel stays a loading skeleton forever when the status request fails
- **low** · `src/app/dashboard/billing/page.tsx:84` · Fee structure list totals stay stale after vote heads are added in the items drawer
- **low** · `src/app/dashboard/boarding/page.tsx:62` · Gate check keeps showing the previous pass result while a new code is typed
- **low** · `src/app/dashboard/announcements/page.tsx:100` · 'Show older announcements' response is appended to the list even after the filter or search changed
- **low** · `src/app/dashboard/announcements/page.tsx:259` · Announcement titles and bodies do not wrap long unbroken text, so links overflow the card on phones
- **low** · `src/app/dashboard/onboarding/page.tsx:445` · Onboarding wizard inputs have labels that are not associated with their fields

### s19 · Mobile screens: sign-in, account, help, parent, staff (analytics → people) (19)

- **medium** · `mobile/app/staff/people/[id].tsx:130` · Editing a teacher fails whenever their phone is empty: client sends phone:null, server schema only accepts a string
- **medium** · `mobile/app/staff/announcements.tsx:45` · Announcement posted 'and sent by SMS' is reported as success even when no text went out
- **medium** · `mobile/app/staff/announcements.tsx:29` · Announcements list shows only the newest 20 posts and never loads older ones
- **medium** · `mobile/app/staff/analytics.tsx:37` · Analytics ignores a new ?stream= when the tab is already mounted, so class tiles open the wrong class
- **medium** · `mobile/app/staff/fees.tsx:213` · 'Bill class' bills the previous class's learners if tapped before the new class's roster has loaded, and 'Billed 0 learners' is shown as success with no class
- **medium** · `mobile/app/staff/library.tsx:52` · Library 'Available' count is computed from a screen-level loans query that never refreshes (or shows an error)
- **medium** · `mobile/app/staff/attendance.tsx:99` · Saving the register then changing date/class reloads the wrong day and class
- **low** · `mobile/app/staff/expenses.tsx:39` · Expense form's supplier and vote-head pickers use lists that never reload, so a new supplier is missing
- **low** · `mobile/app/staff/expenses.tsx:162` · Expense decision note, reference and method carry over from a cancelled or failed decision to the next expense
- **low** · `mobile/app/staff/announcements.tsx:89` · 'Also send by SMS' toggle is offered to teachers although the API refuses it for non-admins
- **low** · `mobile/app/account/delete.tsx:55` · Delete account can report failure after the account has already been deleted
- **low** · `mobile/app/staff/exam-papers.tsx:99` · Exam paper upload parses the release time after the files are already uploaded, and bad input gives a cryptic error
- **low** · `mobile/app/help/contact.tsx:21` · Contact form prefills the placeholder .local email for teachers and students, so replies cannot reach them
- **low** · `mobile/app/staff/cbc.tsx:55` · CBC class list can be filled by a stale response and then saved under a different strand, subject or term
- **low** · `mobile/app/staff/parent-accounts.tsx:32` · Parent list can show the previously selected learner's parents after a quick switch
- **low** · `mobile/app/(auth)/sign-up.tsx:60` · Sign-up reports 'Failed to create account' when the account was created and only the follow-on sign-in failed
- **low** · `mobile/app/staff/fees.tsx:225` · Adding a fee for one learner silently replaces an existing bill for that term but says 'Fee record added.'
- **low** · `mobile/app/staff/classes.tsx:169` · Searching classes with no match shows a blank screen
- **low** · `mobile/app/staff/health.tsx:113` · Discharge time is the time the row last rendered, not when Discharge was tapped

## 6. How to continue

1. **Start a session** on branch `ccr-7193a861-codlr4`. It matches `main` plus this folder.
2. **Verify the 74 leads first.** This is the cheapest step with the most value. For each lead in `sweep-leads.json`, a skeptic tries to refute it, and only confirmed leads get fixed.
3. **Review the remaining 21 slices** with `full-sweep.workflow.js`, passing `{"slices": [...]}` built from `sweep-slices.json`. Run a few slices at a time so a usage limit doesn't stop everything at once. The script reports on every file, sends a second reviewer for any file the first did not cover, and verifies every finding.
4. **Fix and check before pushing:**
   - Web: `npx tsc --noEmit`, `npx eslint src`, `npm run build`.
   - Mobile, from `mobile/`: `npx tsc --noEmit`, `npx expo export`. Check that the fingerprint is still `9896c6867f5099c299ab12da5a4066eb680afefe`, so an over-the-air update is enough.
   - Test any database change inside a transaction that is rolled back.
5. **Ship:**
   - Open a PR and merge it on green CI.
   - Confirm production by checking that the homepage build id (`"b":"<id>"` in the HTML) has changed.
   - Publish the app update from `mobile/`: `npx eas-cli update --branch preview --platform android --environment preview --message "<what changed>" --non-interactive`.
