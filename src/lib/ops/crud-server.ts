/**
 * The shared operations API behind `/api/ops/[resource]`: list, create,
 * update and delete for any declared resource, with the same rules each time
 * (module on, permission held, school-scoped ids, audit when asked).
 */
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { writeErrorMessage } from '@/lib/api-errors';
import { fetchAllRows } from '@/lib/postgrest';
import { HttpError, assertInSchool, type Access } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import type { ResourceDef } from './resource';
import { getResource } from './registry';

type Row = Record<string, unknown> & { id: string };

/** The resource a route's `[resource]` segment names, or a 404. */
export function resolveResource(name: string): ResourceDef {
    const def = getResource(name);
    if (!def) throw new HttpError(404, 'Not found');
    return def;
}

interface Rights { read: boolean; write: boolean; own: boolean }

function rightsFor(def: ResourceDef, access: Access): Rights {
    if (def.module && !access.hasModule(def.module)) throw new HttpError(404, 'This feature is not enabled for your school.');
    const write = def.write.some(p => access.can(p));
    const read = write || def.read.some(p => access.can(p));
    const own = !!def.own && access.can(def.own.permission);
    if (!read && !own) throw new HttpError(403, 'You do not have permission to do this.');
    return { read, write, own };
}

/** Throws 400 unless every user id referenced by `values` is a member of this school. */
async function assertUsersInSchool(def: ResourceDef, values: Record<string, unknown>, schoolId: string) {
    const ids = [...new Set((def.userRefs ?? []).map(c => values[c]).filter((v): v is string => typeof v === 'string' && v !== ''))];
    if (ids.length === 0) return;
    const { data, error } = await createSupabaseAdmin().from('users').select('id').eq('school_id', schoolId).in('id', ids);
    if (error) throw error;
    if ((data ?? []).length !== ids.length) throw new HttpError(400, 'That person is not a member of your school.');
}

async function assertRefs(def: ResourceDef, values: Record<string, unknown>, schoolId: string) {
    await Promise.all(Object.entries(def.refs ?? {}).map(([column, table]) =>
        assertInSchool(table, [values[column] as string | null | undefined], schoolId)));
    await assertUsersInSchool(def, values, schoolId);
}

function parse(def: ResourceDef, body: unknown, partial: boolean): Record<string, unknown> {
    const schema = partial ? def.schema.partial() : def.schema;
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        throw new HttpError(400, 'Validation failed', parsed.error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`));
    }
    const data = parsed.data as Record<string, unknown>;
    if (!partial) return data;
    // Zod 4 fills `.default()`s even inside a partial; an edit must only touch
    // the fields it sent, or every edit would reset defaulted columns.
    const sent = new Set(Object.keys(body as Record<string, unknown>));
    return Object.fromEntries(Object.entries(data).filter(([k]) => sent.has(k)));
}

function dbError(err: { code?: string; message?: string } | null, fallback: string): never {
    // Raised deliberately by a table's trigger with a message meant for people.
    if (err?.code === 'P0001') throw new HttpError(409, err.message ?? 'That change is not allowed.');
    if (err?.code === '23514') throw new HttpError(400, 'A value is outside what is allowed (for example, more than is in stock).');
    if (err?.code === '23505') throw new HttpError(409, writeErrorMessage(err, 'That record already exists.'));
    if (err?.code === '23503') throw new HttpError(409, 'This record is still in use elsewhere, so it cannot be changed that way.');
    throw Object.assign(new Error(fallback), { cause: err });
}

export async function listRows(def: ResourceDef, access: Access, params: URLSearchParams): Promise<Row[]> {
    const rights = rightsFor(def, access);
    const build = () => {
        let query = createSupabaseAdmin().from(def.table).select(def.select ?? '*').eq('school_id', access.schoolId);
        for (const key of def.filters ?? []) {
            const value = params.get(key);
            if (value) query = query.eq(key, value);
        }
        for (const [flag, { column, isNull }] of Object.entries(def.flags ?? {})) {
            if (params.get(flag) === '1') query = isNull ? query.is(column, null) : query.not(column, 'is', null);
        }
        if (!rights.read && def.own) query = query.eq(def.own.column, access.userId);
        if (def.order) query = query.order(def.order.column, { ascending: def.order.ascending ?? true });
        // A stable tiebreak, so paging never skips or repeats a row.
        return query.order('id');
    };
    const max = def.maxRows ?? 1000;
    const limit = Math.min(Number(params.get('limit')) || max, max);
    // PostgREST caps a response at 1,000 rows; page past that when asked for more.
    const { rows, error } = limit <= 1000
        ? await build().range(0, limit - 1).then(r => ({ rows: r.data ?? [], error: r.error }))
        : await fetchAllRows(build);
    if (error) dbError(error as { code?: string }, `list ${def.table}`);
    return (rows as unknown as Row[]).slice(0, limit);
}

export async function createRow(def: ResourceDef, access: Access, body: unknown): Promise<Row> {
    const rights = rightsFor(def, access);
    if (!rights.write && !rights.own) throw new HttpError(403, 'You do not have permission to do this.');
    const values = parse(def, body, false);
    if (def.own && (!rights.write || values[def.own.column] == null)) {
        if (!rights.write) keepOwnerFields(def, values);
        values[def.own.column] = access.userId;
    }
    checkRules(def, values);
    if (def.createdByColumn) values[def.createdByColumn] = access.userId;
    await assertRefs(def, values, access.schoolId);

    const { data, error } = await createSupabaseAdmin()
        .from(def.table)
        .insert({ ...values, school_id: access.schoolId })
        .select(def.select ?? '*')
        .single();
    if (error || !data) dbError(error, `create ${def.table}`);
    const row = data as unknown as Row;
    if (def.audit) await audit(access, 'create', def.table, row.id, values);
    return row;
}

function checkRules(def: ResourceDef, values: Record<string, unknown>) {
    const problem = def.validate?.(values);
    if (problem) throw new HttpError(400, problem);
}

/** Drops fields an owner may not set on their own record. */
function keepOwnerFields(def: ResourceDef, values: Record<string, unknown>) {
    const allowed = def.own?.fields;
    if (!allowed) return;
    for (const key of Object.keys(values)) if (!allowed.includes(key)) delete values[key];
}

async function loadOwned(def: ResourceDef, access: Access, id: string, rights: Rights): Promise<Row> {
    const { data, error } = await createSupabaseAdmin()
        .from(def.table)
        .select('*')
        .eq('id', id)
        .eq('school_id', access.schoolId)
        .maybeSingle();
    if (error) dbError(error, `load ${def.table}`);
    if (!data) throw new HttpError(404, `${def.label.singular} not found.`);
    const row = data as Row;
    if (rights.write) return row;
    const own = def.own;
    if (!own || !rights.own || row[own.column] !== access.userId) throw new HttpError(403, 'You can only change your own records.');
    const lock = own.editableWhile;
    if (lock && !lock.values.includes(String(row[lock.column]))) {
        throw new HttpError(409, `This ${def.label.singular.toLowerCase()} can no longer be changed.`);
    }
    return row;
}

export async function updateRow(def: ResourceDef, access: Access, id: string, body: unknown): Promise<Row> {
    const rights = rightsFor(def, access);
    const before = await loadOwned(def, access, id, rights);
    const values = parse(def, body, true);
    // Ownership and the creator stamp are not editable through a partial update.
    if (def.own && !rights.write) {
        keepOwnerFields(def, values);
        delete values[def.own.column];
    }
    if (def.createdByColumn) delete values[def.createdByColumn];
    if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update.');
    checkRules(def, { ...before, ...values });
    await assertRefs(def, values, access.schoolId);

    const { data, error } = await createSupabaseAdmin()
        .from(def.table)
        .update(values)
        .eq('id', id)
        .eq('school_id', access.schoolId)
        .select(def.select ?? '*')
        .single();
    if (error || !data) dbError(error, `update ${def.table}`);
    if (def.audit) {
        const changed = Object.fromEntries(Object.keys(values).map(k => [k, { from: before[k], to: values[k] }]));
        await audit(access, 'update', def.table, id, changed);
    }
    return data as unknown as Row;
}

export async function deleteRow(def: ResourceDef, access: Access, id: string): Promise<void> {
    const rights = rightsFor(def, access);
    const before = await loadOwned(def, access, id, rights);
    const { error } = await createSupabaseAdmin().from(def.table).delete().eq('id', id).eq('school_id', access.schoolId);
    if (error) dbError(error, `delete ${def.table}`);
    if (def.audit) await audit(access, 'delete', def.table, id, before);
}
