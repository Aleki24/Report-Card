import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RESOURCES, type ResourceName } from '@shared/ops/registry';
import { fromFormValues, missingRequired, toFormValues, type FieldDef, type FieldName, type FormValues } from '@shared/ops/form';
import { Button, ButtonRow, Card, EmptyState, ErrorBanner, InfoRow, LoadingView, SearchField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { confirmAlert } from '@/lib/confirm';
import { useOpsList, type QueryParams } from '@/lib/ops';
import { colors, spacing } from '@/lib/theme';
import { FormSheet } from './FormSheet';
import { RecordForm } from './RecordForm';
import { useRefreshSignal } from './bits';

type Permit<T> = boolean | ((row: T) => boolean);
const allowed = <T,>(permit: Permit<T> | undefined, row: T) => (typeof permit === 'function' ? permit(row) : !!permit);

export type Detail = readonly [label: string, value: string | number | null | undefined];

export interface ResourceListProps<R extends ResourceName, T extends { id: string }> {
    resource: R;
    /** The card's heading. */
    title: (row: T) => string;
    subtitle?: (row: T) => string | null | undefined;
    /** A status pill beside the heading. */
    badge?: (row: T) => React.ReactNode;
    /** Label/value lines on the card — the web table's other columns. */
    details?: (row: T) => readonly Detail[];
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
    onRowPress?: (row: T) => void;
}

/**
 * The list-and-form screen every simple record type shares — the phone
 * version of the web's `ResourceManager`, built from the same resource
 * definitions and form fields: cards, search, a sheet to add or edit, and a
 * confirmed delete. Validation, permissions and school scoping live on the
 * server.
 */
export function ResourceList<R extends ResourceName, T extends { id: string }>({
    resource, title, subtitle, badge, details, fields, params, canCreate, canEdit, canDelete, defaults,
    searchText, rowActions, header, addLabel, emptyText, onRowPress,
}: ResourceListProps<R, T>) {
    const def = RESOURCES[resource];
    const toast = useToast();
    const { rows, loading, error, reload, create, update, remove } = useOpsList<T>(resource, params);
    useRefreshSignal(reload);
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<T | 'new' | null>(null);
    const [values, setValues] = useState<FormValues>({});
    const [saving, setSaving] = useState(false);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q && searchText ? rows.filter((r) => searchText(r).toLowerCase().includes(q)) : rows;
    }, [rows, query, searchText]);

    const singular = def.label.singular.toLowerCase();

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

    const confirmDelete = (row: T) =>
        confirmAlert(`Delete ${singular}?`, 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void remove(row.id, `${def.label.singular} deleted.`) },
        ]);

    return (
        <View>
            {header?.(rows, reload)}

            {searchText ? <SearchField value={query} onChangeText={setQuery} placeholder={`Search ${def.label.plural.toLowerCase()}`} /> : null}
            {canCreate && fields ? (
                <View style={{ marginBottom: spacing.md }}>
                    <Button label={`+ ${addLabel ?? `Add ${singular}`}`} onPress={() => open('new')} block />
                </View>
            ) : null}

            {error && !loading ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}

            {loading ? (
                <LoadingView />
            ) : shown.length === 0 ? (
                <EmptyState title={query ? 'Nothing matches your search.' : emptyText ?? `No ${def.label.plural.toLowerCase()} yet.`} />
            ) : (
                shown.map((row) => {
                    const edit = !!fields && allowed(canEdit, row);
                    const del = allowed(canDelete, row);
                    const extra = rowActions?.(row, reload);
                    const lines = details?.(row).filter(([, v]) => v !== undefined) ?? [];
                    const sub = subtitle?.(row);
                    return (
                        <Card key={row.id} style={styles.card}>
                            <View style={styles.head}>
                                <Text style={styles.title} onPress={onRowPress ? () => onRowPress(row) : undefined} numberOfLines={3}>
                                    {title(row)}
                                </Text>
                                {badge?.(row)}
                            </View>
                            {sub ? <Text style={styles.sub}>{sub}</Text> : null}
                            {lines.length > 0 ? (
                                <View style={{ marginTop: spacing.sm }}>
                                    {lines.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
                                </View>
                            ) : null}
                            {extra || edit || del || onRowPress ? (
                                <ButtonRow>
                                    {extra}
                                    {onRowPress ? <Button size="sm" variant="secondary" label="Open" onPress={() => onRowPress(row)} /> : null}
                                    {edit ? <Button size="sm" variant="secondary" label="Edit" onPress={() => open(row)} /> : null}
                                    {del ? <Button size="sm" variant="ghost" label="Delete" onPress={() => confirmDelete(row)} /> : null}
                                </ButtonRow>
                            ) : null}
                        </Card>
                    );
                })
            )}

            {fields ? (
                <FormSheet
                    visible={editing !== null}
                    title={editing === 'new' ? `New ${singular}` : `Edit ${singular}`}
                    onClose={() => setEditing(null)}
                    onSubmit={() => void save()}
                    submitting={saving}
                >
                    <RecordForm fields={fields} values={values} onChange={(name, v) => setValues((prev) => ({ ...prev, [name]: v }))} />
                </FormSheet>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { marginBottom: spacing.sm, padding: spacing.md },
    head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
    title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.foreground },
    sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
