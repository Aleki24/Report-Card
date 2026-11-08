/**
 * Which learner a payment is for.
 *
 * Parents pay the Paybill with the learner's admission number as the account
 * number, and most payments match on it exactly. The rest are the ones a
 * bursar spends the week chasing: "ADM 1234" or "1234A" for 1234, the
 * account left blank, a Till payment with no account at all, one payment for
 * two children, or a payer whose name is not the guardian's. Those come back
 * as suggestions with the reason, never as silent guesses: only an exact
 * admission number (or an unambiguous variant of it) is matched outright.
 *
 * Client-safe and shared with the app.
 */

/** A learner as the matcher knows them. */
export interface MatchLearner {
    id: string;
    name: string;
    admissionNumber: string | null;
    className: string | null;
    /** Guardians' phones, any format. */
    phones: readonly string[];
    /** Guardians' names. */
    guardianNames: readonly string[];
}

export type MatchReason = 'ADMISSION' | 'ADMISSION_VARIANT' | 'ADMISSION_IN_DETAILS' | 'PHONE' | 'NAME';

export interface MatchCandidate {
    studentId: string;
    reason: MatchReason;
    /** 0–100: how sure the match is. */
    score: number;
}

/**
 * MATCHED: one learner, by admission number; record it.
 * SUGGESTED: likely learners (by phone, name or a loose admission number); a person confirms.
 * UNMATCHED: nobody; it waits in the unmatched queue.
 */
export type MatchKind = 'MATCHED' | 'SUGGESTED' | 'UNMATCHED';

export interface MatchResult {
    kind: MatchKind;
    /** Best first; for MATCHED, exactly one. */
    candidates: MatchCandidate[];
}

export const MATCH_REASON_LABELS: Record<MatchReason, string> = {
    ADMISSION: 'Admission number',
    ADMISSION_VARIANT: 'Admission number, typed differently',
    ADMISSION_IN_DETAILS: 'Admission number in the description',
    PHONE: 'Parent’s phone',
    NAME: 'Name',
};

// ── Normalising ─────────────────────────────────────────────────────────

/** Words payers put before the number: "ADM 1234", "Adm No: 1234", "Acc 1234". */
const REF_PREFIXES = /^(?:ADMISSION(?:NO|NUMBER)?|ADMNO|ADM|ACCNO|ACC|AC|NO|STUDENT|STD|REG(?:NO)?)+/;

/** An admission number or account reference as compared: capitals and digits only, no leading label. */
export function refKey(raw: string | null | undefined): string {
    const compact = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const stripped = compact.replace(REF_PREFIXES, '');
    return stripped || compact;
}

/** A looser key: digits only, without leading zeros ("ADM-0123" and "123" agree). */
export function refDigits(raw: string | null | undefined): string {
    return (raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * A Kenyan mobile number as 2547XXXXXXXX / 2541XXXXXXXX, keeping any masking
 * a statement applied ("2547******678"). Null when it is not a mobile number.
 */
export function phoneKey(raw: string | null | undefined): string | null {
    const value = (raw ?? '').replace(/[^\d*]/g, '');
    if (!value) return null;
    let key = value;
    if (key.startsWith('0') && key.length === 10) key = `254${key.slice(1)}`;
    else if ((key.startsWith('7') || key.startsWith('1')) && key.length === 9) key = `254${key}`;
    return key.length === 12 && key.startsWith('254') ? key : null;
}

/** Whether a (possibly masked) statement phone and a guardian's phone are the same number. */
export function phonesAgree(statement: string, known: string): boolean {
    if (statement.length !== known.length) return false;
    let shown = 0;
    for (let i = 0; i < statement.length; i++) {
        if (statement[i] === '*') continue;
        if (statement[i] !== known[i]) return false;
        shown++;
    }
    // A mask leaving only "254" proves nothing; M-Pesa shows six or more digits.
    return shown >= 6;
}

const NAME_STOP = new Set(['MR', 'MRS', 'MS', 'MISS', 'DR', 'REV', 'PASTOR', 'AND', 'THE']);

function nameTokens(name: string | null | undefined): string[] {
    return (name ?? '').toUpperCase().split(/[^A-Z]+/).filter(t => t.length >= 3 && !NAME_STOP.has(t));
}

/** Names that share at least two words, or one word when one side has only one. */
function nameScore(a: readonly string[], b: readonly string[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const set = new Set(b);
    const shared = a.filter(t => set.has(t)).length;
    if (shared >= 2) return 70;
    if (shared === 1 && Math.min(a.length, b.length) === 1) return 45;
    return 0;
}

// ── The index ────────────────────────────────────────────────────────────

export interface LearnerIndex {
    learners: ReadonlyMap<string, MatchLearner>;
    byRef: ReadonlyMap<string, string[]>;
    byDigits: ReadonlyMap<string, string[]>;
    phones: readonly { key: string; studentId: string }[];
    names: readonly { tokens: string[]; studentId: string }[];
}

function push(map: Map<string, string[]>, key: string, id: string) {
    if (!key) return;
    const list = map.get(key);
    if (!list) map.set(key, [id]);
    else if (!list.includes(id)) list.push(id);
}

export function buildLearnerIndex(learners: readonly MatchLearner[]): LearnerIndex {
    const byRef = new Map<string, string[]>();
    const byDigits = new Map<string, string[]>();
    const phones: { key: string; studentId: string }[] = [];
    const names: { tokens: string[]; studentId: string }[] = [];
    for (const l of learners) {
        if (l.admissionNumber) {
            push(byRef, refKey(l.admissionNumber), l.id);
            push(byDigits, refDigits(l.admissionNumber), l.id);
        }
        for (const p of l.phones) {
            const key = phoneKey(p);
            if (key) phones.push({ key, studentId: l.id });
        }
        names.push({ tokens: nameTokens(l.name), studentId: l.id });
        for (const g of l.guardianNames) names.push({ tokens: nameTokens(g), studentId: l.id });
    }
    return { learners: new Map(learners.map(l => [l.id, l])), byRef, byDigits, phones, names };
}

// ── Matching ─────────────────────────────────────────────────────────────

export interface PaymentClues {
    accountRef: string | null;
    phone: string | null;
    payerName: string | null;
    /** The statement's description, searched for an admission number. */
    details?: string | null;
}

/** Who a payment is most likely for, and how sure. */
export function matchPayment(clues: PaymentClues, index: LearnerIndex): MatchResult {
    const found = new Map<string, MatchCandidate & { reasons: Set<MatchReason> }>();
    // The strongest clue names the reason; each further kind of clue for the same learner adds a little.
    const add = (studentId: string, reason: MatchReason, score: number) => {
        const current = found.get(studentId);
        if (!current) { found.set(studentId, { studentId, reason, score, reasons: new Set([reason]) }); return; }
        if (current.reasons.has(reason) && score <= current.score) return;
        const fresh = !current.reasons.has(reason);
        current.reasons.add(reason);
        if (score > current.score) { current.reason = reason; current.score = score; }
        if (fresh) current.score = Math.min(99, current.score + 5);
    };

    const ref = refKey(clues.accountRef);
    const exact = ref ? index.byRef.get(ref) ?? [] : [];
    // Typed exactly as the admission number, or with a label in front ("ADM 1234").
    const asTyped = (clues.accountRef ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') === ref;
    exact.forEach(id => add(id, asTyped ? 'ADMISSION' : 'ADMISSION_VARIANT', exact.length === 1 ? 95 : 60));
    if (exact.length === 0) {
        const digits = refDigits(clues.accountRef);
        const loose = digits.length >= 2 ? index.byDigits.get(digits) ?? [] : [];
        loose.forEach(id => add(id, 'ADMISSION_VARIANT', loose.length === 1 ? 80 : 50));
    }
    if (found.size === 0 && clues.details) {
        // A bank narration: "MPESA C2B 1234 JOHN DOE QAB12CD34E".
        for (const token of clues.details.toUpperCase().split(/[^A-Z0-9]+/)) {
            if (token.length < 2) continue;
            for (const id of index.byRef.get(refKey(token)) ?? []) add(id, 'ADMISSION_IN_DETAILS', 60);
        }
    }

    const phone = phoneKey(clues.phone);
    if (phone) for (const p of index.phones) if (phonesAgree(phone, p.key)) add(p.studentId, 'PHONE', 55);

    // A bank line often has no payer column; its narration carries the name.
    const payer = nameTokens(clues.payerName ?? clues.details);
    const fromNarration = !clues.payerName;
    if (payer.length > 0) {
        for (const n of index.names) {
            const score = nameScore(payer, n.tokens);
            if (score > 0) add(n.studentId, 'NAME', score - (found.size > 0 ? 10 : 0) - (fromNarration ? 5 : 0));
        }
    }

    const candidates: MatchCandidate[] = [...found.values()]
        .map(({ studentId, reason, score }) => ({ studentId, reason, score }))
        .sort((a, b) => b.score - a.score || a.studentId.localeCompare(b.studentId))
        .slice(0, 6);
    if (candidates.length === 0) return { kind: 'UNMATCHED', candidates };
    // Matched outright only on one learner's admission number. A brother or
    // sister found by the family's phone or name stays listed (the payment may
    // be for both) but does not compete: the account number names the child.
    const byAdmission = (c: MatchCandidate) => c.reason === 'ADMISSION' || c.reason === 'ADMISSION_VARIANT';
    const [best] = candidates;
    const rival = candidates.slice(1).find(c => byAdmission(c) || (c.reason === 'ADMISSION_IN_DETAILS' && c.score >= 60));
    const decisive = byAdmission(best) && best.score >= 80 && !rival;
    return { kind: decisive ? 'MATCHED' : 'SUGGESTED', candidates };
}

/** "Admission number · Grade 7 East" for a candidate line. */
export function candidateLabel(c: MatchCandidate, index: Pick<LearnerIndex, 'learners'>): string {
    const l = index.learners.get(c.studentId);
    return [l?.name ?? 'A learner', l?.admissionNumber ? `Adm ${l.admissionNumber}` : null, l?.className].filter(Boolean).join(' · ');
}
