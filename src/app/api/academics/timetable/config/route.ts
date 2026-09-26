import { route, parseBody } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { timetableConfigSchema } from '@/lib/timetable/config';
import { loadConfig } from '@/lib/timetable/server';

export const GET = route('timetable config', { module: 'timetable', permission: 'timetable.view' }, ({ access }) => loadConfig(access.schoolId));

export const PUT = route('timetable config save', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const config = await parseBody(request, timetableConfigSchema);
    const { error } = await createSupabaseAdmin().from('timetable_configs').upsert({
        school_id: access.schoolId,
        days: [...config.days].sort(),
        periods: config.periods,
        rules: config.rules,
        updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return loadConfig(access.schoolId);
});
