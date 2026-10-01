import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { humanize } from '@shared/ops/format';
import {
    EMPTY_PARENT_FORM, GUARDIAN_RELATIONSHIPS, guardianName, guardianStatus, parentLinkedMessage,
    type GuardianLink, type ParentForm, type ParentLinkResult,
} from '@shared/ops/forms/platform';
import { Button, Card, ChipSelect, EmptyState, ListCard, ListRow, Notice, SectionLabel, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { LookupField } from '@/components/ops/SelectField';
import { useRefreshSignal } from '@/components/ops/bits';
import { useApi, withQuery } from '@/lib/api';
import { confirmAlert } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { colors, spacing } from '@/lib/theme';

/** Link parents to learners; new parents get an invite code by SMS. */
function ParentLinks() {
    const api = useApi();
    const toast = useToast();
    const [studentId, setStudentId] = useState('');
    const [links, setLinks] = useState<GuardianLink[]>([]);
    const [form, setForm] = useState<ParentForm>(EMPTY_PARENT_FORM);
    const [saving, setSaving] = useState(false);
    const [code, setCode] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!studentId) return;
        try { setLinks(await opsGet<GuardianLink[]>(api, withQuery('/api/admin/parents', { student_id: studentId }))); }
        catch (err) { toast.error(errorMessage(err, 'Could not load parents')); }
    }, [api, studentId, toast]);
    useEffect(() => { void load(); }, [load]);
    useRefreshSignal(load);

    const add = async () => {
        if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) { toast.error('Fill in the parent’s name and phone.'); return; }
        setSaving(true);
        try {
            const r = await api.post<{ data: ParentLinkResult }>('/api/admin/parents', { ...form, student_id: studentId });
            setCode(r.data.invite_code);
            toast.success(parentLinkedMessage(r.data));
            setForm(EMPTY_PARENT_FORM);
            await load();
        } catch (err) { toast.error(errorMessage(err, 'Could not link the parent')); }
        finally { setSaving(false); }
    };

    const unlink = (l: GuardianLink) => confirmAlert('Unlink this parent?', guardianName(l), [
        { text: 'Cancel', style: 'cancel' },
        {
            text: 'Unlink',
            style: 'destructive',
            onPress: () => void api.del(`/api/admin/parents/${l.id}`).then(() => { toast.success('Unlinked.'); return load(); })
                .catch((err: unknown) => toast.error(errorMessage(err, 'Could not unlink'))),
        },
    ]);

    const set = (k: keyof ParentForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

    return (
        <View>
            <LookupField label="Learner" lookup="students" value={studentId} onChange={(v) => { setStudentId(v); setCode(null); setLinks([]); }} />
            {studentId ? (
                <>
                    {links.length === 0 ? <EmptyState title="No parents linked to this learner yet." /> : (
                        <ListCard>
                            {links.map((l) => (
                                <ListRow
                                    key={l.id}
                                    title={guardianName(l)}
                                    subtitle={`${humanize(l.relationship)} · ${l.parent?.phone ?? '—'} · ${guardianStatus(l)}`}
                                    right={<Button size="sm" variant="ghost" label="Unlink" onPress={() => unlink(l)} />}
                                />
                            ))}
                        </ListCard>
                    )}
                    <SectionLabel>Link a parent</SectionLabel>
                    <Card>
                        <TextField label="First name *" value={form.first_name} onChangeText={set('first_name')} />
                        <TextField label="Last name *" value={form.last_name} onChangeText={set('last_name')} />
                        <TextField label="Phone *" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
                        <Text style={{ fontSize: 11, color: colors.muted, marginTop: -spacing.sm, marginBottom: spacing.md }}>A parent already linked to another child is matched by phone.</Text>
                        <ChipSelect label="Relationship" wrap options={GUARDIAN_RELATIONSHIPS.map((r) => ({ value: r, label: humanize(r) }))} value={form.relationship} onChange={set('relationship')} />
                        <Button label={saving ? 'Linking…' : 'Link parent'} onPress={() => void add()} loading={saving} block />
                    </Card>
                    {code ? <View style={{ marginTop: spacing.md }}><Notice tone="info" message={`Invite code: ${code} — the parent activates at the sign-in page with this code.`} /></View> : null}
                </>
            ) : null}
        </View>
    );
}

export default function ParentAccountsScreen() {
    return (
        <ModuleScreen
            screen="parent-accounts"
            title="Parent accounts"
            description="Give parents their own sign-in to follow each of their children."
            tabs={[{ id: 'links', label: 'Parents', render: () => <ParentLinks /> }]}
        />
    );
}
