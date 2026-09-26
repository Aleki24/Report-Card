"use client";

import React, { useId, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Drawer } from '@/components/ui/Drawer';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import { SearchBox } from '@/components/ui/SearchBox';
import { useOpsList, type QueryParams } from '@/hooks/useOpsList';
import { RESOURCES, type ResourceName } from '@/lib/ops/registry';
import { RecordForm } from './RecordForm';
import { fromFormValues, missingRequired, toFormValues, type FieldDef, type FieldName, type FormValues } from './fields';

type Permit<T> = boolean | ((row: T) => boolean);
const allowed = <T,>(permit: Permit<T> | undefined, row: T) => (typeof permit === 'function' ? permit(row) : !!permit);

export interface ResourceManagerProps<R extends ResourceName, T extends { id: string }> {
    resource: R;
    columns: DataTableColumn<T>[];
    /** The form; leave out for a read-only list. */
    fields?: readonly FieldDef<FieldName<R>>[];
    /** Equality filters and flags sent to the API. */
    params?: QueryParams;
    canCreate?: boolean;
    canEdit?: Permit<T>;
    canDelete?: Permit<T>;
    /** Starting values for a new record. */
    defaults?: Partial<Record<FieldName<R>, string | boolean>>;
    /** Text a row is found by; enables the search box. */
    searchText?: (row: T) => string;
    /** Extra buttons per row (approve, return, discharge…); `reload` refreshes the list. */
    rowActions?: (row: T, reload: () => Promise<void>) => React.ReactNode;
    /** Shown above the list (filters, figures) and given the loaded rows. */
    header?: (rows: T[], reload: () => Promise<void>) => React.ReactNode;
    addLabel?: string;
    emptyText?: string;
    mobileTitleKey?: string;
    onRowClick?: (row: T) => void;
}

/**
 * The list-and-form screen every simple record type shares: a responsive
 * table (cards on phones), search, a drawer to add or edit, and a confirmed
 * delete. Validation, permissions and school scoping live on the server.
 */
export function ResourceManager<R extends ResourceName, T extends { id: string }>({
    resource, columns, fields, params, canCreate, canEdit, canDelete, defaults, searchText,
    rowActions, header, addLabel, emptyText, mobileTitleKey, onRowClick,
}: ResourceManagerProps<R, T>) {
    const def = RESOURCES[resource];
    const { rows, loading, error, reload, create, update, remove } = useOpsList<T>(resource, params);
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<T | 'new' | null>(null);
    const [values, setValues] = useState<FormValues>({});
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<T | null>(null);
    const formId = useId();

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q && searchText ? rows.filter(r => searchText(r).toLowerCase().includes(q)) : rows;
    }, [rows, query, searchText]);

    const open = (row: T | 'new') => {
        if (!fields) return;
        setValues(toFormValues(fields, row === 'new' ? null : (row as unknown as Record<string, unknown>), defaults));
        setEditing(row);
    };

    const save = async () => {
        if (!fields || !editing) return;
        const missing = missingRequired(fields, values);
        if (missing.length > 0) {
            toast.error(`Please fill in: ${missing.join(', ')}`);
            return;
        }
        setSaving(true);
        const payload = fromFormValues(fields, values);
        const ok = editing === 'new'
            ? await create(payload, `${def.label.singular} added.`)
            : await update(editing.id, payload, `${def.label.singular} updated.`);
        setSaving(false);
        if (ok) setEditing(null);
    };

    const actionsFor = (row: T) => {
        const edit = fields && allowed(canEdit, row);
        const del = allowed(canDelete, row);
        const extra = rowActions?.(row, reload);
        if (!edit && !del && !extra) return null;
        return (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
                {extra}
                {edit && (
                    <Button variant="ghost" size="icon-sm" onClick={() => open(row)} aria-label={`Edit ${def.label.singular.toLowerCase()}`}>
                        <Pencil />
                    </Button>
                )}
                {del && (
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(row)} aria-label={`Delete ${def.label.singular.toLowerCase()}`}>
                        <Trash2 className="text-destructive" />
                    </Button>
                )}
            </div>
        );
    };

    return (
        <section className="flex flex-col gap-4">
            {header?.(rows, reload)}

            {(searchText || (canCreate && fields)) && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {searchText && (
                        <SearchBox value={query} onChange={setQuery} placeholder={`Search ${def.label.plural.toLowerCase()}`} className="sm:max-w-sm sm:flex-1" />
                    )}
                    {canCreate && fields && (
                        <Button onClick={() => open('new')} className="sm:ml-auto">
                            <Plus /> {addLabel ?? `Add ${def.label.singular.toLowerCase()}`}
                        </Button>
                    )}
                </div>
            )}

            {error && !loading && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
            )}

            <DataTable
                columns={columns}
                rows={shown}
                rowKey={r => r.id}
                loading={loading}
                rowActions={rowActions || canEdit || canDelete ? actionsFor : undefined}
                emptyState={emptyText ?? `No ${def.label.plural.toLowerCase()} yet.`}
                mobileTitleKey={mobileTitleKey}
                onRowClick={onRowClick}
            />

            {fields && (
                <Drawer
                    isOpen={editing !== null}
                    onClose={() => setEditing(null)}
                    title={editing === 'new' ? `New ${def.label.singular.toLowerCase()}` : `Edit ${def.label.singular.toLowerCase()}`}
                    size="lg"
                    footer={
                        <>
                            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                        </>
                    }
                >
                    <form id={formId} onSubmit={e => { e.preventDefault(); void save(); }}>
                        <RecordForm fields={fields} values={values} idPrefix={formId} onChange={(name, v) => setValues(prev => ({ ...prev, [name]: v }))} />
                    </form>
                </Drawer>
            )}

            <ConfirmDialog
                isOpen={deleting !== null}
                onClose={() => setDeleting(null)}
                onConfirm={async () => {
                    if (!deleting) return;
                    const ok = await remove(deleting.id, `${def.label.singular} deleted.`);
                    if (ok) setDeleting(null);
                }}
                title={`Delete ${def.label.singular.toLowerCase()}?`}
                message="This cannot be undone."
                confirmText="Delete"
                variant="danger"
            />
        </section>
    );
}
