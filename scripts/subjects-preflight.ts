/**
 * Read-only pre-flight for the school_subjects migration.
 *
 * Writes nothing. Reports exactly what the migration would touch, so the
 * destructive steps can be reviewed before they run rather than after:
 *
 *   1. What deleting the abandoned duplicate school removes, row by row.
 *   2. The ownerless subject rows and whether anything still references them.
 *   3. The mis-coded rows that need repairing before dedupe.
 *   4. Per school: which subject codes map onto the standard catalogue, and
 *      which would stay as that school's own custom subjects.
 *   5. Every dependent-row repoint a merge would perform.
 *
 * Run: npx tsx scripts/subjects-preflight.ts
 */

import { createClient } from '@supabase/supabase-js';
import { PREDEFINED_SUBJECTS } from '../src/lib/subject-definitions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error(
        'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.\n' +
        'This script is read-only, but the service role key must not be hard-coded into it.',
    );
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

/** The abandoned May duplicate. Never the live school. */
const DOOMED_SCHOOL_ID = 'b9e20066-0fd3-48ec-b731-56f14bb4413e';
const DOOMED_SCHOOL_NAME = 'Sathya Sai School Kisaju';

/** Every table that points at subjects(id), with its delete rule. */
const SUBJECT_DEPENDENTS = [
    'exams',
    'exam_mark_components',
    'exam_subject_component_schemes',
    'performance_history',
    'report_card_subjects',
    'student_goals',
    'student_subjects',
    'subject_combination_subjects',
    'subject_teacher_assignments',
] as const;

const norm = (s: string | null | undefined) => (s || '').trim().toUpperCase();

const CATALOGUE_BY_CODE = new Map(PREDEFINED_SUBJECTS.map(s => [norm(s.code), s]));

function heading(text: string) {
    console.log(`\n${'='.repeat(72)}\n${text}\n${'='.repeat(72)}`);
}

async function countRefs(subjectId: string): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const table of SUBJECT_DEPENDENTS) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('subject_id', subjectId);
        // A table that does not exist on this instance is not a failure; it is
        // simply one fewer thing to repoint.
        if (!error) out[table] = count ?? 0;
    }
    return out;
}

/**
 * Which classes actually sit this subject, and how many of those exams were
 * ever marked. An exam slot seeded for every grade says nothing; a marked one
 * is a person's work and is the evidence of what the subject really is.
 */
async function gradesTaughtIn(subjectId: string, markedOnly = false): Promise<string> {
    const { data } = await supabase
        .from('exams')
        .select('id, grade_id, grade_streams(grade_id)')
        .eq('subject_id', subjectId);
    if (!data?.length) return '';

    const gradeIds = new Set<string>();
    for (const row of data) {
        if (markedOnly) {
            const { count } = await supabase
                .from('exam_marks')
                .select('*', { count: 'exact', head: true })
                .eq('exam_id', row.id);
            if (!count) continue;
        }
        const embedded = row.grade_streams as { grade_id?: string } | null;
        const id = row.grade_id || embedded?.grade_id;
        if (id) gradeIds.add(id);
    }
    if (!gradeIds.size) return '';

    const { data: grades } = await supabase
        .from('grades')
        .select('name_display')
        .in('id', [...gradeIds]);
    return (grades || []).map(g => g.name_display).sort().join(', ');
}

async function markedExamCount(subjectId: string): Promise<number> {
    const { data } = await supabase.from('exams').select('id').eq('subject_id', subjectId);
    let marked = 0;
    for (const exam of data || []) {
        const { count } = await supabase
            .from('exam_marks')
            .select('*', { count: 'exact', head: true })
            .eq('exam_id', exam.id);
        if ((count ?? 0) > 0) marked++;
    }
    return marked;
}

async function reportDoomedSchool() {
    heading('1. What deleting the abandoned duplicate school removes');

    const { data: school } = await supabase
        .from('schools')
        .select('id, name, approval_status, onboarding_completed, created_at')
        .eq('id', DOOMED_SCHOOL_ID)
        .maybeSingle();

    if (!school) {
        console.log('  Already gone — nothing to delete.');
        return;
    }

    if (school.name !== DOOMED_SCHOOL_NAME) {
        console.log(
            `  REFUSING TO PROCEED: id ${DOOMED_SCHOOL_ID} is named "${school.name}",` +
            ` expected "${DOOMED_SCHOOL_NAME}". Verify before deleting anything.`,
        );
        return;
    }

    console.log(`  School:     ${school.name} (${school.id})`);
    console.log(`  Created:    ${school.created_at}`);
    console.log(`  Onboarded:  ${school.onboarding_completed}`);

    for (const table of ['users', 'students', 'exams', 'grade_streams', 'grades'] as const) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('school_id', school.id);
        if (!error) console.log(`  ${table.padEnd(14)} ${count ?? 0}`);
    }

    // Marks hang off exams, not the school, so they need the join.
    const { data: examIds } = await supabase
        .from('exams')
        .select('id')
        .eq('school_id', school.id);
    const ids = (examIds || []).map(e => e.id);
    if (ids.length) {
        const { count } = await supabase
            .from('exam_marks')
            .select('*', { count: 'exact', head: true })
            .in('exam_id', ids);
        console.log(`  exam_marks     ${count ?? 0}`);
    }
}

async function reportOwnerlessRows() {
    heading('2. Ownerless subject rows (school_id IS NULL)');

    const { data: rows } = await supabase
        .from('subjects')
        .select('id, code, name')
        .is('school_id', null)
        .order('code');

    if (!rows?.length) {
        console.log('  None.');
        return;
    }

    console.log(`  ${rows.length} rows. Reference counts AFTER the school delete above:\n`);
    let stillReferenced = 0;

    for (const row of rows) {
        const refs = await countRefs(row.id);
        const live = Object.entries(refs).filter(([, n]) => n > 0);
        const total = live.reduce((sum, [, n]) => sum + n, 0);
        if (total > 0) stillReferenced++;
        const detail = live.length ? live.map(([t, n]) => `${t}=${n}`).join(' ') : 'unreferenced';
        console.log(`  ${norm(row.code).padEnd(16)} ${(row.name || '').padEnd(32)} ${detail}`);
    }

    console.log(
        `\n  ${rows.length - stillReferenced} of ${rows.length} are unreferenced today.` +
        '\n  Any still referenced belong to the doomed school and become unreferenced once it goes.',
    );
}

async function reportMiscodedRows() {
    heading('3. Rows whose code does not match the catalogue');

    const { data: rows } = await supabase
        .from('subjects')
        .select('id, code, name, school_id')
        .not('school_id', 'is', null)
        .order('code');

    for (const row of rows || []) {
        const code = norm(row.code);
        if (CATALOGUE_BY_CODE.has(code)) continue;

        const refs = await countRefs(row.id);
        const total = Object.values(refs).reduce((a, b) => a + b, 0);

        // Deliberately NOT matched by name.
        //
        // A name match is what a careless repair looks like: this row's name is
        // "Mathematics", which matches the catalogue's Lower Primary MATH_LP,
        // while its exams are all Grade 10 — it is Senior School's Essential
        // Mathematics. Acting on that match would have mis-levelled 70 exams
        // into Lower Primary, which is the exact bug this migration exists to
        // remove. So report where the subject is actually TAUGHT and let a
        // person decide; usage is evidence, a name is a coincidence.
        // Exam slots were seeded for every grade, so "has an exam" proves
        // nothing. Only a grade where somebody actually entered marks is
        // evidence of where the subject is really taught.
        const marked = await markedExamCount(row.id);
        const gradesMarked = await gradesTaughtIn(row.id, true);
        console.log(
            `  ${code.padEnd(16)} ${(row.name || '').padEnd(26)} exams=${String(total).padEnd(5)}` +
            ` marked=${String(marked).padEnd(3)} marks recorded in: ${gradesMarked || '(none — no evidence either way)'}`,
        );
    }

    // Codes used more than once inside one school: these collide on merge.
    const seen = new Map<string, { code: string; name: string; id: string }[]>();
    for (const row of rows || []) {
        const key = `${row.school_id}:${norm(row.code)}`;
        const list = seen.get(key) ?? [];
        list.push({ code: norm(row.code), name: row.name, id: row.id });
        seen.set(key, list);
    }
    const clashes = [...seen.values()].filter(v => v.length > 1);
    if (clashes.length) {
        console.log('\n  Codes reused within a single school (must be repaired before dedupe):');
        for (const group of clashes) {
            for (const r of group) {
                const refs = await countRefs(r.id);
                const total = Object.values(refs).reduce((a, b) => a + b, 0);
                console.log(`    ${r.code.padEnd(16)} ${r.name.padEnd(32)} refs=${total}  id=${r.id}`);
            }
        }
    }
}

async function reportPerSchoolMapping() {
    heading('4. Per school: catalogue matches vs custom subjects');

    const { data: schools } = await supabase.from('schools').select('id, name').order('created_at');

    for (const school of schools || []) {
        const { data: rows } = await supabase
            .from('subjects')
            .select('id, code, name, grading_system_id')
            .eq('school_id', school.id)
            .order('code');

        if (!rows?.length) {
            console.log(`\n  ${school.name}: no subjects`);
            continue;
        }

        const matched = rows.filter(r => CATALOGUE_BY_CODE.has(norm(r.code)));
        const custom = rows.filter(r => !CATALOGUE_BY_CODE.has(norm(r.code)));
        const graded = rows.filter(r => r.grading_system_id).length;

        console.log(`\n  ${school.name} (${school.id})`);
        console.log(`    ${rows.length} subjects — ${matched.length} map to the catalogue, ${custom.length} custom`);
        console.log(`    ${graded} carry a grading system (each becomes one school_subjects row)`);
        if (custom.length) {
            console.log(`    custom: ${custom.map(r => norm(r.code)).join(', ')}`);
        }
    }
}

async function reportMergePlan() {
    heading('5. Merges: one catalogue row per code, and what gets repointed');

    const { data: rows } = await supabase
        .from('subjects')
        .select('id, code, name, school_id')
        .not('school_id', 'is', null);

    const byCode = new Map<string, typeof rows>();
    for (const row of rows || []) {
        const code = norm(row.code);
        const list = byCode.get(code) ?? [];
        list!.push(row);
        byCode.set(code, list);
    }

    let merges = 0;
    let repoints = 0;

    for (const [code, group] of [...byCode].sort()) {
        if (!group || group.length < 2) continue;
        merges++;

        const scored = [];
        for (const row of group) {
            const refs = await countRefs(row.id);
            scored.push({ row, total: Object.values(refs).reduce((a, b) => a + b, 0), refs });
        }
        scored.sort((a, b) => b.total - a.total);

        const [winner, ...losers] = scored;
        console.log(`\n  ${code} — ${group.length} copies`);
        console.log(`    keep   ${winner.row.id}  school=${winner.row.school_id}  refs=${winner.total}`);
        for (const loser of losers) {
            const detail = Object.entries(loser.refs)
                .filter(([, n]) => n > 0)
                .map(([t, n]) => `${t}=${n}`)
                .join(' ') || 'nothing to repoint';
            console.log(`    merge  ${loser.row.id}  school=${loser.row.school_id}  ${detail}`);
            repoints += loser.total;
        }
    }

    console.log(
        `\n  ${merges} codes need merging; ${repoints} dependent rows would be repointed.` +
        '\n  Every other subject keeps its id, so its exams and marks are never touched.',
    );
}

async function main() {
    console.log('school_subjects migration — PRE-FLIGHT (read-only, writes nothing)');
    console.log(`Database: ${supabaseUrl}`);

    await reportDoomedSchool();
    await reportOwnerlessRows();
    await reportMiscodedRows();
    await reportPerSchoolMapping();
    await reportMergePlan();

    console.log('\nDone. Nothing was modified.\n');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
