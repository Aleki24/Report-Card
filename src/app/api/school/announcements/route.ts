import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { sendBulkSMS } from '@/lib/africastalking';
import { rateLimit } from '@/lib/rate-limit';
import { getCaller } from '@/lib/auth-server';
import { internalError } from '@/lib/api-errors';
import { escapeLikePattern } from '@/lib/postgrest';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import {
    ANNOUNCEMENTS_PAGE_SIZE, announcementCreateSchema, announcementSmsText,
    type Announcement, type AnnouncementCounts, type AnnouncementSmsResult, type AnnouncementsResponse,
} from '@/lib/announcements';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin',
    CLASS_TEACHER: 'Class Teacher',
    SUBJECT_TEACHER: 'Subject Teacher',
    STAFF: 'Staff',
};

type Poster = { first_name: string | null; last_name: string | null; role: string | null };
interface AnnouncementRow {
    id: string;
    title: string;
    content: string;
    is_important: boolean;
    created_at: string;
    posted_by: string | null;
    users: Poster | Poster[] | null;
}

function formatPostedBy(poster: Poster | null) {
    if (!poster) return 'School';
    const roleLabel = poster.role ? ROLE_LABELS[poster.role] || poster.role : '';
    return `${roleLabel} ${poster.first_name ?? ''} ${poster.last_name ?? ''}`.replace(/\s+/g, ' ').trim();
}

const toAnnouncement = (a: AnnouncementRow): Announcement => ({
    id: a.id,
    title: a.title,
    content: a.content,
    isImportant: a.is_important,
    createdAt: a.created_at,
    postedBy: formatPostedBy(Array.isArray(a.users) ? a.users[0] ?? null : a.users),
    postedById: a.posted_by ?? null,
});

/** A value quoted for a PostgREST `or=` filter, where commas and brackets are syntax. */
const quoted = (value: string) => `"${value.replace(/["\\]/g, '\\$&')}"`;

/**
 * One page of the school's announcements, newest first, optionally filtered.
 *
 * Only the newest 20 were ever returned, with no way to reach older ones, and
 * search ran in the browser over those 20. Pages now continue with `before`
 * (the last one's created_at) and the filters run in the database.
 */
export async function GET(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { schoolId, userId } = caller;
        if (!schoolId) return NextResponse.json({ data: [], nextCursor: null } satisfies AnnouncementsResponse);

        const { searchParams } = new URL(request.url);
        const filter = searchParams.get('filter');
        const before = searchParams.get('before');
        const q = searchParams.get('q')?.trim().slice(0, 100) ?? '';

        const supabase = createSupabaseAdmin();
        let query = supabase
            .from('announcements')
            .select('id, title, content, is_important, created_at, posted_by, users!posted_by ( first_name, last_name, role )')
            .eq('school_id', schoolId);
        if (filter === 'important') query = query.eq('is_important', true);
        if (filter === 'mine') query = query.eq('posted_by', userId);
        if (q) {
            const pattern = quoted(`%${escapeLikePattern(q)}%`);
            query = query.or(`title.ilike.${pattern},content.ilike.${pattern}`);
        }
        if (before) query = query.lt('created_at', before);

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(ANNOUNCEMENTS_PAGE_SIZE + 1);
        if (error) return internalError('announcements list', error);

        const rows = (data ?? []) as unknown as AnnouncementRow[];
        const page = rows.slice(0, ANNOUNCEMENTS_PAGE_SIZE).map(toAnnouncement);
        const body: AnnouncementsResponse = {
            data: page,
            nextCursor: rows.length > ANNOUNCEMENTS_PAGE_SIZE ? page[page.length - 1].createdAt : null,
        };

        // The filter tiles' figures, once per load rather than per page.
        if (!before) {
            const count = (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => build(base());
            const base = () => supabase.from('announcements').select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
            const [all, important, mine] = await Promise.all([
                count(q => q),
                count(q => q.eq('is_important', true)),
                count(q => q.eq('posted_by', userId)),
            ]);
            const counts: AnnouncementCounts = { all: all.count ?? 0, important: important.count ?? 0, mine: mine.count ?? 0 };
            body.counts = counts;
        }

        return NextResponse.json(body);
    } catch (err: unknown) {
        return internalError('announcements', err);
    }
}

export async function POST(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { schoolId, userId, role } = caller;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });
        if (!isRoleIn(role, STAFF_TEACHING_ROLES)) {
            return NextResponse.json({ error: 'Only admins and teachers can post announcements.' }, { status: 403 });
        }

        const parsed = announcementCreateSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid announcement.' }, { status: 400 });
        }
        const { title, content, is_important, send_sms } = parsed.data;
        // Texting every guardian costs the school money: the admin's call.
        if (send_sms && role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only the admin can text announcements to guardians.' }, { status: 403 });
        }

        const supabase = createSupabaseAdmin();
        const { data, error } = await supabase
            .from('announcements')
            .insert({ school_id: schoolId, title, content, is_important, posted_by: userId })
            .select('id')
            .single();
        if (error) return internalError('announcement insert', error);

        let sms: AnnouncementSmsResult | undefined;
        let warning: string | undefined;
        if (send_sms) {
            const smsLimit = rateLimit(`announcement-sms:${userId}`, { maxRequests: 3, windowMs: 60_000 });
            if (!smsLimit.allowed) {
                // The announcement is posted either way; answering with an
                // error here made the page offer to post it again.
                warning = 'The announcement was posted, but texts were not sent: too many SMS blasts in the last minute. Try again shortly.';
            } else {
                const { data: students } = await supabase
                    .from('students')
                    .select('guardian_phone, users!inner(school_id)')
                    .eq('users.school_id', schoolId)
                    .eq('status', 'ACTIVE')
                    .not('guardian_phone', 'is', null);

                const phones = Array.from(new Set((students ?? [])
                    .map((s: { guardian_phone: string | null }) => s.guardian_phone?.trim() ?? '')
                    .filter(Boolean)));

                if (phones.length > 0) {
                    const message = announcementSmsText(title, content);
                    const result = await sendBulkSMS(phones.map(phone => ({ phone, message })));
                    sms = { sent: result.sent, failed: result.failed, total: phones.length };
                } else {
                    sms = { sent: 0, failed: 0, total: 0 };
                }
            }
        }

        return NextResponse.json({ data, sms, warning });
    } catch (err: unknown) {
        return internalError('announcement create', err);
    }
}
