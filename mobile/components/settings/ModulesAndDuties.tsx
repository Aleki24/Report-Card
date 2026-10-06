import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DateField } from '@/components/DateField';
import { StyleSheet, Switch, Text, View } from 'react-native';
import {
    MODULES, MODULE_CATEGORIES, MODULE_CATEGORY_LABELS, MODULE_LIST, MODULE_PRESETS,
    dependents, withDependencies, type ModuleKey,
} from '@shared/platform/modules';
import { DUTIES, DUTY_KEYS, SCOPE_LABELS, dutyDefinition, type DutyKey } from '@shared/platform/permissions';
import { date, personName } from '@shared/ops/format';
import {
    EMPTY_DUTY_FORM, PRESET_WARNING, dutyPayload, moduleChangeMessage,
    type DutyForm, type DutyRow, type ModuleChange, type ModuleState,
} from '@shared/ops/forms/platform';
import { Button, ButtonRow, Card, EmptyState, LoadingView, SectionLabel, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { FormSheet } from '@/components/ops/FormSheet';
import { LookupField, SelectField } from '@/components/ops/SelectField';
import { useApi } from '@/lib/api';
import { confirmAlert } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';
import { opsGet, useLookup, useOpsList } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { spacing, fonts, makeStyles, useTheme } from '@/lib/theme';

const MODULES_PATH = '/api/platform/modules';

/**
 * Which modules the school runs — the web's Modules tab. Switching one off
 * hides it everywhere and keeps its data; the account reloads so every tab
 * reflects the change.
 */
export function ModulesPanel() {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const toast = useToast();
    const { reload: reloadAccount } = useCurrentUser();
    const [states, setStates] = useState<ModuleState[] | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { setStates(await opsGet<ModuleState[]>(api, MODULES_PATH)); }
        catch (err) { toast.error(errorMessage(err, 'Could not load modules')); setStates([]); }
    }, [api, toast]);
    useEffect(() => { void load(); }, [load]);

    const byKey = useMemo(() => new Map((states ?? []).map((s) => [s.key, s])), [states]);

    const apply = async (body: ModuleChange) => {
        setBusy(true);
        try {
            setStates((await api.put<{ data: ModuleState[] }>(MODULES_PATH, body)).data);
            toast.success('Modules updated.');
            // Tabs and screen guards read modules from the account; refresh it.
            reloadAccount();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not update modules'));
        } finally {
            setBusy(false);
        }
    };

    const toggle = (key: ModuleKey, enabled: boolean) => {
        const also = enabled
            ? withDependencies(key).filter((k) => k !== key && !byKey.get(k)?.enabled)
            : dependents(key).filter((k) => byKey.get(k)?.enabled);
        if (also.length === 0) { void apply({ module: key, enabled }); return; }
        confirmAlert(enabled ? `Turn on ${MODULES[key].name}?` : `Turn off ${MODULES[key].name}?`, moduleChangeMessage(enabled, also), [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => void apply({ module: key, enabled }) },
        ]);
    };

    if (!states) return <LoadingView />;

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <Text style={styles.title}>Start from a preset</Text>
                <Text style={styles.muted}>Pick the kind of school you run; you can fine-tune each module below. Nothing is ever deleted. {states.filter((s) => s.enabled).length} of {states.length} modules on.</Text>
                <ButtonRow>
                    {MODULE_PRESETS.map((p) => (
                        <Button
                            key={p.id}
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            label={`${p.name} (${p.modules.length})`}
                            onPress={() => confirmAlert(`Apply “${p.name}”?`, PRESET_WARNING, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Continue', onPress: () => void apply({ preset: p.id }) },
                            ])}
                        />
                    ))}
                </ButtonRow>
            </Card>

            {MODULE_CATEGORIES.map((category) => (
                <View key={category}>
                    <SectionLabel>{MODULE_CATEGORY_LABELS[category]}</SectionLabel>
                    {MODULE_LIST.filter((m) => m.category === category).map((m) => {
                        const state = byKey.get(m.key);
                        const on = !!state?.enabled;
                        const locked = state?.entitled === false;
                        return (
                            <Card key={m.key} style={[styles.module, on && { borderColor: colors.primary }]}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.title}>{m.name}</Text>
                                    <Text style={styles.muted}>{m.description}</Text>
                                    {m.requires.length > 0 ? <Text style={styles.needs}>Needs {m.requires.map((r) => MODULES[r].name).join(', ')}</Text> : null}
                                    {locked ? <Text style={[styles.needs, { color: colors.warning }]}>Not included in your plan</Text> : null}
                                </View>
                                <Switch
                                    value={on}
                                    disabled={busy || locked}
                                    onValueChange={(v) => toggle(m.key, v)}
                                    trackColor={{ true: colors.primary, false: colors.border }}
                                    accessibilityLabel={m.name}
                                />
                            </Card>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

/** Options for a duty's scope: its classes, dorms or routes. */
function useScopeOptions(scope: ReturnType<typeof dutyDefinition>['scope']) {
    const streams = useLookup('streams');
    const dorms = useOpsList<{ id: string; name: string }>('dorms', {}, { enabled: scope === 'DORM' });
    const routes = useOpsList<{ id: string; name: string }>('routes', {}, { enabled: scope === 'ROUTE' });
    switch (scope) {
        case 'STREAM': return streams;
        case 'DORM': return { options: dorms.rows.map((d) => ({ id: d.id, label: d.name })), loading: dorms.loading };
        case 'ROUTE': return { options: routes.rows.map((r) => ({ id: r.id, label: r.name })), loading: routes.loading };
        default: return { options: [], loading: false };
    }
}

/**
 * Who holds which job — the web's Duties tab: DOS, bursar, matron, nurse,
 * driver… Each duty grants its permissions on top of the login role.
 */
export function DutiesPanel() {
    const styles = useStyles();
    const toast = useToast();
    const { hasModule } = useCurrentUser();
    const { rows, loading, create, remove } = useOpsList<DutyRow>('duties');
    const [form, setForm] = useState<DutyForm>(EMPTY_DUTY_FORM);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const offered = DUTY_KEYS.filter((k) => { const m = dutyDefinition(k).module; return !m || hasModule(m); });
    const duty = form.duty ? dutyDefinition(form.duty) : null;
    const scope = duty?.scope;
    const scopeOptions = useScopeOptions(scope);

    const save = async () => {
        if (!form.user_id || !form.duty) { toast.error('Choose a person and a duty.'); return; }
        setSaving(true);
        const ok = await create(dutyPayload(form, scope), 'Duty assigned.');
        setSaving(false);
        if (ok) { setOpen(false); setForm(EMPTY_DUTY_FORM); }
    };

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <Text style={styles.title}>Roles & duties</Text>
                <Text style={styles.muted}>Give staff the jobs they do: a teacher can also be DOS or a patron; a bursar or nurse signs in as Staff and gets their module.</Text>
                <View style={{ marginTop: spacing.md }}><Button label="+ Assign duty" onPress={() => setOpen(true)} block /></View>
            </Card>

            {loading ? <LoadingView /> : rows.length === 0 ? (
                <EmptyState title="No duties assigned yet." description="Admins keep full access; teachers keep what they had." />
            ) : rows.map((r) => (
                <Card key={r.id} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                    <Text style={styles.title}>{personName(r.user)}</Text>
                    <Text style={styles.muted}>
                        {DUTIES[r.duty]?.label ?? r.duty} · {r.scope_type ? SCOPE_LABELS[r.scope_type] ?? r.scope_type : 'Whole school'} · {r.starts_on || r.ends_on ? `${date(r.starts_on)} – ${date(r.ends_on)}` : 'Ongoing'}
                    </Text>
                    <ButtonRow>
                        <Button
                            size="sm"
                            variant="ghost"
                            label="Remove"
                            onPress={() => confirmAlert('Remove this duty?', `${personName(r.user)} will no longer be ${DUTIES[r.duty]?.label ?? r.duty}.`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Remove', style: 'destructive', onPress: () => void remove(r.id, 'Duty removed.') },
                            ])}
                        />
                    </ButtonRow>
                </Card>
            ))}

            <SectionLabel>What each duty can do</SectionLabel>
            {offered.map((k) => (
                <Card key={k} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                    <Text style={styles.title}>{DUTIES[k].label}</Text>
                    <Text style={styles.muted}>{DUTIES[k].description}</Text>
                </Card>
            ))}

            <FormSheet visible={open} title="Assign a duty" onClose={() => setOpen(false)} onSubmit={() => void save()} submitLabel="Assign" submitting={saving}>
                <LookupField label="Person" required lookup="staff" value={form.user_id} onChange={(v) => setForm((f) => ({ ...f, user_id: v }))} />
                <SelectField
                    label="Duty"
                    required
                    hint={duty?.description}
                    value={form.duty}
                    onChange={(v) => setForm((f) => ({ ...f, duty: v as DutyKey, scope_id: '' }))}
                    options={offered.map((k) => ({ id: k, label: DUTIES[k].label }))}
                />
                {scope ? (
                    <SelectField
                        label={`${SCOPE_LABELS[scope] ?? 'Scope'} (optional)`}
                        hint="Leave empty for the whole school."
                        options={scopeOptions.options}
                        loading={scopeOptions.loading}
                        value={form.scope_id}
                        onChange={(v) => setForm((f) => ({ ...f, scope_id: v }))}
                        clearable
                    />
                ) : null}
                <DateField label="From (optional)" optional value={form.starts_on} onChange={(v) => setForm((f) => ({ ...f, starts_on: v }))} />
                <DateField label="Until (optional)" optional min={form.starts_on || undefined} value={form.ends_on} onChange={(v) => setForm((f) => ({ ...f, ends_on: v }))} />
            </FormSheet>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    title: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    needs: { fontSize: 11, color: colors.muted, marginTop: spacing.xs, fontFamily: fonts.semibold },
    module: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
}));
