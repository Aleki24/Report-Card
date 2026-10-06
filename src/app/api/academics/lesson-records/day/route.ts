import { z } from 'zod';
import { HttpError, parseBody, route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { isoDate } from '@/lib/ops/zod-fields';
import { loadConfig, loadLessons, publishedVersionId } from '@/lib/timetable/server';
import { lessonTime } from '@/lib/timetable/layout';
import type { SchemeEntry } from '@/lib/ops/forms/academics';
import type { TeachingDay, TeachingDayLesson } from '@/lib/academics/teaching-day';

const db = () => createSupabaseAdmin();
const REQUIREMENT = { module: 'lesson_records', permission: 'lesson_records.write' } as const;

/** Monday 1 … Sunday 7, as the timetable counts days. */
const weekdayOf = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const STATUS_RANK: Record<string, number> = { APPROVED: 0, SUBMITTED: 1, RETURNED: 2, DRAFT: 3 };

type Entry = SchemeEntry & { id: string };
interface SchemeRow { id: string; title: string; status: string; subject_id: string; grade_stream_id: string; created_at: string; entries: Entry[] }

/** The teacher's scheme per class+subject (approved first, then newest) and the entries already taught. */
async function schemesFor(schoolId: string, teacherId: string, pairs: readonly { subject: string; stream: string }[]) {
    if (pairs.length === 0) return { scheme: () => null, taught: new Set<string>() };
    const { data, error } = await db().from('schemes_of_work')
        .select('id, title, status, subject_id, grade_stream_id, created_at, entries:scheme_entries(id, week, lesson, topic, sub_topic, objectives, activities, resources, assessment)')
        .eq('school_id', schoolId).eq('teacher_id', teacherId)
        .in('subject_id', [...new Set(pairs.map(p => p.subject))])
        .in('grade_stream_id', [...new Set(pairs.map(p => p.stream))]);
    if (error) throw error;
    const best = new Map<string, SchemeRow>();
    for (const s of (data ?? []) as unknown as SchemeRow[]) {
        const key = `${s.grade_stream_id}|${s.subject_id}`;
        const cur = best.get(key);
        const better = !cur || (STATUS_RANK[s.status] ?? 9) < (STATUS_RANK[cur.status] ?? 9)
            || ((STATUS_RANK[s.status] ?? 9) === (STATUS_RANK[cur.status] ?? 9) && s.created_at > cur.created_at);
        if (better) best.set(key, s);
    }
    const entryIds = [...best.values()].flatMap(s => s.entries.map(e => e.id));
    const taught = new Set<string>();
    if (entryIds.length) {
        const { data: done, error: doneError } = await db().from('records_of_work').select('scheme_entry_id').eq('school_id', schoolId).in('scheme_entry_id', entryIds);
        if (doneError) throw doneError;
        (done ?? []).forEach(r => r.scheme_entry_id && taught.add(r.scheme_entry_id as string));
    }
    return { scheme: (stream: string, subject: string) => best.get(`${stream}|${subject}`) ?? null, taught };
}

const byOrder = (a: Entry, b: Entry) => a.week - b.week || a.lesson - b.lesson;

/** GET ?date=YYYY-MM-DD — the signed-in teacher's lessons that day, joined to schemes, plans and records. */
export const GET = route('teaching day', REQUIREMENT, async ({ access, request }) => {
    const date = isoDate.parse(request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10));
    const versionId = access.hasModule('timetable') ? await publishedVersionId(access.schoolId) : null;
    if (!versionId) return { date, published: false, lessons: [] } satisfies TeachingDay;

    const [config, all] = await Promise.all([loadConfig(access.schoolId), loadLessons(versionId, { column: 'teacher_id', value: access.userId })]);
    const today = all
        .filter(l => l.day === weekdayOf(date))
        .map(l => ({ l, t: lessonTime(config, l) }))
        .filter((x): x is { l: typeof x.l; t: NonNullable<typeof x.t> } => x.t !== null)
        .sort((a, b) => a.t.start - b.t.start);

    // A double is one lesson to plan: merge back-to-back runs of the same class and subject.
    const runs: { first: (typeof today)[number]; end: number; periods: number }[] = [];
    for (const x of today) {
        const prev = runs[runs.length - 1];
        if (prev && prev.first.l.grade_stream_id === x.l.grade_stream_id && prev.first.l.subject_id === x.l.subject_id && x.t.start - prev.end <= 5) {
            prev.end = x.t.end;
            prev.periods++;
        } else runs.push({ first: x, end: x.t.end, periods: 1 });
    }

    const pairs = runs.map(r => ({ subject: r.first.l.subject_id, stream: r.first.l.grade_stream_id }));
    const [{ scheme, taught }, plans, records] = await Promise.all([
        schemesFor(access.schoolId, access.userId, pairs),
        db().from('lesson_plans').select('id, topic, subject_id, grade_stream_id').eq('school_id', access.schoolId).eq('teacher_id', access.userId).eq('lesson_date', date),
        db().from('records_of_work').select('id, work_covered, subject_id, grade_stream_id').eq('school_id', access.schoolId).eq('teacher_id', access.userId).eq('lesson_date', date),
    ]);
    if (plans.error || records.error) throw plans.error ?? records.error;

    // Two runs of one class+subject in a day take consecutive scheme lessons.
    const usedEntries = new Set<string>();
    const lessons: TeachingDayLesson[] = runs.map(({ first: { l, t }, end, periods }) => {
        const s = scheme(l.grade_stream_id, l.subject_id);
        const plan = (plans.data ?? []).find(p => p.subject_id === l.subject_id && p.grade_stream_id === l.grade_stream_id) ?? null;
        const record = (records.data ?? []).find(r => r.subject_id === l.subject_id && r.grade_stream_id === l.grade_stream_id) ?? null;
        const entry = s ? [...s.entries].sort(byOrder).find(e => !taught.has(e.id) && !usedEntries.has(e.id)) ?? null : null;
        if (entry) usedEntries.add(entry.id);
        return {
            lessonId: l.id, periods, start: hhmm(t.start), end: hhmm(end), label: t.label,
            subject: { id: l.subject_id, name: l.subject?.name ?? 'Lesson' },
            stream: { id: l.grade_stream_id, name: l.stream?.full_name ?? '' },
            room: l.room?.name ?? null,
            scheme: s ? { id: s.id, title: s.title, status: s.status } : null,
            entry,
            plan: plan ? { id: plan.id as string, topic: plan.topic as string } : null,
            record: record ? { id: record.id as string, work_covered: record.work_covered as string } : null,
        };
    });
    return { date, published: true, lessons } satisfies TeachingDay;
});

const actionSchema = z.object({
    action: z.enum(['plan', 'record']),
    date: isoDate,
    subject_id: z.string().uuid(),
    grade_stream_id: z.string().uuid(),
    scheme_entry_id: z.string().uuid().nullable().optional(),
});

const joinText = (...parts: (string | null | undefined)[]) => parts.map(p => p?.trim()).filter(Boolean).join(' — ') || null;

/**
 * POST — plan a lesson from its scheme entry, or mark it taught (a record of
 * work tied to the entry, so it counts towards coverage). Idempotent for a
 * class, subject and day.
 */
export const POST = route('teaching day action', REQUIREMENT, async ({ access, request }) => {
    const body = await parseBody(request, actionSchema);
    const owner = { school_id: access.schoolId, teacher_id: access.userId, subject_id: body.subject_id, grade_stream_id: body.grade_stream_id, lesson_date: body.date };

    // Only for a class and subject the teacher actually teaches.
    const [{ count: lessonsCount }, { count: schemesCount }] = await Promise.all([
        db().from('timetable_lessons').select('id', { count: 'exact', head: true }).eq('teacher_id', access.userId).eq('subject_id', body.subject_id).eq('grade_stream_id', body.grade_stream_id),
        db().from('schemes_of_work').select('id', { count: 'exact', head: true }).eq('school_id', access.schoolId).eq('teacher_id', access.userId).eq('subject_id', body.subject_id).eq('grade_stream_id', body.grade_stream_id),
    ]);
    if (!lessonsCount && !schemesCount) throw new HttpError(403, 'You do not teach this subject to this class.');

    let entry: Entry | null = null;
    if (body.scheme_entry_id) {
        const { data, error } = await db().from('scheme_entries')
            .select('id, week, lesson, topic, sub_topic, objectives, activities, resources, assessment, scheme:schemes_of_work!inner(teacher_id, school_id)')
            .eq('id', body.scheme_entry_id).eq('scheme.school_id', access.schoolId).eq('scheme.teacher_id', access.userId).maybeSingle();
        if (error) throw error;
        if (!data) throw new HttpError(400, 'Unknown scheme lesson.');
        entry = data as unknown as Entry;
    }

    if (body.action === 'plan') {
        const { data: existing } = await db().from('lesson_plans').select('id, topic').match(owner).limit(1).maybeSingle();
        if (existing) return existing;
        const { data, error } = await db().from('lesson_plans').insert({
            ...owner,
            scheme_entry_id: entry?.id ?? null,
            topic: joinText(entry?.topic, entry?.sub_topic) ?? 'Lesson',
            objectives: entry?.objectives ?? null,
            development: entry?.activities ?? null,
            resources: entry?.resources ?? null,
            conclusion: entry?.assessment ? `Assessment: ${entry.assessment}` : null,
        }).select('id, topic').single();
        if (error) throw error;
        return data;
    }

    const { data: existing } = await db().from('records_of_work').select('id, work_covered').match(owner).limit(1).maybeSingle();
    if (existing) return existing;
    const { data: plan } = await db().from('lesson_plans').select('topic, scheme_entry_id').match(owner).limit(1).maybeSingle();
    const { data, error } = await db().from('records_of_work').insert({
        ...owner,
        scheme_entry_id: entry?.id ?? (plan?.scheme_entry_id as string | null) ?? null,
        work_covered: joinText(entry?.topic, entry?.sub_topic) ?? (plan?.topic as string | undefined) ?? 'Lesson taught as planned',
    }).select('id, work_covered').single();
    if (error) throw error;
    return data;
});
