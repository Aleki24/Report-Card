"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, CircleDashed, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api-error-message';
import { MATHS_LABELS, SENIOR_CORE_SUBJECT_CODES, type MathsCode } from '@/lib/pathway-definitions';
import {
    customCombinationCode,
    type ElectivePlacementResponse,
    type PlacementResponse,
    type PlacementTarget,
    type SeniorLearnerRow,
    type SeniorPlacementResponse,
} from '@/lib/pathway/placement';

type Grade = { id: string; name_display: string; academic_level_id: string; numeric_order: number };
type Stream = { id: string; full_name: string; grade_id: string };
type Level = { id: string; code: string };

type Props = { grades: Grade[]; streams: Stream[]; academicLevels: Level[] };

/** Placement applies to CBC Senior School (Grades 10-12) and every 8-4-4 class. */
function placeableStreams({ grades, streams, academicLevels }: Props): Stream[] {
    const codeByLevel = new Map(academicLevels.map(l => [l.id, l.code]));
    const eligible = new Set(
        grades
            .filter(g => {
                const code = codeByLevel.get(g.academic_level_id);
                return code === '844' || (code === 'CBC' && g.numeric_order >= 10 && g.numeric_order <= 12);
            })
            .map(g => g.id),
    );
    return streams.filter(s => eligible.has(s.grade_id)).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export default function PlacementManager(props: Props) {
    const streams = useMemo(() => placeableStreams(props), [props]);
    const [streamId, setStreamId] = useState('');
    const [data, setData] = useState<PlacementResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const load = async (id: string) => {
        setData(null);
        setMsg('');
        if (!id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/placement?grade_stream_id=${id}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load the class'));
            setData(json as PlacementResponse);
        } catch (err) {
            setMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const apply = async (body: object, summary: string) => {
        setMsg('');
        const res = await fetch('/api/admin/placement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grade_stream_id: streamId, ...body }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not save'));
        setMsg(summary + (json.combinationsCreated ? ` ${json.combinationsCreated} new combination(s) were added to your school.` : ''));
        await load(streamId);
    };

    return (
        <section className="flex flex-col gap-5" aria-labelledby="placement-heading">
            <div className="card p-5">
                <h3 id="placement-heading" className="flex items-center gap-2 text-sm font-bold">
                    <Sparkles size={16} className="text-primary" aria-hidden /> Place learners from their marks
                </h3>
                <p className="mt-1 mb-4 max-w-3xl text-xs text-muted-foreground">
                    Teachers only record marks for learners who take a subject, so those marks show what each learner studies.
                    Pick a class, check the suggestions, adjust anything that is wrong, and apply. Nothing changes until you apply.
                    CBC Senior School learners get a combination and a maths; 8-4-4 students get the electives they take.
                </p>
                <label className="block w-full sm:w-72">
                    <span className="mb-2 block text-xs font-medium text-muted-foreground">Class</span>
                    <select
                        className="input-field w-full text-sm"
                        value={streamId}
                        onChange={e => { setStreamId(e.target.value); void load(e.target.value); }}
                    >
                        <option value="">Select a Senior School or 8-4-4 class…</option>
                        {streams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                </label>
                {streams.length === 0 && (
                    <p className="mt-3 text-xs text-caution">No CBC Grade 10-12 or 8-4-4 classes found.</p>
                )}
            </div>

            {msg && (
                <p role="status" className={cn('rounded-md border p-3 text-sm', msg.startsWith('Failed') ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-positive/30 bg-positive/10 text-positive')}>
                    {msg}
                </p>
            )}

            {loading && <p className="text-sm text-muted-foreground">Reading this class&apos;s marks…</p>}
            {data?.mode === 'senior' && <SeniorTable data={data} onApply={apply} onError={m => setMsg(`Failed: ${m}`)} />}
            {data?.mode === '844' && <ElectiveTable data={data} onApply={apply} onError={m => setMsg(`Failed: ${m}`)} />}
        </section>
    );
}

// ── CBC Senior School ───────────────────────────────────────────────────

type SeniorDraft = { include: boolean; choice: string; maths: MathsCode | '' };

/** Everyone takes these, so they say nothing about a learner's placement. */
const COMPULSORY = new Set<string>(SENIOR_CORE_SUBJECT_CODES);
type ApplyFn = (body: object, summary: string) => Promise<void>;
type TableProps<T> = { data: T; onApply: ApplyFn; onError: (msg: string) => void };

/** Select values: "existing:<id>", "official:<code>", or "custom:<code,code,code>". */
function suggestedChoice(row: SeniorLearnerRow): string {
    if (row.matchingCombinationId) return `existing:${row.matchingCombinationId}`;
    if (row.suggestion.kind === 'official') return `official:${row.suggestion.code}`;
    if (row.suggestion.kind === 'custom') return `custom:${row.suggestion.electiveCodes.join(',')}`;
    return row.currentCombinationId ? `existing:${row.currentCombinationId}` : '';
}

function initialDraft(row: SeniorLearnerRow): SeniorDraft {
    const choice = suggestedChoice(row);
    const maths = row.currentMaths ?? (row.suggestion.kind === 'no-marks' ? null : row.suggestion.maths) ?? '';
    const alreadyThere = choice === `existing:${row.currentCombinationId}` && (maths === '' || maths === row.currentMaths);
    const confident = row.suggestion.kind === 'official' || row.suggestion.kind === 'custom';
    return { include: confident && !alreadyThere && choice !== '', choice, maths };
}

function toTarget(choice: string, row: SeniorLearnerRow): PlacementTarget | null {
    const [type, value] = [choice.slice(0, choice.indexOf(':')), choice.slice(choice.indexOf(':') + 1)];
    if (type === 'existing') return { type: 'existing', combinationId: value };
    if (type === 'official') return { type: 'official', code: value };
    if (type === 'custom' && row.suggestion.kind === 'custom') {
        return { type: 'custom', electiveCodes: row.suggestion.electiveCodes, pathway: row.suggestion.pathway, name: row.suggestion.name };
    }
    return null;
}

function SeniorStatus({ row, draft }: { row: SeniorLearnerRow; draft: SeniorDraft }) {
    const s = row.suggestion;
    if (row.currentCombinationId && draft.choice === `existing:${row.currentCombinationId}` && !draft.include) {
        return <Badge tone="muted" icon={CheckCircle2}>Placed</Badge>;
    }
    if (s.kind === 'official') return <Badge tone="positive" icon={CheckCircle2}>Official {s.code}</Badge>;
    if (s.kind === 'custom') return <Badge tone="caution" icon={CircleAlert}>Not on Ministry list</Badge>;
    if (s.kind === 'review') return <Badge tone="destructive" icon={CircleAlert}>{s.reason}</Badge>;
    return <Badge tone="muted" icon={CircleDashed}>No marks yet — choose</Badge>;
}

function SeniorTable({ data, onApply, onError }: TableProps<SeniorPlacementResponse>) {
    const [drafts, setDrafts] = useState<Record<string, SeniorDraft>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDrafts(Object.fromEntries(data.learners.map(l => [l.studentId, initialDraft(l)])));
    }, [data]);

    const update = (id: string, patch: Partial<SeniorDraft>) =>
        setDrafts(d => ({ ...d, [id]: { ...d[id], ...patch, include: patch.include ?? true } }));

    const chosen = data.learners.filter(l => drafts[l.studentId]?.include && drafts[l.studentId]?.choice);
    const newCustom = new Set(
        chosen.filter(l => drafts[l.studentId].choice.startsWith('custom:')).map(l => drafts[l.studentId].choice),
    );

    const submit = async () => {
        setSaving(true);
        try {
            const placements = chosen.flatMap(l => {
                const draft = drafts[l.studentId];
                const target = toTarget(draft.choice, l);
                return target ? [{ student_id: l.studentId, target, maths: draft.maths || null }] : [];
            });
            await onApply({ mode: 'senior', placements }, `Placed ${placements.length} learner(s).`);
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setSaving(false);
        }
    };

    const counts = data.learners.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.suggestion.kind]: (acc[l.suggestion.kind] ?? 0) + 1 }), {});

    return (
        <div className="card overflow-hidden">
            <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3 text-xs">
                <Badge tone="positive" icon={CheckCircle2}>{counts.official ?? 0} official match</Badge>
                <Badge tone="caution" icon={CircleAlert}>{counts.custom ?? 0} not on Ministry list</Badge>
                <Badge tone="destructive" icon={CircleAlert}>{counts.review ?? 0} need review</Badge>
                <Badge tone="muted" icon={CircleDashed}>{counts['no-marks'] ?? 0} no marks yet</Badge>
            </div>

            <div className="overflow-x-auto">
                <table className="data-table w-full min-w-[56rem] text-left">
                    <thead>
                        <tr>
                            <th className="w-10"><span className="sr-only">Include</span></th>
                            <th>Learner</th>
                            <th>Electives &amp; maths with marks</th>
                            <th>Combination</th>
                            <th>Maths</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.learners.map(row => {
                            const draft = drafts[row.studentId];
                            if (!draft) return null;
                            const s = row.suggestion;
                            const suggestionOption = draft.choice.startsWith('official:') || draft.choice.startsWith('custom:')
                                ? draft.choice
                                : s.kind === 'official' && !row.matchingCombinationId ? `official:${s.code}`
                                : s.kind === 'custom' && !row.matchingCombinationId ? `custom:${s.electiveCodes.join(',')}` : null;
                            return (
                                <tr key={row.studentId} className={cn(draft.include && 'bg-primary/5')}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            className="size-4 accent-primary"
                                            aria-label={`Include ${row.name}`}
                                            checked={draft.include}
                                            disabled={!draft.choice}
                                            onChange={e => update(row.studentId, { include: e.target.checked })}
                                        />
                                    </td>
                                    <td>
                                        <span className="block text-sm font-medium">{row.name}</span>
                                        <span className="font-mono text-xs text-muted-foreground">{row.admissionNumber}</span>
                                    </td>
                                    <td className="max-w-64 text-xs text-muted-foreground">
                                        {row.markedSubjects.filter(m => !COMPULSORY.has(m.code)).map(m => m.name).join(', ') || '—'}
                                    </td>
                                    <td>
                                        <select
                                            className="input-field w-full min-w-56 text-sm"
                                            value={draft.choice}
                                            aria-label={`Combination for ${row.name}`}
                                            onChange={e => update(row.studentId, { choice: e.target.value })}
                                        >
                                            <option value="">Choose…</option>
                                            {suggestionOption && s.kind !== 'no-marks' && s.kind !== 'review' && (
                                                <option value={suggestionOption}>
                                                    New: {s.kind === 'official' ? s.code : customCombinationCode(s.electiveCodes)} · {s.name}
                                                    {s.kind === 'custom' ? ' (custom)' : ''}
                                                </option>
                                            )}
                                            {data.combinations.map(c => (
                                                <option key={c.id} value={`existing:${c.id}`}>{c.code} · {c.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <select
                                            className="input-field w-full min-w-40 text-sm"
                                            value={draft.maths}
                                            aria-label={`Maths for ${row.name}`}
                                            onChange={e => update(row.studentId, { maths: e.target.value as MathsCode | '' })}
                                        >
                                            <option value="">Default</option>
                                            {(Object.keys(MATHS_LABELS) as MathsCode[]).map(code => (
                                                <option key={code} value={code}>{MATHS_LABELS[code]}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td><SeniorStatus row={row} draft={draft} /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
                <p className="text-xs text-muted-foreground">
                    {newCustom.size > 0 && `${newCustom.size} custom combination(s) not on the Ministry list will be added to your school. `}
                    &ldquo;Default&rdquo; maths keeps what the learner takes now, else Core for STEM and Essential otherwise.
                </p>
                <button type="button" className="btn-primary h-9 px-4 text-sm" disabled={saving || chosen.length === 0} onClick={submit}>
                    <Users size={14} aria-hidden /> {saving ? 'Placing…' : `Place ${chosen.length} learner${chosen.length === 1 ? '' : 's'}`}
                </button>
            </footer>
        </div>
    );
}

// ── 8-4-4 electives ─────────────────────────────────────────────────────

function ElectiveTable({ data, onApply, onError }: TableProps<ElectivePlacementResponse>) {
    const [picked, setPicked] = useState<Record<string, ReadonlySet<string>>>({});
    const [saving, setSaving] = useState(false);

    // Start from what is enrolled; a learner with no enrolments starts from their marks.
    useEffect(() => {
        setPicked(Object.fromEntries(data.learners.map(l => [
            l.studentId,
            new Set(l.enrolledSubjectIds.length > 0 ? l.enrolledSubjectIds : l.markedSubjectIds),
        ])));
    }, [data]);

    const same = (a: ReadonlySet<string>, b: readonly string[]) => a.size === b.length && b.every(id => a.has(id));
    const changed = data.learners.filter(l => picked[l.studentId] && !same(picked[l.studentId], l.enrolledSubjectIds));

    const toggle = (studentId: string, subjectId: string) =>
        setPicked(p => {
            const next = new Set(p[studentId]);
            if (next.has(subjectId)) next.delete(subjectId); else next.add(subjectId);
            return { ...p, [studentId]: next };
        });

    const submit = async () => {
        setSaving(true);
        try {
            const enrolments = changed.map(l => ({ student_id: l.studentId, subject_ids: [...picked[l.studentId]] }));
            await onApply({ mode: '844', enrolments }, `Saved electives for ${enrolments.length} student(s).`);
        } catch (err) {
            onError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setSaving(false);
        }
    };

    if (data.electives.length === 0) {
        return <p className="card p-5 text-sm text-muted-foreground">Your school offers no 8-4-4 electives — every subject is compulsory, so every student is on every mark sheet.</p>;
    }

    return (
        <div className="card overflow-hidden">
            <p className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
                Compulsory subjects list the whole class automatically. Tick the electives each student takes — pre-filled from the marks
                already recorded (<span className="font-semibold text-primary">•</span> marks a subject the student has marks in).
            </p>
            <div className="overflow-x-auto">
                <table className="data-table w-full min-w-[40rem] text-left">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Electives taken</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.learners.map(l => {
                            const set = picked[l.studentId] ?? new Set<string>();
                            const marked = new Set(l.markedSubjectIds);
                            return (
                                <tr key={l.studentId} className={cn(changed.includes(l) && 'bg-primary/5')}>
                                    <td className="whitespace-nowrap">
                                        <span className="block text-sm font-medium">{l.name}</span>
                                        <span className="font-mono text-xs text-muted-foreground">{l.admissionNumber}</span>
                                    </td>
                                    <td>
                                        <div className="flex flex-wrap gap-1.5">
                                            {data.electives.map(e => {
                                                const on = set.has(e.id);
                                                return (
                                                    <button
                                                        key={e.id}
                                                        type="button"
                                                        aria-pressed={on}
                                                        onClick={() => toggle(l.studentId, e.id)}
                                                        className={cn(
                                                            'min-h-8 rounded-full border px-2.5 text-xs transition-colors',
                                                            on ? 'border-primary bg-primary/15 font-semibold text-primary' : 'border-border text-muted-foreground hover:border-primary/50',
                                                        )}
                                                    >
                                                        {marked.has(e.id) && <span aria-label="has marks" className="mr-1 text-primary">•</span>}
                                                        {e.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <footer className="flex justify-end border-t border-border px-5 py-4">
                <button type="button" className="btn-primary h-9 px-4 text-sm" disabled={saving || changed.length === 0} onClick={submit}>
                    {saving ? 'Saving…' : `Save electives for ${changed.length} student${changed.length === 1 ? '' : 's'}`}
                </button>
            </footer>
        </div>
    );
}

// ── Shared ──────────────────────────────────────────────────────────────

const BADGE_TONES = {
    positive: 'bg-positive/10 text-positive',
    caution: 'bg-caution/10 text-caution',
    destructive: 'bg-destructive/10 text-destructive',
    muted: 'bg-muted text-muted-foreground',
} as const;

function Badge({ tone, icon: Icon, children }: { tone: keyof typeof BADGE_TONES; icon: typeof CheckCircle2; children: ReactNode }) {
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', BADGE_TONES[tone])}>
            <Icon size={12} aria-hidden /> {children}
        </span>
    );
}

