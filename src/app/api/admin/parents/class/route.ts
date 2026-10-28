import { z } from 'zod';
import { route, parseBody, HttpError, assertInSchool } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne } from '@/lib/postgrest';
import { GUARDIAN_RELATIONSHIPS, linkParent, schoolNameOf } from '@/lib/parents/link';
import { CLASS_LINK_LIMIT, type ClassGuardianLearner, type ClassLinkResult } from '@/lib/parents/class-guardians';

const REQUIREMENT = { module: 'parent_portal' as const, permission: 'school.manage' as const };

type One<T> = T | T[] | null;

interface LearnerRow {
    id: string;
    admission_number: string | null;
    guardian_name: string | null;
    guardian_phone: string | null;
    users: One<{ first_name: string | null; last_name: string | null }>;
    student_guardians: { relationship: string | null; parent: One<{ first_name: string | null; last_name: string | null; phone: string | null }> }[] | null;
}

/** GET ?grade_stream_id= — a class's active learners and the parents linked to each. */
export const GET = route('class parents', REQUIREMENT, async ({ access, request }) => {
    const streamId = request.nextUrl.searchParams.get('grade_stream_id');
    if (!streamId) throw new HttpError(400, 'Choose a class.');
    await assertInSchool('grade_streams', [streamId], access.schoolId);
    const { data, error } = await createSupabaseAdmin()
        .from('students')
        .select('id, admission_number, guardian_name, guardian_phone, users ( first_name, last_name ), student_guardians ( relationship, parent:users!student_guardians_parent_user_id_fkey ( first_name, last_name, phone ) )')
        .eq('current_grade_stream_id', streamId)
        .eq('status', 'ACTIVE')
        .returns<LearnerRow[]>();
    if (error) throw error;
    const learners: ClassGuardianLearner[] = (data ?? []).map(s => {
        const u = embedOne(s.users);
        return {
            id: s.id,
            name: `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || 'Learner',
            admissionNumber: s.admission_number,
            recordName: s.guardian_name?.trim() || null,
            recordPhone: s.guardian_phone?.trim() || null,
            links: (s.student_guardians ?? []).map(g => {
                const p = embedOne(g.parent);
                return { name: `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Parent', phone: p?.phone ?? null, relationship: g.relationship };
            }),
        };
    });
    return learners.sort((a, b) => a.name.localeCompare(b.name));
});

const linkSchema = z.object({
    student_id: z.string().min(1).max(100),
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    phone: z.string().trim().min(9).max(20),
    relationship: z.enum(GUARDIAN_RELATIONSHIPS).default('GUARDIAN'),
    is_primary: z.boolean().default(true),
});
const bodySchema = z.object({ links: z.array(linkSchema).min(1).max(CLASS_LINK_LIMIT) });

/**
 * POST { links } — link a parent to each of many learners. Each row stands
 * alone: one wrong phone number is reported, the rest are linked.
 */
export const POST = route('class parents link', REQUIREMENT, async ({ access, request }) => {
    const { links } = await parseBody(request, bodySchema);
    await assertInSchool('students', [...new Set(links.map(l => l.student_id))], access.schoolId);
    const db = createSupabaseAdmin();
    const schoolName = await schoolNameOf(db, access.schoolId);
    const results: ClassLinkResult[] = [];
    // One at a time: siblings share a parent, and the second row must find the account the first made.
    for (const link of links) {
        try {
            const outcome = await linkParent(db, access, link, schoolName);
            results.push({ student_id: link.student_id, ok: true, reused: outcome.reused });
        } catch (err) {
            results.push({ student_id: link.student_id, ok: false, error: err instanceof HttpError ? err.message : 'Could not link this parent.' });
        }
    }
    return results;
});
