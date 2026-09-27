import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BadgeCheck, GraduationCap, SearchX } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';
import { getExamType } from '@/lib/exam-types';
import { loadVerifiedResults } from '@/lib/verify-results';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verify results · Skulbase',
  // A results page should never end up in a search index.
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-3 py-3 text-center">
      <div className="font-display text-xl font-bold leading-tight text-foreground tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * The page a report card's QR code opens.
 *
 * Read by a parent on a phone, with no account and often on a slow
 * connection, so it is a plain server-rendered page with no client JS. It
 * reads the results directly: it used to fetch its own API through the
 * request's Host header, an extra round trip that a forged header could point
 * at another site.
 */
export default async function VerifyResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { studentId } = await params;
  const sp = await searchParams;
  // `t`/`e` are the compact keys the QR uses; the long spellings keep older links working.
  const data = await loadVerifiedResults(studentId, {
    term: first(sp.t) ?? first(sp.term),
    examType: first(sp.e) ?? first(sp.examType),
  }).catch(() => null);

  if (!data) {
    return (
      <PageFrame>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground" aria-hidden>
            <SearchX className="size-7" />
          </span>
          <h1 className="font-display text-xl font-bold text-foreground">Results not found</h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            This code doesn&apos;t match any published results. Results only appear here once the school has approved them, so
            if the card is new, check with the school.
          </p>
          <Link href="/" className="btn-secondary mt-2 no-underline">Go to <Wordmark /></Link>
        </div>
      </PageFrame>
    );
  }

  const { school, student, summary } = data;
  const examLabel = data.examType ? getExamType(data.examType)?.name ?? data.examType : null;
  const heading = [examLabel, data.term, data.academicYear].filter(Boolean).join(' · ');
  const approvedOn = data.approvedAt
    ? new Date(data.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  // Sign-in goes via onboarding: an activated learner is sent straight on to
  // their results, and one who hasn't activated lands on the learner join form.
  const signInTarget = `/dashboard/onboarding?role=STUDENT&student=${encodeURIComponent(studentId)}&next=${encodeURIComponent('/student/results')}`;
  const firstName = student.name.split(' ')[0] || 'the learner';

  return (
    <PageFrame>
      <header className="flex items-center gap-3 border-b border-border pb-5">
        {school.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- school-uploaded logo on an arbitrary host
          <img src={school.logoUrl} alt="" className="size-12 shrink-0 rounded-xl object-contain" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
            <GraduationCap className="size-6" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold leading-tight text-foreground sm:text-xl">{school.name}</h1>
          {heading && <p className="text-xs text-muted-foreground">{heading}</p>}
        </div>
      </header>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <p className="text-sm leading-relaxed">
          <strong className="text-emerald-700 dark:text-emerald-400">Verified results.</strong>{' '}
          <span className="text-muted-foreground">These marks match the school&apos;s approved records{approvedOn && ` as of ${approvedOn}`}.</span>
        </p>
      </div>

      <section className="mt-5 rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="font-display text-base font-bold text-foreground">{student.name}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[student.className, student.admissionNumber && `Adm. ${student.admissionNumber}`].filter(Boolean).join(' · ')}
        </p>
      </section>

      <section aria-label="Summary" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Mean score" value={`${summary.mean}%`} />
        <SummaryTile label="Grade" value={summary.grade ?? '—'} />
        {summary.totalPoints != null && <SummaryTile label="Points" value={String(summary.totalPoints)} />}
        {summary.classRank != null && (
          <SummaryTile label="Position" value={`${summary.classRank}${summary.totalStudents ? ` / ${summary.totalStudents}` : ''}`} />
        )}
        <SummaryTile label="Subjects" value={String(summary.subjectCount)} />
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-border/70 bg-card">
        <h2 className="border-b border-border px-4 py-3 font-display text-sm font-bold text-foreground">Subject results</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Subject</th>
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Score</th>
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">%</th>
                <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.subjects.map((s, i) => (
                <tr key={`${s.subject}-${i}`}>
                  <td className="px-4 py-2.5">
                    <span className="text-foreground">{s.subject}</span>
                    {s.rubric && <span className="block text-[11px] text-muted-foreground">{s.rubric}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.score}<span className="text-muted-foreground">/{s.outOf}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.percentage}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{s.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* This page is one sitting; the learner's own account has every term, attendance and fees. */}
      <section className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-5 text-center">
        <h2 className="font-display text-sm font-bold text-foreground">Are you {firstName}?</h2>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Sign in to your student account to see every term&apos;s results, your subjects, attendance and fee statements.
        </p>
        <Link href={`/login?redirect_url=${encodeURIComponent(signInTarget)}`} className="btn-primary mt-3 no-underline">
          Sign in to your account
        </Link>
        <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
          Not activated yet? You&apos;ll just need the invite code from your school.
        </p>
      </section>

      <footer className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        <p>Scanned from a {school.name} report card.</p>
        <p className="mt-1">Powered by <Link href="/" className="font-semibold no-underline"><Wordmark /></Link></p>
      </footer>
    </PageFrame>
  );
}
