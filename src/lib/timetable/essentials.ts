/**
 * Lessons every class takes that are not examined, so they are easy to leave
 * off a timetable built from who teaches which examined subject: Physical
 * Education and Life Skills in 8-4-4 secondary; Physical Education, ICT
 * Skills and Community Service Learning in Senior School (CBE). The studio
 * shows which of them a class's timetable lacks and adds them in one press,
 * at the Ministry's lessons a week. Pure, shared with the app.
 */
import type { CurriculumBand } from '../curriculum-bands';
import { ministryAllocation } from './allocations';

export interface EssentialLesson {
    /** The subject's code when Skulbase has to create it for the school. */
    code: string;
    name: string;
    category: string;
    /** Finds the school's own subject for it, whatever it was named. */
    match: RegExp;
}

export const ESSENTIAL_LESSONS: Partial<Record<CurriculumBand, readonly EssentialLesson[]>> = {
    '844_SECONDARY': [
        { code: 'PE_844', name: 'Physical Education', category: 'CREATIVE', match: /physical education|^p\.?e\.?$/i },
        { code: 'LSK_844', name: 'Life Skills', category: 'HUMANITY', match: /life skills/i },
    ],
    CBC_SENIOR_SCHOOL: [
        { code: 'PE_SS', name: 'Physical Education', category: 'CREATIVE', match: /physical education|^p\.?e\.?$/i },
        { code: 'ICT_SS', name: 'ICT Skills', category: 'TECHNICAL', match: /\bict\b|information communication/i },
        { code: 'CSL_SS', name: 'Community Service Learning', category: 'HUMANITY', match: /community service/i },
    ],
};

/** A class's missing lesson as the studio shows it. */
export interface MissingLesson { code: string; name: string; lessons: number }

/** The non-examined lessons a class's level expects that none of its subjects covers, with the Ministry's lessons a week. */
export function missingEssentials(
    band: CurriculumBand | null,
    grade: { code: string | null; name_display: string | null } | null,
    subjectNames: readonly string[],
): MissingLesson[] {
    const wanted = band ? ESSENTIAL_LESSONS[band] ?? [] : [];
    return wanted
        .filter(e => !subjectNames.some(n => e.match.test(n.trim())))
        .map(e => ({ code: e.code, name: e.name, lessons: ministryAllocation(grade, { name: e.name })?.lessons ?? 1 }));
}

/** "Physical Education (2 a week) and Life Skills (1 a week)" */
export function missingLine(missing: readonly MissingLesson[]): string {
    const parts = missing.map(m => `${m.name} (${m.lessons} a week)`);
    return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
