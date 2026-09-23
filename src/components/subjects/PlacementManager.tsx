"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, CircleAlert, CircleDashed, Layers, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
    MATHS_CODES,
    MATHS_LABELS,
    MINISTRY_COMBINATION_TEMPLATES,
    SENIOR_CORE_SUBJECT_CODES,
    type MathsCode,
} from '@/lib/pathway-definitions';
import CombinationChooser, { type ChoiceOption } from '@/components/subjects/CombinationChooser';
import {
    customCombinationCode,
    type ElectivePlacementResponse,
    type PlacementResponse,
    type PlacementTarget,
    type SchoolCombinationOption,
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

const OFFICIAL_BY_CODE = new Map(MINISTRY_COMBINATION_TEMPLATES.map(t => [t.code as string, t]));

/** Columns shared by the header and every row from `lg` up; below that each learner is a stacked card. */
const SENIOR_COLUMNS = 'lg:grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_13rem_minmax(0,1fr)] lg:gap-x-4';

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

/** What a learner's marks point to, as a chooser option — null when they point nowhere. */
function suggestionOption(row: SeniorLearnerRow, combinations: SchoolCombinationOption[]): ChoiceOption | null {
    const s = row.suggestion;
    if (s.kind !== 'official' && s.kind !== 'custom') return null;
    const existing = combinations.find(c => c.id === row.matchingCombinationId);
    if (existing) return { value: `existing:${existing.id}`, code: existing.code, name: existing.name, detail: 'Already set up at your school' };
    return s.kind === 'official'
        ? { value: `official:${s.code}`, code: s.code, name: s.name, detail: `Official · ${s.track} — added to your school when you place` }
        : { value: `custom:${s.electiveCodes.join(',')}`, code: customCombinationCode(s.electiveCodes), name: s.name, detail: 'Not on the Ministry list — added as a custom combination when you place' };
}

/** "CODE · name" for a choice, or null when nothing is chosen. */
function choiceLabel(choice: string, row: SeniorLearnerRow | null, combinations: SchoolCombinationOption[]): string | null {
    const value = choice.slice(choice.indexOf(':') + 1);
    if (choice.startsWith('existing:')) {
        const c = combinations.find(x => x.id === value);
        return c ? `${c.code} · ${c.name}` : null;
    }
    if (choice.startsWith('official:')) {
        const t = OFFICIAL_BY_CODE.get(value);
        return t ? `${t.code} · ${t.name}` : value;
    }
    if (choice.startsWith('custom:') && row?.suggestion.kind === 'custom') {
        return `${customCombinationCode(row.suggestion.electiveCodes)} · ${row.suggestion.name} (custom)`;
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
    if (s.kind === 'review') return <Badge tone="destructive" icon={CircleAlert} wrap>{s.reason}</Badge>;
    return <Badge tone="muted" icon={CircleDashed}>No marks yet — choose</Badge>;
}

function MathsSelect({ value, onChange, label, placeholder = 'Default' }: {
    value: MathsCode | '';
    onChange: (value: MathsCode | '') => void;
    label: string;
    placeholder?: string;
}) {
    return (
        <select className="input-field w-full text-sm" value={value} aria-label={label} onChange={e => onChange(e.target.value as MathsCode | '')}>
            <option value="">{placeholder}</option>
            {MATHS_CODES.map(code => <option key={code} value={code}>{MATHS_LABELS[code]}</option>)}
        </select>
    );
}

/** Chooser open for one learner, or for every ticked learner at once. */
type ChooserFor = { kind: 'row'; row: SeniorLearnerRow } | { kind: 'bulk' } | null;

function SeniorTable({ data, onApply, onError }: TableProps<SeniorPlacementResponse>) {
    const [drafts, setDrafts] = useState<Record<string, SeniorDraft>>({});
    const [chooser, setChooser] = useState<ChooserFor>(null);
    const [saving, setSaving] = useState(false);
    const offeredCodes = useMemo(() => new Set(data.offeredCodes), [data.offeredCodes]);

    useEffect(() => {
        setDrafts(Object.fromEntries(data.learners.map(l => [l.studentId, initialDraft(l)])));
    }, [data]);

    const update = (id: string, patch: Partial<SeniorDraft>) =>
        setDrafts(d => ({ ...d, [id]: { ...d[id], ...patch, include: patch.include ?? true } }));

    const ticked = data.learners.filter(l => drafts[l.studentId]?.include);
    const chosen = ticked.filter(l => drafts[l.studentId].choice);
    const missingChoice = ticked.length - chosen.length;
    const allTicked = data.learners.length > 0 && ticked.length === data.learners.length;
    const newCustom = new Set(chosen.map(l => drafts[l.studentId].choice).filter(c => c.startsWith('custom:')));

    const setForTicked = (patch: Partial<SeniorDraft>) =>
        setDrafts(d => Object.fromEntries(Object.entries(d).map(([id, draft]) => [id, draft.include ? { ...draft, ...patch } : draft])));

    const tickAll = (include: boolean) =>
        setDrafts(d => Object.fromEntries(Object.entries(d).map(([id, draft]) => [id, { ...draft, include }])));

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
    const chooserRow = chooser?.kind === 'row' ? chooser.row : null;

    return (
        <div className="card overflow-hidden">
            <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 text-xs sm:px-5">
                <Badge tone="positive" icon={CheckCircle2}>{counts.official ?? 0} official match</Badge>
                <Badge tone="caution" icon={CircleAlert}>{counts.custom ?? 0} not on Ministry list</Badge>
                <Badge tone="destructive" icon={CircleAlert}>{counts.review ?? 0} need review</Badge>
                <Badge tone="muted" icon={CircleDashed}>{counts['no-marks'] ?? 0} no marks yet</Badge>
            </div>

            {/* Bulk actions — ticking learners without marks and setting one combination is the fast path. */}
            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
                <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-5 accent-primary" checked={allTicked} onChange={e => tickAll(e.target.checked)} />
                    {ticked.length > 0 ? `${ticked.length} ticked` : 'Tick all'}
                </label>
                <div className="grid gap-2 sm:ml-auto sm:flex sm:items-center">
                    <button type="button" className="btn-secondary h-9 px-3 text-sm" disabled={ticked.length === 0} onClick={() => setChooser({ kind: 'bulk' })}>
                        <Layers size={14} aria-hidden /> Set combination for ticked
                    </button>
                    <div className="sm:w-52">
                        <MathsSelect
                            value=""
                            label="Set maths for ticked learners"
                            placeholder="Set maths for ticked…"
                            onChange={maths => { if (maths) setForTicked({ maths }); }}
                        />
                    </div>
                </div>
            </div>

            <div className={cn('hidden border-b border-border px-5 py-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase lg:grid', SENIOR_COLUMNS)}>
                <span aria-hidden />
                <span>Learner</span>
                <span>Electives &amp; maths with marks</span>
                <span>Combination</span>
                <span>Maths</span>
                <span>Status</span>
            </div>

            <ul className="divide-y divide-border">
                {data.learners.map(row => {
                    const draft = drafts[row.studentId];
                    if (!draft) return null;
                    const label = choiceLabel(draft.choice, row, data.combinations);
                    const marked = row.markedSubjects.filter(m => !COMPULSORY.has(m.code)).map(m => m.name).join(', ');
                    return (
                        <li
                            key={row.studentId}
                            className={cn('grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-4 sm:px-5 lg:items-center', SENIOR_COLUMNS, draft.include && 'bg-primary/5')}
                        >
                            <input
                                type="checkbox"
                                className="mt-0.5 size-5 accent-primary lg:mt-0"
                                aria-label={`Tick ${row.name}`}
                                checked={draft.include}
                                onChange={e => update(row.studentId, { include: e.target.checked })}
                            />
                            <div className="min-w-0">
                                <span className="block text-sm font-medium">{row.name}</span>
                                <span className="font-mono text-xs text-muted-foreground">{row.admissionNumber}</span>
                            </div>
                            <p className="col-start-2 text-xs text-muted-foreground lg:col-start-auto">
                                <span className="font-semibold lg:hidden">Marks in: </span>{marked || '—'}
                            </p>
                            <div className="col-start-2 lg:col-start-auto">
                                <button
                                    type="button"
                                    onClick={() => setChooser({ kind: 'row', row })}
                                    aria-label={`Combination for ${row.name}: ${label ?? 'none chosen'}`}
                                    className="input-field flex min-h-10 w-full items-center justify-between gap-2 text-left text-sm"
                                >
                                    <span className={cn('min-w-0 truncate', !label && 'text-muted-foreground')}>{label ?? 'Choose a combination…'}</span>
                                    <ChevronDown size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                                </button>
                                {draft.include && !draft.choice && (
                                    <p className="mt-1 text-xs text-caution">Pick a combination to place this learner.</p>
                                )}
                            </div>
                            <div className="col-start-2 lg:col-start-auto">
                                <MathsSelect value={draft.maths} label={`Maths for ${row.name}`} onChange={maths => update(row.studentId, { maths })} />
                            </div>
                            <div className="col-start-2 lg:col-start-auto"><SeniorStatus row={row} draft={draft} /></div>
                        </li>
                    );
                })}
            </ul>

            <footer className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs text-muted-foreground">
                    {missingChoice > 0 && <span className="text-caution">{missingChoice} ticked learner(s) still need a combination. </span>}
                    {newCustom.size > 0 && `${newCustom.size} custom combination(s) not on the Ministry list will be added to your school. `}
                    &ldquo;Default&rdquo; maths keeps what the learner takes now, else Core for STEM and Essential otherwise.
                </p>
                <button type="button" className="btn-primary h-10 w-full shrink-0 px-4 text-sm sm:h-9 sm:w-auto" disabled={saving || chosen.length === 0} onClick={submit}>
                    <Users size={14} aria-hidden /> {saving ? 'Placing…' : `Place ${chosen.length} learner${chosen.length === 1 ? '' : 's'}`}
                </button>
            </footer>

            <CombinationChooser
                open={chooser !== null}
                subject={chooserRow ? chooserRow.name : `${ticked.length} ticked learner${ticked.length === 1 ? '' : 's'}`}
                current={chooserRow ? drafts[chooserRow.studentId]?.choice ?? '' : ''}
                suggestion={chooserRow ? suggestionOption(chooserRow, data.combinations) : null}
                schoolCombinations={data.combinations}
                offeredCodes={offeredCodes}
                onPick={choice => {
                    if (chooserRow) update(chooserRow.studentId, { choice, include: choice !== '' });
                    else setForTicked({ choice });
                }}
                onClose={() => setChooser(null)}
            />
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
            <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
                Compulsory subjects list the whole class automatically. Tick the electives each student takes — pre-filled from the marks
                already recorded (<span className="font-semibold text-primary">•</span> marks a subject the student has marks in).
            </p>
            <ul className="divide-y divide-border">
                {data.learners.map(l => {
                    const set = picked[l.studentId] ?? new Set<string>();
                    const marked = new Set(l.markedSubjectIds);
                    return (
                        <li key={l.studentId} className={cn('grid gap-2 px-4 py-4 sm:px-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-center lg:gap-4', changed.includes(l) && 'bg-primary/5')}>
                            <div className="min-w-0">
                                <span className="block text-sm font-medium">{l.name}</span>
                                <span className="font-mono text-xs text-muted-foreground">{l.admissionNumber}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Electives for ${l.name}`}>
                                {data.electives.map(e => {
                                    const on = set.has(e.id);
                                    return (
                                        <button
                                            key={e.id}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => toggle(l.studentId, e.id)}
                                            className={cn(
                                                'min-h-9 rounded-full border px-3 text-xs transition-colors',
                                                on ? 'border-primary bg-primary/15 font-semibold text-primary' : 'border-border text-muted-foreground hover:border-primary/50',
                                            )}
                                        >
                                            {marked.has(e.id) && <span aria-label="has marks" className="mr-1 text-primary">•</span>}
                                            {e.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </li>
                    );
                })}
            </ul>
            <footer className="flex justify-end border-t border-border px-4 py-4 sm:px-5">
                <button type="button" className="btn-primary h-10 w-full px-4 text-sm sm:h-9 sm:w-auto" disabled={saving || changed.length === 0} onClick={submit}>
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

function Badge({ tone, icon: Icon, wrap = false, children }: {
    tone: keyof typeof BADGE_TONES;
    icon: typeof CheckCircle2;
    /** Let a long message wrap instead of running out of its column. */
    wrap?: boolean;
    children: ReactNode;
}) {
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', wrap ? 'rounded-lg' : 'whitespace-nowrap', BADGE_TONES[tone])}>
            <Icon size={12} className="shrink-0" aria-hidden /> {children}
        </span>
    );
}

