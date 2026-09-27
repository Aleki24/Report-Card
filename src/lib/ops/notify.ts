import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { sendSMS } from '@/lib/africastalking';
import { embedOne } from '@/lib/postgrest';

export interface LearnerContact { name: string; firstName: string; guardianPhone: string | null; schoolName: string }

/** A learner's name, guardian phone and school name, for messages to parents. */
export async function learnerContact(studentId: string, schoolId: string): Promise<LearnerContact | null> {
    const db = createSupabaseAdmin();
    const [{ data: student }, { data: school }] = await Promise.all([
        db.from('students').select('guardian_phone, user:users(first_name, last_name)').eq('id', studentId).eq('school_id', schoolId).maybeSingle(),
        db.from('schools').select('name').eq('id', schoolId).maybeSingle(),
    ]);
    if (!student) return null;
    const u = embedOne<{ first_name: string; last_name: string }>(student.user);
    return {
        name: `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim(),
        firstName: u?.first_name ?? 'Your child',
        guardianPhone: (student.guardian_phone as string | null) ?? null,
        schoolName: (school?.name as string | undefined) ?? 'School',
    };
}

/** Texts a learner's guardian; false when there is no phone or sending failed. */
export async function notifyGuardian(studentId: string, schoolId: string, compose: (c: LearnerContact) => string): Promise<boolean> {
    const contact = await learnerContact(studentId, schoolId);
    if (!contact?.guardianPhone) return false;
    const result = await sendSMS(contact.guardianPhone, compose(contact).slice(0, 320));
    return result.success;
}

/** "14:05, 27 Sep" in Nairobi time, for SMS. */
export const smsTime = (iso: string | Date = new Date()) =>
    new Date(iso).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
