import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export const GET = route('timetable versions', { module: 'timetable', permission: 'timetable.manage' }, async ({ access }) => {
    const { data, error } = await createSupabaseAdmin()
        .from('timetable_versions')
        .select('id, name, status, stats, created_at, published_at')
        .eq('school_id', access.schoolId)
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) throw error;
    return data ?? [];
});
