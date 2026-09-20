/**
 * Full JSON backup of everything the school_subjects migration can touch.
 *
 * Run this before any destructive step. It writes one file per table under
 * the chosen output directory, so a delete can be undone by re-inserting.
 * It reads; it never writes to the database.
 *
 * Run: npx tsx scripts/subjects-backup.ts [outputDir]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAdminClient } from './lib/admin-client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabase = createAdminClient();

const DOOMED_SCHOOL_ID = 'b9e20066-0fd3-48ec-b731-56f14bb4413e';

const outDir = process.argv[2] || join(process.cwd(), `backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`);

/**
 * Tables backed up whole. They are small, and a partial backup of a table you
 * later need is worse than no backup at all — you cannot tell what is missing.
 */
const WHOLE_TABLES = [
    'subjects',
    'schools',
    'academic_levels',
    'grading_systems',
    'grading_scales',
    'subject_teacher_assignments',
    'subject_combinations',
    'subject_combination_subjects',
    'student_subjects',
    'report_card_subjects',
    'performance_history',
    'exam_subject_component_schemes',
] as const;

/** Tables large enough to want scoping to the school being removed. */
const SCHOOL_SCOPED = ['users', 'students', 'exams', 'grades', 'grade_streams'] as const;

async function dumpAll(table: string): Promise<number> {
    const rows: unknown[] = [];
    const pageSize = 1000;
    // PostgREST caps a response; page until short, or a large table silently truncates.
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(from, from + pageSize - 1);
        if (error) {
            console.log(`  ${table.padEnd(34)} skipped (${error.message})`);
            return -1;
        }
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
    }
    writeFileSync(join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
    console.log(`  ${table.padEnd(34)} ${rows.length} rows`);
    return rows.length;
}

async function dumpDoomedSchool() {
    for (const table of SCHOOL_SCOPED) {
        const { data, error } = await supabase.from(table).select('*').eq('school_id', DOOMED_SCHOOL_ID);
        if (error) {
            console.log(`  ${table.padEnd(34)} skipped (${error.message})`);
            continue;
        }
        writeFileSync(join(outDir, `doomed-school-${table}.json`), JSON.stringify(data || [], null, 2));
        console.log(`  doomed-school-${table.padEnd(20)} ${(data || []).length} rows`);
    }

    // Marks reach the school only through exams.
    const { data: exams } = await supabase.from('exams').select('id').eq('school_id', DOOMED_SCHOOL_ID);
    const examIds = (exams || []).map(e => e.id);
    const marks: unknown[] = [];
    for (let i = 0; i < examIds.length; i += 100) {
        const { data } = await supabase.from('exam_marks').select('*').in('exam_id', examIds.slice(i, i + 100));
        marks.push(...(data || []));
    }
    writeFileSync(join(outDir, 'doomed-school-exam_marks.json'), JSON.stringify(marks, null, 2));
    console.log(`  doomed-school-exam_marks${' '.repeat(10)} ${marks.length} rows`);
}

async function main() {
    mkdirSync(outDir, { recursive: true });
    console.log(`Backing up to ${outDir}\n`);

    console.log('Whole tables:');
    for (const table of WHOLE_TABLES) await dumpAll(table);

    console.log('\nRows belonging to the school being deleted:');
    await dumpDoomedSchool();

    writeFileSync(
        join(outDir, 'MANIFEST.json'),
        JSON.stringify({ takenAt: new Date().toISOString(), database: supabaseUrl, doomedSchoolId: DOOMED_SCHOOL_ID }, null, 2),
    );

    console.log(`\nDone. Nothing was modified. Backup at ${outDir}\n`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
