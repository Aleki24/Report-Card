import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit } from '@/lib/rate-limit';
import { embedOne } from '@/lib/postgrest';
import { draftScheme } from '@/lib/academics/scheme-draft';
import { canEditScheme, loadScheme } from '@/lib/academics/schemes-server';

export const maxDuration = 120;

type Params = { id: string };

const bodySchema = z.object({
    weeks: z.number().int().min(1).max(16),
    lessons_per_week: z.number().int().min(1).max(10),
    topics: z.string().max(3000).default(''),
});

/** Drafts entries with AI for the teacher to review; nothing is saved until they save. */
export const POST = route<Params>('scheme draft', { module: 'lesson_records', permission: ['lesson_records.write', 'lesson_records.review'] }, async ({ access, params, request }) => {
    if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'AI drafting is not configured on this server.');
    const body = await parseBody(request, bodySchema);
    const scheme = await loadScheme(params.id, access);
    if (!canEditScheme(scheme)) throw new HttpError(409, 'This scheme can no longer be edited.');
    if (!rateLimit(`scheme-draft:${access.userId}`, { maxRequests: 5, windowMs: 10 * 60_000 }).allowed) {
        throw new HttpError(429, 'Too many drafts in a short time. Wait a few minutes.');
    }
    const { data } = await createSupabaseAdmin()
        .from('schemes_of_work')
        .select('subject:subjects(name), stream:grade_streams(full_name)')
        .eq('id', scheme.id)
        .single();
    const result = await draftScheme({
        subject: embedOne<{ name: string }>(data?.subject)?.name ?? 'the subject',
        className: embedOne<{ full_name: string }>(data?.stream)?.full_name ?? 'the class',
        weeks: body.weeks,
        lessonsPerWeek: body.lessons_per_week,
        topics: body.topics,
    });
    if (!result.ok) throw new HttpError(502, result.reason);
    return { entries: result.entries };
});
