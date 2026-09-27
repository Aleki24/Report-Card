/**
 * The access summary `/api/auth/me` sends the browser, and the checks pages
 * run against it. The server re-checks everything; this only decides what to
 * show.
 */
import { MODULE_KEYS, MODULE_LIST, isModuleKey, type ModuleKey } from './modules';
import { grantAllows, isDutyKey, type DutyKey, type Permission, type PermissionPattern } from './permissions';

export interface ClientAccess {
    modules: ModuleKey[];
    grants: PermissionPattern[];
    duties: DutyKey[];
}

/**
 * Before `/api/auth/me` answers (or if it fails): the modules on by default
 * and no extra permissions, so role-based menus still render as before.
 */
export const DEFAULT_ACCESS: ClientAccess = {
    modules: MODULE_LIST.filter(m => m.defaultEnabled).map(m => m.key),
    grants: [],
    duties: [],
};

/** Demo preview: every module, full rights, so the whole app can be explored. */
export const PREVIEW_ACCESS: ClientAccess = { modules: [...MODULE_KEYS], grants: ['*'], duties: [] };

/** Reads the untrusted JSON shape, dropping anything unknown. */
export function parseClientAccess(raw: unknown): ClientAccess {
    if (typeof raw !== 'object' || raw === null) return DEFAULT_ACCESS;
    const r = raw as Record<string, unknown>;
    const list = (v: unknown) => (Array.isArray(v) ? v : []);
    return {
        modules: list(r.modules).filter(isModuleKey),
        grants: list(r.grants).filter((g): g is PermissionPattern => typeof g === 'string'),
        duties: list(r.duties).filter(isDutyKey),
    };
}

export interface AccessChecks {
    can: (permission: Permission) => boolean;
    hasModule: (module: ModuleKey) => boolean;
    hasDuty: (duty: DutyKey) => boolean;
}

export function accessChecks(access: ClientAccess): AccessChecks {
    const modules = new Set(access.modules);
    const duties = new Set(access.duties);
    return {
        can: p => grantAllows(access.grants, modules, p),
        hasModule: m => modules.has(m),
        hasDuty: d => duties.has(d),
    };
}
