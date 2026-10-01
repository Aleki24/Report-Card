/**
 * Matching marks read from a photographed sheet or an uploaded list to the
 * learners in the class: admission number first, then a typo-tolerant name
 * match. Platform-neutral: the web scan and upload screens and the mobile
 * app share it.
 */
import { normalizeRowKeys } from '../import/parse-tabular-file';

/** One line the scan endpoint read off the sheet. */
export interface ScanRow {
    row: number;
    student_name: string;
    admission_number: string | null;
    score: number | null;
    confidence: 'high' | 'medium' | 'low';
}

/** A learner a mark can belong to. */
export interface MatchCandidate {
    id: string;
    name: string;
    admission_number: string;
}

export interface StudentMatch {
    /** '' when nobody matched. */
    id: string;
    /** Matched, but not confidently — the teacher should check. */
    ambiguous: boolean;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const curr = [i];
        for (let j = 1; j <= n; j++) {
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = curr;
    }
    return prev[n];
}

/** 0..1 similarity between an extracted name and a roster name (token-order tolerant). */
export function nameSimilarity(extracted: string, roster: string): number {
    const a = normalize(extracted), b = normalize(roster);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const aTokens = a.split(' '), bTokens = b.split(' ');
    // Score each extracted token against its best roster token
    let total = 0;
    for (const at of aTokens) {
        let best = 0;
        for (const bt of bTokens) {
            const d = levenshtein(at, bt);
            const sim = 1 - d / Math.max(at.length, bt.length);
            if (sim > best) best = sim;
        }
        total += best;
    }
    return total / aTokens.length;
}

export function matchStudent(row: { student_name: string; admission_number: string | null }, students: readonly MatchCandidate[]): StudentMatch {
    // 1. Exact admission-number match wins outright
    if (row.admission_number) {
        const adm = row.admission_number.trim().toLowerCase();
        const byAdm = students.find(s => s.admission_number.trim().toLowerCase() === adm);
        if (byAdm) return { id: byAdm.id, ambiguous: false };
    }
    // 2. Fuzzy name match
    if (!row.student_name.trim()) return { id: '', ambiguous: false };
    const scored = students
        .map(s => ({ s, sim: nameSimilarity(row.student_name, s.name) }))
        .sort((x, y) => y.sim - x.sim);
    const best = scored[0], second = scored[1];
    if (!best || best.sim < 0.55) return { id: '', ambiguous: false };
    // Ambiguous when the runner-up is nearly as good, or the match itself is soft
    const ambiguous = best.sim < 0.8 || (second !== undefined && best.sim - second.sim < 0.12);
    return { id: best.s.id, ambiguous };
}

/** Matches every row in order, never giving one learner two rows. */
export function matchRows<R extends { student_name: string; admission_number: string | null }>(rows: readonly R[], students: readonly MatchCandidate[]): (R & StudentMatch)[] {
    const used = new Set<string>();
    return rows.map(r => {
        const m = matchStudent(r, students.filter(s => !used.has(s.id)));
        if (m.id) used.add(m.id);
        return { ...r, ...m };
    });
}

/**
 * A marks file's rows as name / admission number / score, accepting the
 * column names teachers use ("Adm No", "Marks", "Student Name"…).
 */
export function marksFromTable(rows: readonly Record<string, string>[]): { student_name: string; admission_number: string | null; score: string }[] {
    return rows.map(raw => {
        const r = normalizeRowKeys(raw);
        const first = r.firstname || r.first || '';
        const last = r.lastname || r.last || r.surname || '';
        return {
            student_name: r.name || r.fullname || r.studentname || r.student || `${first} ${last}`.trim(),
            admission_number: r.admissionnumber || r.admissionno || r.admno || r.adm || null,
            score: r.score || r.marks || r.mark || r.rawscore || '',
        };
    }).filter(r => r.student_name || r.admission_number);
}
