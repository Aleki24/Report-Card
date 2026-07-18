// src/app/api/school/student/notifications/route.ts
// Lightweight count of recent (last 3 days) school announcements — used to
// badge the sidebar without pulling the full dashboard summary.

import { NextResponse } from 'next/server';
import { getCurrentStudent } from '@/lib/student/get-current-student';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET() {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supabase = createSupabaseAdmin();
        const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
        const { count, error } = await supabase
            .from('announcements')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', student.schoolId)
            .gte('created_at', since);

        if (error) throw error;
        return NextResponse.json({ data: { count: count ?? 0 } });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
