import type { SupabaseClient } from '@supabase/supabase-js';
import { embedOne, inChunks } from '@/lib/postgrest';
import { normalizeMpesaPhone } from '@/lib/phone';

/**
 * Every number that should hear about each learner: their linked parents'
 * phones, then the contact on the learner's record, normalized to 2547…/2541…
 * and each number once. Learners with no usable number are left out.
 *
 * @param learners learner id → the guardian phone on their record (or null)
 */
export async function guardianPhones(db: SupabaseClient, schoolId: string, learners: ReadonlyMap<string, string | null>): Promise<Map<string, Set<string>>> {
    const links = await inChunks<{ student_id: string; parent: { phone: string | null } | { phone: string | null }[] | null }>([...learners.keys()], chunk =>
        db.from('student_guardians').select('student_id, parent:users!student_guardians_parent_user_id_fkey ( phone )').eq('school_id', schoolId).in('student_id', chunk));
    const phones = new Map<string, Set<string>>();
    const add = (studentId: string, phone: string | null | undefined) => {
        const n = phone ? normalizeMpesaPhone(phone) : null;
        if (!n) return;
        phones.set(studentId, (phones.get(studentId) ?? new Set()).add(n));
    };
    for (const l of links) add(l.student_id, embedOne(l.parent)?.phone);
    for (const [id, recordPhone] of learners) add(id, recordPhone);
    return phones;
}
