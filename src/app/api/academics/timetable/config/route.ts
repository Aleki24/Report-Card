import { route, parseBody } from '@/lib/platform/access';
import { timetableConfigSchema } from '@/lib/timetable/config';
import { loadConfig, saveConfig } from '@/lib/timetable/server';

export const GET = route('timetable config', { module: 'timetable', permission: 'timetable.view' }, ({ access }) => loadConfig(access.schoolId));

export const PUT = route('timetable config save', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const config = await parseBody(request, timetableConfigSchema);
    return saveConfig(access.schoolId, config);
});
