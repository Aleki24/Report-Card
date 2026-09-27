import { z } from 'zod';
import { route, parseBody, loadSchoolModules, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import {
    MODULE_KEYS, MODULE_LIST, MODULE_PRESETS, dependents, withDependencies,
    type ModuleKey,
} from '@/lib/platform/modules';

export interface ModuleState {
    key: ModuleKey;
    enabled: boolean;
    /** False when the school's plan does not include the module. */
    entitled: boolean;
}

async function readStates(schoolId: string): Promise<ModuleState[]> {
    const [enabled, { data, error }] = await Promise.all([
        loadSchoolModules(schoolId),
        createSupabaseAdmin().from('school_modules').select('module_key, entitled').eq('school_id', schoolId),
    ]);
    if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw error;
    const notEntitled = new Set((data ?? []).filter(r => r.entitled === false).map(r => r.module_key as string));
    return MODULE_LIST.map(m => ({ key: m.key, enabled: enabled.has(m.key), entitled: !notEntitled.has(m.key) }));
}

export const GET = route('modules list', { permission: 'modules.manage' }, ({ access }) => readStates(access.schoolId));

const updateSchema = z.union([
    z.object({ module: z.enum(MODULE_KEYS), enabled: z.boolean() }),
    z.object({ preset: z.enum(MODULE_PRESETS.map(p => p.id) as [string, ...string[]]) }),
]);

/**
 * Turns one module on or off (dependencies follow: switching on also switches
 * on what it needs; switching off also switches off what needs it), or
 * applies a preset. Data is never deleted; an off module is only hidden.
 */
export const PUT = route('modules update', { permission: 'modules.manage' }, async ({ access, request }) => {
    const body = await parseBody(request, updateSchema);
    const current = await readStates(access.schoolId);
    const next = new Map(current.map(s => [s.key, s.enabled]));

    if ('preset' in body) {
        const preset = MODULE_PRESETS.find(p => p.id === body.preset);
        if (!preset) throw new HttpError(400, 'Unknown preset.');
        const wanted = new Set<ModuleKey>(preset.modules.flatMap(k => withDependencies(k)));
        MODULE_KEYS.forEach(k => next.set(k, wanted.has(k)));
    } else if (body.enabled) {
        withDependencies(body.module).forEach(k => next.set(k, true));
    } else {
        [body.module, ...dependents(body.module)].forEach(k => next.set(k, false));
    }

    const blocked = current.filter(s => !s.entitled && next.get(s.key)).map(s => s.key);
    if (blocked.length > 0) throw new HttpError(403, `Your plan does not include: ${blocked.join(', ')}.`);

    const changed = current.filter(s => next.get(s.key) !== s.enabled);
    if (changed.length > 0) {
        const { error } = await createSupabaseAdmin().from('school_modules').upsert(
            changed.map(s => ({
                school_id: access.schoolId,
                module_key: s.key,
                enabled: next.get(s.key) ?? false,
                updated_at: new Date().toISOString(),
                updated_by: access.userId,
            })),
            { onConflict: 'school_id,module_key', ignoreDuplicates: false },
        );
        if (error) throw error;
        await audit(access, 'configure', 'school_modules', null, Object.fromEntries(changed.map(s => [s.key, next.get(s.key)])));
    }
    return readStates(access.schoolId);
});
