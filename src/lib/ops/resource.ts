import type { z } from 'zod';
import type { ModuleKey } from '@/lib/platform/modules';
import type { Permission } from '@/lib/platform/permissions';

/**
 * A school-scoped table served by the shared operations API
 * (`/api/ops/[resource]`). Declaring a resource is all a simple record type
 * needs: the route validates input with `schema`, checks the module and
 * permissions, confirms every referenced id belongs to the caller's school,
 * stamps `school_id`, and audits when asked. Workflows with rules beyond
 * that (approvals, roll calls, the timetable solver) get their own routes.
 *
 * Client-safe: pages import the same definition to build their forms.
 */
export interface ResourceDef<S extends z.ZodObject = z.ZodObject> {
    table: string;
    /** null for records that belong to no optional module (e.g. duties). */
    module: ModuleKey | null;
    label: { singular: string; plural: string };
    /** Any of these may list and read rows. */
    read: readonly Permission[];
    /** Any of these may create, edit and delete rows. */
    write: readonly Permission[];
    /** Create payload; edits accept any subset of it. */
    schema: S;
    /** PostgREST select, joins included. Defaults to '*'. */
    select?: string;
    order?: { column: string; ascending?: boolean };
    /** Query-string keys allowed as equality filters (each a column). */
    filters?: readonly string[];
    /** Query-string switches (`?open=1`) that keep rows whose column is (or is not) null. */
    flags?: Readonly<Record<string, { column: string; isNull: boolean }>>;
    /** Columns referencing another school-scoped table: checked on every write. */
    refs?: Readonly<Record<string, string>>;
    /** Columns referencing users (text ids): checked against the school's users. */
    userRefs?: readonly string[];
    /** Set to the caller's id on create. */
    createdByColumn?: string;
    /**
     * Rows people may manage for themselves without `write`: holders of
     * `permission` list, create, edit and delete only rows whose `column` is
     * their own id (forced on create).
     */
    own?: {
        column: string;
        permission: Permission;
        /** Fields an owner may set; anything else (a status, an approver) is dropped. */
        fields?: readonly string[];
        /** An owner may only edit or delete while this column holds one of these values. */
        editableWhile?: { column: string; values: readonly string[] };
    };
    /**
     * Rules across fields (end after start, doubles within the weekly count).
     * Zod refinements would stop edits from using `schema.partial()`, so they
     * live here; edits are checked against the row as it will be saved.
     */
    validate?: (values: Record<string, unknown>) => string | null;
    /** Write an audit entry for every change. */
    audit?: boolean;
    /** Largest page returned by a list. */
    maxRows?: number;
}

export function defineResource<S extends z.ZodObject>(def: ResourceDef<S>): ResourceDef<S> {
    return def;
}

export type ResourceInput<R extends ResourceDef> = z.input<R['schema']>;
export type ResourceValues<R extends ResourceDef> = z.infer<R['schema']>;

/** Columns every resource row has. */
export interface BaseRow {
    id: string;
    school_id: string;
    created_at: string;
}

/** Embeds a learner's name and admission number on any row with `student_id`. */
export const STUDENT_JOIN = 'student:students(admission_number, current_grade_stream_id, user:users(first_name, last_name))';

/** Embeds a person's name through a users foreign key (Postgres names it `<table>_<column>_fkey`). */
export const personJoin = (alias: string, table: string, column: string) =>
    `${alias}:users!${table}_${column}_fkey(first_name, last_name)`;

/** The embedded shapes those joins produce. */
export interface PersonName { first_name: string; last_name: string }
export interface StudentEmbed {
    admission_number: string | null;
    current_grade_stream_id: string;
    user: PersonName | null;
}
