/**
 * Server-side access: who is calling, which modules their school runs, and
 * what their role and duties allow. Every new route goes through `route()`,
 * which answers 401/403/404 before the handler runs.
 */
import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';
import { getCaller, type Caller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { type ModuleKey, resolveEnabledModules, type SchoolModuleRow } from './modules';
import {
    collectGrants, grantAllows, isDutyKey,
    type DutyKey, type Permission, type PermissionPattern, type ScopeType,
} from './permissions';

export interface DutyAssignment {
    duty: DutyKey;
    scope_type: ScopeType | null;
    scope_id: string | null;
}

export interface Access extends Caller {
    schoolId: string;
    modules: ReadonlySet<ModuleKey>;
    duties: readonly DutyAssignment[];
    grants: readonly PermissionPattern[];
    can(permission: Permission): boolean;
    hasModule(module: ModuleKey): boolean;
    /** Ids this caller's duties are limited to, e.g. the vehicles a driver drives. */
    scopeIds(duty: DutyKey): string[];
}

/** A deliberate 4xx with a message the client may show. */
export class HttpError extends Error {
    constructor(public readonly status: number, message: string, public readonly details?: string[]) {
        super(message);
    }
}

/** Postgres "relation does not exist": the migration has not been applied yet. */
const isMissingTable = (err: { code?: string } | null) => err?.code === '42P01' || err?.code === 'PGRST205';

/** The school's stored module choices; none stored (or no table yet) means defaults. */
export async function loadSchoolModules(schoolId: string): Promise<Set<ModuleKey>> {
    const { data, error } = await createSupabaseAdmin()
        .from('school_modules')
        .select('module_key, enabled, entitled')
        .eq('school_id', schoolId);
    if (error && !isMissingTable(error)) console.error('[access] school_modules', error);
    return resolveEnabledModules((data ?? []) as SchoolModuleRow[]);
}

async function loadDuties(userId: string, schoolId: string): Promise<DutyAssignment[]> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await createSupabaseAdmin()
        .from('user_duties')
        .select('duty, scope_type, scope_id, starts_on, ends_on')
        .eq('user_id', userId)
        .eq('school_id', schoolId);
    if (error) {
        if (!isMissingTable(error)) console.error('[access] user_duties', error);
        return [];
    }
    return (data ?? [])
        .filter(d => isDutyKey(d.duty)
            && (!d.starts_on || d.starts_on <= today)
            && (!d.ends_on || d.ends_on >= today))
        .map(d => ({ duty: d.duty as DutyKey, scope_type: d.scope_type as ScopeType | null, scope_id: d.scope_id as string | null }));
}

export function buildAccess(caller: Caller & { schoolId: string }, modules: Set<ModuleKey>, duties: DutyAssignment[]): Access {
    const grants = collectGrants(caller.role, duties.map(d => d.duty));
    return {
        ...caller,
        modules,
        duties,
        grants,
        can: permission => grantAllows(grants, modules, permission),
        hasModule: module => modules.has(module),
        scopeIds: duty => duties.filter(d => d.duty === duty && d.scope_id).map(d => d.scope_id as string),
    };
}

/** The caller's access, or null when signed out, inactive or without a school. */
export async function getAccess(): Promise<Access | null> {
    const caller = await getCaller();
    if (!caller?.schoolId || caller.role === 'PENDING') return null;
    const withSchool = { ...caller, schoolId: caller.schoolId };
    const [modules, duties] = await Promise.all([
        loadSchoolModules(caller.schoolId),
        loadDuties(caller.userId, caller.schoolId),
    ]);
    return buildAccess(withSchool, modules, duties);
}

export interface Requirement {
    /** The module must be on; when it is off the route does not exist (404). */
    module?: ModuleKey;
    /** At least one of these must be granted. */
    permission?: Permission | readonly Permission[];
}

export async function requireAccess(req: Requirement = {}): Promise<Access> {
    const access = await getAccess();
    if (!access) throw new HttpError(401, 'Unauthorized');
    if (req.module && !access.hasModule(req.module)) throw new HttpError(404, 'This feature is not enabled for your school.');
    const needed = req.permission === undefined ? [] : Array.isArray(req.permission) ? req.permission : [req.permission as Permission];
    if (needed.length > 0 && !needed.some(p => access.can(p))) throw new HttpError(403, 'You do not have permission to do this.');
    return access;
}

/** Validates a JSON body, answering 400 with every field problem on failure. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
    const raw: unknown = await request.json().catch(() => {
        throw new HttpError(400, 'The request body must be JSON.');
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
        throw new HttpError(400, 'Validation failed', parsed.error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`));
    }
    return parsed.data;
}

export function errorResponse(context: string, err: unknown): NextResponse {
    if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, ...(err.details ? { details: err.details } : {}) }, { status: err.status });
    }
    if (err instanceof Response) return err as NextResponse;
    return internalError(context, err);
}

export interface RouteContext<P> {
    access: Access;
    request: NextRequest;
    params: P;
}

type RouteArgs<P> = [NextRequest, { params: Promise<P> }];

/**
 * Wraps a route handler: resolves access against `requirement`, runs the
 * handler, and turns its result into `{ data }` JSON (a returned Response is
 * passed through). Errors become the app's uniform error body.
 */
export function route<P = Record<string, never>>(
    context: string,
    requirement: Requirement,
    handler: (ctx: RouteContext<P>) => Promise<unknown>,
) {
    return async (...[request, second]: RouteArgs<P>): Promise<Response> => {
        try {
            const access = await requireAccess(requirement);
            const params = (second ? await second.params : {}) as P;
            const result = await handler({ access, request, params });
            return result instanceof Response ? result : NextResponse.json({ data: result ?? null });
        } catch (err) {
            return errorResponse(context, err);
        }
    };
}

/** Throws a 400 unless every id in `ids` is a row of `table` in this school. */
export async function assertInSchool(table: string, ids: readonly (string | null | undefined)[], schoolId: string): Promise<void> {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (wanted.length === 0) return;
    const { data, error } = await createSupabaseAdmin()
        .from(table)
        .select('id')
        .eq('school_id', schoolId)
        .in('id', wanted);
    if (error) throw error;
    if ((data ?? []).length !== wanted.length) throw new HttpError(400, `Unknown ${table.replace(/_/g, ' ')} for this school.`);
}
