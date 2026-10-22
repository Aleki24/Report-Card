export const meta = {
  name: 'full-sweep',
  description: 'Review every source file slice for UI, UX and API defects, then adversarially verify each finding',
  phases: [
    { title: 'Review', detail: 'one reviewer per slice reads every file in it', model: 'sonnet' },
    { title: 'Gaps', detail: 'cover any file a reviewer did not report on', model: 'sonnet' },
    { title: 'Verify', detail: 'a skeptic tries to refute each finding' },
  ],
}

const CONTEXT = `Repository: /home/user/Report-Card ("Skulbase", a Kenyan school management system, live at skulbase.com).
- Web: Next.js 16 App Router (src/app), Tailwind, Clerk auth. API routes use a Supabase SERVICE-ROLE client, so every authorization check (role, school scoping, ownership) lives in route code (helpers in src/lib/auth-server.ts such as getCaller, getAuthSession, getActiveUserProfile). RLS is enabled with no policies on purpose; do not report that.
- Mobile: Expo SDK 57 app in mobile/ (expo-router). "@/" maps to mobile/, "@shared/*" maps to src/lib/* (so shared lib files use relative imports). Check Expo/React Native APIs against the installed typings in mobile/node_modules, not memory.
- Shared domain: CBC and 8-4-4 grading, exams with multi-paper components, report cards (react-pdf), fees with M-Pesa and Pesapal, learners/parents/staff portals.
- Known and NOT to be reported: unapplied Supabase migrations, missing environment variables/API keys, lint style, naming, missing tests, refactor wishes, "consider adding" suggestions without a concrete defect.
- Many earlier audits already fixed issues; look for what is still wrong on the current code.`

const CHECKLIST = `What counts as a defect (report only concrete ones with a realistic trigger):
API / server:
- Authorization: missing or wrong role check, data from another school reachable (IDOR), a learner/parent reaching another learner's data, deactivated users still served.
- Input handling: unvalidated body fields reaching the DB, wrong types, NaN, empty strings saved where null is meant, PostgREST or() filter strings built from user input.
- Data correctness: PostgREST 1000-row default cap silently truncating lists that can exceed it, wrong joins, off-by-one terms/years, non-atomic multi-step writes that leave partial state on failure, missing error checks on Supabase calls (error ignored then data used), wrong HTTP status codes, responses that leak internal error text.
- Contract mismatches: the client (web or mobile) sends or expects a field the route does not (find the callers with grep).
UI / UX (web and mobile):
- Missing loading, error or empty state; error swallowed so the user sees nothing; a failed request shown as "no data".
- Stale responses: a slow earlier request overwriting a newer one after a quick filter/class/term switch.
- Double submit possible; buttons not disabled while saving; form state lost or reset after save; success shown on failure.
- Broken navigation (links to routes that do not exist), dead buttons, actions shown to roles that the API will refuse.
- Responsiveness: layouts that break on phones or very wide screens (fixed widths, tables with no overflow-x wrapper, grids without responsive variants, text that cannot wrap, modals taller than the viewport with no scroll). Tailwind misuse that has a visible effect (conflicting classes, dynamic class names Tailwind cannot see).
- Accessibility that blocks use: inputs with no label, icon-only buttons with no accessible name, focus traps.
- Copy that misleads the user about what happened.
Mobile specific: keyboard covering inputs, safe-area overlap, Android back behaviour, platform APIs used wrongly for SDK 57, effects that refetch in loops.`

const FINDING = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'one-line statement of the defect' },
    severity: { type: 'string', enum: ['high', 'medium', 'low'] },
    category: { type: 'string', enum: ['security', 'api', 'data', 'ui', 'ux', 'responsive', 'a11y', 'mobile', 'perf'] },
    file: { type: 'string' },
    line: { type: 'integer' },
    trigger: { type: 'string', description: 'concrete steps or inputs that cause it' },
    impact: { type: 'string', description: 'what the user or school sees' },
    evidence: { type: 'string', description: 'the code facts that prove it, with file:line references' },
    fix: { type: 'string', description: 'the minimal fix' },
  },
  required: ['title', 'severity', 'category', 'file', 'line', 'trigger', 'impact', 'evidence', 'fix'],
}

const REVIEW = {
  type: 'object',
  properties: {
    files: {
      type: 'array',
      description: 'one entry for EVERY file in the slice',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          status: { type: 'string', enum: ['ok', 'issues'] },
          note: { type: 'string', description: 'at most 15 words on what you checked' },
        },
        required: ['path', 'status', 'note'],
      },
    },
    findings: { type: 'array', items: FINDING },
  },
  required: ['files', 'findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'refuted', 'not-worth-fixing'] },
    reasoning: { type: 'string', description: 'the path you traced, or why it fails' },
    file: { type: 'string' },
    line: { type: 'integer' },
    fix: { type: 'string', description: 'the minimal correct fix, naming every file to change' },
    severity: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['verdict', 'reasoning', 'file', 'line', 'fix', 'severity'],
}

const reviewPrompt = (slice, files) => `${CONTEXT}

You are a senior engineer doing a line-by-line review of one slice of this codebase. Slice ${slice.id} (${slice.name}), ${files.length} files:
${files.map(f => `- ${f}`).join('\n')}

Read EVERY file above in full. You may (and should) open other files to understand callers, callees, types and the API a screen talks to, but your report covers the files above. Do not edit any file and do not run commands that change the repository.

${CHECKLIST}

Return:
- files: one entry per file listed above (exact path), status "ok" or "issues", and a short note.
- findings: every concrete defect you found, each anchored to a file in this slice where possible. Prefer fewer, solid findings over many speculative ones; each must have a trigger a real user, school or attacker could hit. No duplicates.`

const gapPrompt = (slice, files) => `${CONTEXT}

A previous reviewer of slice ${slice.id} did not report on these files. Review each one in full (open callers and callees as needed). Do not edit anything.
${files.map(f => `- ${f}`).join('\n')}

${CHECKLIST}

Return files (one entry per file above) and findings (concrete defects only).`

const verifyPrompt = (f) => `${CONTEXT}

A reviewer reported this defect. Your job is to try to REFUTE it by reading the actual code on the current checkout. Default to "refuted" if you cannot trace a concrete path from a real user action or input to the failure.

Title: ${f.title}
Severity claimed: ${f.severity} (${f.category})
Location: ${f.file}:${f.line}
Trigger: ${f.trigger}
Impact: ${f.impact}
Evidence: ${f.evidence}
Proposed fix: ${f.fix}

Check: does the code really do this (read the file and its callers/callees)? Is the trigger realistic for this app? Is it already handled elsewhere (middleware, a wrapper, a database constraint, the client)? Is the impact real? Do not edit files.

Verdict:
- "confirmed": you traced it and it is real. Give the minimal correct fix naming every file to change, and a calibrated severity.
- "not-worth-fixing": real but far-fetched, or the fix costs more code than it saves.
- "refuted": wrong, already handled, or not reproducible. Say why.`

const slices = args.slices
const results = await pipeline(
  slices,
  (slice) => agent(reviewPrompt(slice, slice.files), { label: `review:${slice.id}`, phase: 'Review', schema: REVIEW, model: 'sonnet' }),
  async (review, slice) => {
    const reported = new Set((review?.files ?? []).map(f => f.path))
    const missing = slice.files.filter(f => !reported.has(f))
    let gap = null
    if (missing.length) {
      log(`${slice.id}: ${missing.length} file(s) not reported, sending a gap reviewer`)
      gap = await agent(gapPrompt(slice, missing), { label: `gap:${slice.id}`, phase: 'Gaps', schema: REVIEW, model: 'sonnet' })
    }
    const gapReported = new Set((gap?.files ?? []).map(f => f.path))
    const stillMissing = missing.filter(f => !gapReported.has(f))
    if (stillMissing.length) log(`${slice.id}: still unreported after gap pass: ${stillMissing.join(', ')}`)
    return {
      slice: slice.id,
      reviewDied: review === null,
      findings: [...(review?.findings ?? []), ...(gap?.findings ?? [])],
      fileNotes: [...(review?.files ?? []), ...(gap?.files ?? [])],
      stillMissing,
    }
  },
  async (r) => {
    const verdicts = await parallel(r.findings.map((f, i) => () =>
      agent(verifyPrompt(f), { label: `verify:${r.slice}#${i}`, phase: 'Verify', schema: VERDICT })
        .then(v => ({ ...f, verdict: v }))))
    return { ...r, verified: verdicts.filter(Boolean), verifyDied: verdicts.filter(v => !v).length }
  },
)

const done = results.filter(Boolean)
const confirmed = done.flatMap(r => r.verified.filter(f => f.verdict?.verdict === 'confirmed').map(f => ({ slice: r.slice, ...f })))
const notWorth = done.flatMap(r => r.verified.filter(f => f.verdict?.verdict === 'not-worth-fixing').map(f => ({ slice: r.slice, title: f.title, file: f.file, why: f.verdict.reasoning })))
const refuted = done.flatMap(r => r.verified.filter(f => f.verdict?.verdict === 'refuted').map(f => ({ slice: r.slice, title: f.title, file: f.file, why: f.verdict.reasoning })))
const coverage = done.map(r => ({ slice: r.slice, reviewDied: r.reviewDied, reported: r.fileNotes.length, stillMissing: r.stillMissing, findings: r.findings.length, verifyDied: r.verifyDied }))
const lostSlices = slices.filter((s, i) => !results[i]).map(s => s.id)
return { coverage, lostSlices, confirmed, notWorth, refuted }
