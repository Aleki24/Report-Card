import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { sendBulkSMS } from '@/lib/africastalking';
import { rateLimit } from '@/lib/rate-limit';

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin',
    CLASS_TEACHER: 'Class Teacher',
    SUBJECT_TEACHER: 'Subject Teacher',
};

function formatPostedBy(poster: { first_name: string; last_name: string; role: string } | null | undefined) {
    if (!poster) return 'School';
    const roleLabel = ROLE_LABELS[poster.role] || poster.role;
    return `${roleLabel} ${poster.first_name} ${poster.last_name}`.trim();
}

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('school_id')
            .eq('id', userId)
            .maybeSingle();

        const schoolId = userProfile?.school_id;
        if (!schoolId) return NextResponse.json({ data: [] });

        const { data, error } = await supabase
            .from('announcements')
            .select(`
                id, title, content, is_important, created_at, posted_by,
                users!posted_by ( first_name, last_name, role )
            `)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const mapped = (data ?? []).map((a: any) => ({
            id: a.id,
            title: a.title,
            content: a.content,
            isImportant: a.is_important,
            createdAt: a.created_at,
            postedBy: formatPostedBy(a.users),
            postedById: a.posted_by ?? null,
        }));

        return NextResponse.json({ data: mapped });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('school_id, role, is_active')
            .eq('id', userId)
            .single();

        if (!userProfile) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (userProfile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const schoolId = userProfile.school_id;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });

        if (!['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(userProfile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        if (!body.title || !body.content) {
            return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
        }
        if (typeof body.title !== 'string' || body.title.length > MAX_TITLE_LENGTH) {
            return NextResponse.json({ error: `Title must be at most ${MAX_TITLE_LENGTH} characters` }, { status: 400 });
        }
        if (typeof body.content !== 'string' || body.content.length > MAX_CONTENT_LENGTH) {
            return NextResponse.json({ error: `Content must be at most ${MAX_CONTENT_LENGTH} characters` }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('announcements')
            .insert({
                school_id: schoolId,
                title: body.title,
                content: body.content,
                is_important: body.is_important ?? false,
                posted_by: userId,
            })
            .select()
            .single();

        if (error) throw error;

        let sms: { sent: number; failed: number; total: number } | undefined;
        if (body.send_sms) {
            const smsLimit = rateLimit(`announcement-sms:${userId}`, { maxRequests: 3, windowMs: 60_000 });
            if (!smsLimit.allowed) {
                return NextResponse.json(
                    { data, sms: { sent: 0, failed: 0, total: 0 }, warning: 'SMS blast rate limit reached. The announcement was posted but SMS was not sent. Please wait a minute and try again.' },
                    { status: 429 }
                );
            }
            const { data: students } = await supabase
                .from('students')
                .select('guardian_phone, users!inner(school_id)')
                .eq('users.school_id', schoolId)
                .eq('status', 'ACTIVE')
                .not('guardian_phone', 'is', null);

            const phones = Array.from(new Set((students ?? [])
                .map((s: { guardian_phone: string | null }) => s.guardian_phone)
                .filter((p: string | null): p is string => !!p && p.trim().length > 0)));

            if (phones.length > 0) {
                const smsBody = `${body.title}: ${body.content}`.slice(0, 300);
                const result = await sendBulkSMS(phones.map(phone => ({ phone, message: smsBody })));
                sms = { sent: result.sent, failed: result.failed, total: phones.length };
            } else {
                sms = { sent: 0, failed: 0, total: 0 };
            }
        }

        return NextResponse.json({ data, sms });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
