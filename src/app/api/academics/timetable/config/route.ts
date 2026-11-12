import { z } from 'zod';
import { route, parseBody } from '@/lib/platform/access';
import { SUBJECT_TIMES, teacherOffSchema, timetableConfigSchema } from '@/lib/timetable/config';
import { MAX_RULES, doubleRulesSchema, timetableRuleSchema } from '@/lib/timetable/rules';
import { loadConfig, saveConfig } from '@/lib/timetable/server';

export const GET = route('timetable config', { module: 'timetable', permission: 'timetable.view' }, ({ access }) => loadConfig(access.schoolId));

/**
 * PUT — the school day: days, bells and sections. The rules (teachers' times
 * away, subjects' times of day, the longest run, filling free periods) are
 * kept as stored: they change with PATCH, so a day editor opened earlier
 * never undoes them.
 */
export const PUT = route('timetable config save', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const [config, current] = await Promise.all([parseBody(request, timetableConfigSchema), loadConfig(access.schoolId)]);
    return saveConfig(access.schoolId, { ...config, rules: current.rules });
});

const patchSchema = z.object({
    /** Replaces every time away of the teachers named here; other teachers keep theirs. */
    teacher_off: z.object({ teacher_ids: z.array(z.string().min(1).max(64)).min(1).max(200), times: z.array(teacherOffSchema).max(500) }).optional(),
    /** Subjects' times of day to set (`any`: no preference, even for maths). */
    subject_times: z.record(z.string().min(1).max(64), z.enum(SUBJECT_TIMES)).optional(),
    max_consecutive: z.number().int().min(1).max(12).optional(),
    /** Fill classes' free periods with extra lessons when generating. */
    fill_free_periods: z.boolean().optional(),
    /** The school's own rules, the whole list. */
    relations: z.array(timetableRuleSchema).max(MAX_RULES).optional(),
    /** Built-in rules on doubles to switch on or off. */
    doubles: doubleRulesSchema.partial().optional(),
    /** Subjects whose doubles may run across a short break, the whole list. */
    span_short_break: z.array(z.string().min(1).max(64)).max(200).optional(),
});

/** PATCH — teachers' times away, subjects' times of day, the longest run of lessons, filling free periods, or the school's rules. */
export const PATCH = route('timetable config rules', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const body = await parseBody(request, patchSchema);
    const current = await loadConfig(access.schoolId);
    const rules = { ...current.rules };
    if (body.teacher_off) {
        const named = new Set(body.teacher_off.teacher_ids);
        rules.teacher_off = [...rules.teacher_off.filter(t => !named.has(t.teacher_id)), ...body.teacher_off.times.filter(t => named.has(t.teacher_id))];
    }
    if (body.subject_times) rules.subject_times = { ...rules.subject_times, ...body.subject_times };
    if (body.max_consecutive) rules.max_consecutive = body.max_consecutive;
    if (body.fill_free_periods !== undefined) rules.fill_free_periods = body.fill_free_periods;
    if (body.relations) rules.relations = body.relations;
    if (body.doubles) rules.doubles = { ...rules.doubles, ...body.doubles };
    if (body.span_short_break) rules.span_short_break = [...new Set(body.span_short_break)];
    return saveConfig(access.schoolId, timetableConfigSchema.parse({ ...current, rules }));
});
