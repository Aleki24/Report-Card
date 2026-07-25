import Link from 'next/link';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Verify Results',
    // A results page should never end up in a search index.
    robots: { index: false, follow: false },
};

interface SubjectRow {
    subject: string;
    code: string | null;
    score: number;
    outOf: number;
    percentage: number;
    grade: string;
    rubric: string | null;
}

interface VerifyPayload {
    school: { name: string; logoUrl: string | null };
    student: { name: string; admissionNumber: string | null; className: string | null };
    term: string | null;
    academicYear: string | null;
    examType: string | null;
    approvedAt: string | null;
    subjects: SubjectRow[];
    summary: {
        mean: number;
        grade: string | null;
        totalPoints: number | null;
        subjectCount: number;
        classRank: number | null;
        totalStudents: number | null;
    };
}

const EXAM_TYPE_LABELS: Record<string, string> = {
    CAT: 'CAT', TOPICAL: 'Topical', MIDTERM: 'Midterm', ENDTERM: 'End Term',
    OPENER: 'Opener', MOCK: 'Mock', PRE_MOCK: 'Pre-Mock', POST_MOCK: 'Post-Mock',
    ZONE: 'Zone', SUB_COUNTY: 'Sub-County', COUNTY: 'County', REGIONAL: 'Regional', NATIONAL: 'National',
};

async function fetchResults(studentId: string, query: string): Promise<VerifyPayload | null> {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto = h.get('x-forwarded-proto') || 'https';
    if (!host) return null;

    const res = await fetch(`${proto}://${host}/api/verify/${studentId}${query}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
}

/**
 * The page a report card's QR code opens.
 *
 * Read by a parent on a phone, with no account and often on a slow connection,
 * so it is a plain server-rendered page: no auth, no client JS, one fetch.
 */
export default async function VerifyResultsPage({
    params,
    searchParams,
}: {
    params: Promise<{ studentId: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { studentId } = await params;
    const sp = await searchParams;

    const forwarded = new URLSearchParams();
    for (const key of ['term', 'examType'] as const) {
        const value = sp[key];
        if (typeof value === 'string' && value.trim()) forwarded.set(key, value);
    }
    const query = forwarded.toString() ? `?${forwarded.toString()}` : '';

    const data = await fetchResults(studentId, query);

    if (!data) {
        return (
            <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="text-4xl" aria-hidden>🔍</span>
                <h1 className="font-display text-xl font-bold">Results not found</h1>
                <p className="text-sm text-muted-foreground">
                    This code doesn&apos;t match any published results. Results appear here only once the
                    school has approved them — if the card is new, please check with the school.
                </p>
                <Link href="/" className="mt-2 text-sm font-semibold text-primary underline">
                    Go to SkulBase
                </Link>
            </main>
        );
    }

    const { school, student, summary } = data;
    const examLabel = data.examType ? EXAM_TYPE_LABELS[data.examType] || data.examType : null;
    const heading = [examLabel, data.term, data.academicYear].filter(Boolean).join(' · ');

    return (
        <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
            {/* School header */}
            <header className="mb-6 flex items-center gap-3 border-b border-border pb-5">
                {school.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={school.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" />
                ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl" aria-hidden>🎓</span>
                )}
                <div className="min-w-0">
                    <h1 className="truncate font-display text-lg font-bold leading-tight sm:text-xl">{school.name}</h1>
                    {heading && <p className="text-xs text-muted-foreground">{heading}</p>}
                </div>
            </header>

            {/* Verified stamp */}
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
                <span className="text-base leading-tight" aria-hidden>✅</span>
                <p className="text-xs leading-relaxed">
                    <strong className="text-emerald-600 dark:text-emerald-400">Verified results.</strong>{' '}
                    <span className="text-muted-foreground">
                        These marks match the school&apos;s approved records
                        {data.approvedAt && ` as of ${new Date(data.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}.
                    </span>
                </p>
            </div>

            {/* Student */}
            <section className="mb-6 rounded-xl border border-border bg-card p-4">
                <h2 className="font-display text-base font-bold">{student.name}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    {[student.className, student.admissionNumber && `Adm. ${student.admissionNumber}`].filter(Boolean).join(' · ')}
                </p>
            </section>

            {/* Summary */}
            <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryTile label="Mean score" value={`${summary.mean}%`} />
                <SummaryTile label="Grade" value={summary.grade || '—'} />
                {summary.totalPoints != null && <SummaryTile label="Points" value={String(summary.totalPoints)} />}
                <SummaryTile
                    label="Position"
                    value={summary.classRank ? `${summary.classRank}${summary.totalStudents ? ` / ${summary.totalStudents}` : ''}` : '—'}
                />
                <SummaryTile label="Subjects" value={String(summary.subjectCount)} />
            </section>

            {/* Subject breakdown */}
            <section className="overflow-hidden rounded-xl border border-border bg-card">
                <h2 className="border-b border-border px-4 py-3 font-display text-sm font-bold">Subject results</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/60">
                            <tr>
                                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Subject</th>
                                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Score</th>
                                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">%</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Grade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.subjects.map((s, i) => (
                                <tr key={`${s.subject}-${i}`}>
                                    <td className="px-4 py-2.5">
                                        {s.subject}
                                        {s.rubric && <div className="text-[11px] text-muted-foreground">{s.rubric}</div>}
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

            <footer className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                <p>Scanned from a {school.name} report card.</p>
                <p className="mt-1">
                    Powered by <Link href="/" className="font-semibold underline">SkulBase</Link>
                </p>
            </footer>
        </main>
    );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
            <div className="font-display text-lg font-bold leading-tight">{value}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
        </div>
    );
}
