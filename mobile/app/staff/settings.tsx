import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useAcademicStructure, useAcademicYears, useTerms } from '@/lib/useSchoolData';
import { findActiveTermId } from '@/lib/academics';
import { errorMessage, formatDate } from '@/lib/format';
import { colors, radius, spacing } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, InfoRow, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SectionLabel, SegmentedTabs, TextField, ToggleRow,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import type { PaymentSettingsStatus, Term } from '@/lib/types';
import { confirmAlert } from '@/lib/confirm';

interface SchoolProfile {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo_url: string | null;
    teacher_invite_code?: string | null;
    student_invite_code?: string | null;
    min_combination_group_size: number | null;
    overall_grading_system_id: string | null;
}

type Tab = 'school' | 'calendar' | 'grading' | 'payments';
type Msg = { tone: 'success' | 'danger'; text: string } | null;

export default function SettingsScreen() {
    return (
        <RequireScreen screen="settings">
            <SettingsContent />
        </RequireScreen>
    );
}

function SettingsContent() {
    const [tab, setTab] = useState<Tab>('school');
    return (
        <Screen>
            <ScreenHeader title="Settings" description="School profile, calendar, grading and payments." />
            <SegmentedTabs
                tabs={[
                    { value: 'school', label: 'School' },
                    { value: 'calendar', label: 'Calendar' },
                    { value: 'grading', label: 'Grading' },
                    { value: 'payments', label: 'Payments' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'school' ? <SchoolTab /> : tab === 'calendar' ? <CalendarTab /> : tab === 'grading' ? <GradingTab /> : <PaymentsTab />}
        </Screen>
    );
}

// ── School profile ─────────────────────────────────────────

function SchoolTab() {
    const api = useApi();
    const { data, loading, error, reload } = useApiQuery<SchoolProfile>('/api/school/data?type=school_profile');
    const [form, setForm] = useState<SchoolProfile | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<Msg>(null);

    useEffect(() => {
        if (data) setForm(data);
    }, [data]);

    if (loading || !form) return error ? <ErrorBanner message={error} onRetry={reload} /> : <LoadingView />;
    const set = <K extends keyof SchoolProfile>(k: K, v: SchoolProfile[K]) => setForm({ ...form, [k]: v });

    const save = async (next: SchoolProfile = form) => {
        if (!next.name.trim()) return setMessage({ tone: 'danger', text: 'School name is required.' });
        setSaving(true);
        setMessage(null);
        try {
            await api.post('/api/admin/school', {
                school_id: next.id,
                name: next.name.trim(),
                address: next.address?.trim() || null,
                phone: next.phone?.trim() || null,
                email: next.email?.trim() || null,
                logo_url: next.logo_url || null,
                min_combination_group_size: next.min_combination_group_size ?? null,
                overall_grading_system_id: next.overall_grading_system_id ?? null,
            });
            setMessage({ tone: 'success', text: 'School profile saved.' });
            reload();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to save') });
        } finally {
            setSaving(false);
        }
    };

    const uploadLogo = async () => {
        setUploading(true);
        try {
            const url = await api.pickAndUploadImage();
            if (url) {
                const next = { ...form, logo_url: url };
                setForm(next);
                await save(next);
            }
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Upload failed') });
        } finally {
            setUploading(false);
        }
    };

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                    {form.logo_url ? (
                        <Image source={{ uri: form.logo_url }} style={{ width: 64, height: 64, borderRadius: radius.md }} accessibilityLabel="School logo" />
                    ) : (
                        <View style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: colors.muted, fontSize: 11 }}>No logo</Text>
                        </View>
                    )}
                    <Button size="sm" variant="secondary" label={form.logo_url ? 'Change logo' : 'Upload logo'} onPress={uploadLogo} loading={uploading} />
                </View>
                <TextField label="School name" value={form.name} onChangeText={(v) => set('name', v)} />
                <TextField label="Address" value={form.address ?? ''} onChangeText={(v) => set('address', v)} multiline />
                <TextField label="Phone" value={form.phone ?? ''} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
                <TextField label="Email" value={form.email ?? ''} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
                <ButtonRow>
                    <Button label="Save profile" onPress={() => void save()} loading={saving} />
                </ButtonRow>
            </Card>
            {form.teacher_invite_code || form.student_invite_code ? (
                <Card>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.foreground, marginBottom: spacing.sm }}>School invite codes</Text>
                    <InfoRow label="Teachers" value={form.teacher_invite_code} />
                    <InfoRow label="Students" value={form.student_invite_code} />
                </Card>
            ) : null}
        </View>
    );
}

// ── Calendar: years and terms ──────────────────────────────

function CalendarTab() {
    const api = useApi();
    const { years, loading: yLoading, reload: reloadYears } = useAcademicYears();
    const { terms, loading: tLoading, reload: reloadTerms } = useTerms();
    const [yearDraft, setYearDraft] = useState<{ name: string; start: string; end: string } | null>(null);
    const [termDraft, setTermDraft] = useState<{ id: string | null; yearId: string | null; name: string; start: string; end: string; midterm: string; reopening: string; current: boolean } | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<Msg>(null);

    const run = async (work: () => Promise<unknown>, done: string) => {
        setBusy(true);
        setMessage(null);
        try {
            await work();
            setMessage({ tone: 'success', text: done });
            reloadYears();
            reloadTerms();
            return true;
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Something went wrong') });
            return false;
        } finally {
            setBusy(false);
        }
    };

    const saveYear = async () => {
        if (!yearDraft) return;
        if (await run(() => api.post('/api/admin/academic-structure', { type: 'academic_year', name: yearDraft.name.trim(), start_date: yearDraft.start.trim(), end_date: yearDraft.end.trim() }), 'Academic year added.')) setYearDraft(null);
    };

    const saveTerm = async () => {
        if (!termDraft) return;
        const fields = {
            name: termDraft.name.trim(),
            start_date: termDraft.start.trim(),
            end_date: termDraft.end.trim(),
            is_current: termDraft.current,
            midterm_reopening_date: termDraft.midterm.trim() || null,
            reopening_date: termDraft.reopening.trim() || null,
        };
        const ok = termDraft.id
            ? await run(() => api.patch('/api/admin/academic-structure', { type: 'term', id: termDraft.id, ...fields }), 'Term updated.')
            : await run(() => api.post('/api/admin/academic-structure', { type: 'term', academic_year_id: termDraft.yearId, ...fields }), 'Term added.');
        if (ok) setTermDraft(null);
    };

    const deleteTerm = (t: Term) =>
        confirmAlert(`Delete ${t.name}?`, 'Exams and marks linked to this term may stop resolving.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void run(() => api.del(withQuery('/api/admin/academic-structure', { type: 'term', id: t.id })), 'Term deleted.') },
        ]);

    if (yLoading || tLoading) return <LoadingView />;
    const activeId = findActiveTermId(terms);

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.sm }}>Dates are YYYY-MM-DD. Reopening dates print on report cards.</Text>

            {yearDraft ? (
                <Card style={{ marginBottom: spacing.md }}>
                    <TextField label="Year name" value={yearDraft.name} onChangeText={(name) => setYearDraft({ ...yearDraft, name })} placeholder="e.g. 2026" />
                    <TextField label="Starts" value={yearDraft.start} onChangeText={(start) => setYearDraft({ ...yearDraft, start })} placeholder="2026-01-05" />
                    <TextField label="Ends" value={yearDraft.end} onChangeText={(end) => setYearDraft({ ...yearDraft, end })} placeholder="2026-11-27" />
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setYearDraft(null)} />
                        <Button label="Add year" onPress={() => void saveYear()} loading={busy} />
                    </ButtonRow>
                </Card>
            ) : null}

            {termDraft ? (
                <Card style={{ marginBottom: spacing.md }}>
                    {!termDraft.id ? <ChipSelect label="Academic year" options={years.map((y) => ({ value: y.id, label: y.name }))} value={termDraft.yearId} onChange={(yearId) => setTermDraft({ ...termDraft, yearId })} /> : null}
                    <TextField label="Term name" value={termDraft.name} onChangeText={(name) => setTermDraft({ ...termDraft, name })} placeholder="Term 1" />
                    <TextField label="Starts" value={termDraft.start} onChangeText={(start) => setTermDraft({ ...termDraft, start })} />
                    <TextField label="Ends" value={termDraft.end} onChangeText={(end) => setTermDraft({ ...termDraft, end })} />
                    <TextField label="Mid-term reopening (optional)" value={termDraft.midterm} onChangeText={(midterm) => setTermDraft({ ...termDraft, midterm })} />
                    <TextField label="Next term reopening (optional)" value={termDraft.reopening} onChangeText={(reopening) => setTermDraft({ ...termDraft, reopening })} />
                    <ToggleRow label="Current term" value={termDraft.current} onValueChange={(current) => setTermDraft({ ...termDraft, current })} />
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setTermDraft(null)} />
                        <Button label={termDraft.id ? 'Save term' : 'Add term'} onPress={() => void saveTerm()} loading={busy} disabled={!termDraft.id && !termDraft.yearId} />
                    </ButtonRow>
                </Card>
            ) : null}

            {!yearDraft && !termDraft ? (
                <ButtonRow>
                    <Button variant="secondary" label="+ Year" onPress={() => setYearDraft({ name: '', start: '', end: '' })} />
                    <Button label="+ Term" onPress={() => setTermDraft({ id: null, yearId: years[0]?.id ?? null, name: '', start: '', end: '', midterm: '', reopening: '', current: false })} disabled={years.length === 0} />
                </ButtonRow>
            ) : null}

            {years.length === 0 ? <EmptyState title="No academic years yet" description="Add a year, then its terms." /> : null}
            {years.map((y) => (
                <View key={y.id}>
                    <SectionLabel>{y.name}{y.start_date ? ` · ${formatDate(y.start_date)} – ${y.end_date ? formatDate(y.end_date) : ''}` : ''}</SectionLabel>
                    <ListCard>
                        {terms.filter((t) => t.academic_year_id === y.id).length === 0 ? <EmptyState title="No terms" /> : null}
                        {terms
                            .filter((t) => t.academic_year_id === y.id)
                            .map((t) => (
                                <ListRow
                                    key={t.id}
                                    title={t.name}
                                    subtitle={t.start_date ? `${formatDate(t.start_date)} – ${t.end_date ? formatDate(t.end_date) : '—'}` : 'No dates'}
                                    right={
                                        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                                            {t.id === activeId ? <Badge label="Active" variant="success" /> : null}
                                            <Button size="sm" variant="ghost" label="Edit" onPress={() => setTermDraft({ id: t.id, yearId: t.academic_year_id, name: t.name, start: t.start_date ?? '', end: t.end_date ?? '', midterm: t.midterm_reopening_date ?? '', reopening: t.reopening_date ?? '', current: t.is_current })} />
                                            <Button size="sm" variant="ghost" label="✕" onPress={() => deleteTerm(t)} />
                                        </View>
                                    }
                                />
                            ))}
                    </ListCard>
                </View>
            ))}
        </View>
    );
}

// ── Grading ────────────────────────────────────────────────

function GradingTab() {
    const api = useApi();
    const structure = useAcademicStructure();
    const profile = useApiQuery<SchoolProfile>('/api/school/data?type=school_profile');
    const [open, setOpen] = useState<string | null>(null);
    const [message, setMessage] = useState<Msg>(null);

    if (structure.loading || profile.loading) return <LoadingView />;
    const systems = structure.data?.grading_systems ?? [];
    const scales = structure.data?.grading_scales ?? [];
    const levels = structure.data?.academic_levels ?? [];
    const overall = systems.filter((s) => s.system_kind === 'OVERALL');

    const setOverall = async (id: string) => {
        const p = profile.data;
        if (!p) return;
        try {
            await api.post('/api/admin/school', { school_id: p.id, name: p.name, address: p.address, phone: p.phone, email: p.email, logo_url: p.logo_url, overall_grading_system_id: id });
            setMessage({ tone: 'success', text: 'Overall grading system updated.' });
            profile.reload();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to update') });
        }
    };

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            {overall.length > 0 ? (
                <Card style={{ marginBottom: spacing.md }}>
                    <ChipSelect label="Overall grade (points) system" wrap options={overall.map((s) => ({ value: s.id, label: s.name }))} value={profile.data?.overall_grading_system_id ?? null} onChange={(id) => void setOverall(id)} />
                    <Text style={{ fontSize: 12, color: colors.muted }}>Used for the mean grade on 8-4-4 report cards. Each subject's scale is set under Subjects.</Text>
                </Card>
            ) : null}
            {levels.map((level) => {
                const inLevel = systems.filter((s) => s.academic_level_id === level.id);
                if (inLevel.length === 0) return null;
                return (
                    <View key={level.id}>
                        <SectionLabel>{level.name}</SectionLabel>
                        <ListCard>
                            {inLevel.map((s) => (
                                <View key={s.id}>
                                    <ListRow title={s.name} subtitle={s.system_kind === 'OVERALL' ? 'Overall (points)' : 'Subject (percent)'} onPress={() => setOpen(open === s.id ? null : s.id)} />
                                    {open === s.id ? (
                                        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                                            {scales
                                                .filter((sc) => sc.grading_system_id === s.id)
                                                .map((sc) => (
                                                    <InfoRow key={`${sc.symbol}-${sc.min_percentage}`} label={`${sc.symbol}${sc.label && sc.label !== sc.symbol ? ` · ${sc.label}` : ''}`} value={`${sc.min_percentage} – ${sc.max_percentage}`} />
                                                ))}
                                        </View>
                                    ) : null}
                                </View>
                            ))}
                        </ListCard>
                    </View>
                );
            })}
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: spacing.md }}>Grading systems are shared templates; editing band boundaries stays on the web.</Text>
        </View>
    );
}

// ── Payments ───────────────────────────────────────────────

function PaymentsTab() {
    const { data, loading, error, reload } = useApiQuery<PaymentSettingsStatus>('/api/school/payment-settings/status');
    if (loading) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={reload} />;
    const provider = data?.provider ?? 'NONE';
    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <InfoRow label="Online payments" value={provider === 'DARAJA' ? 'M-Pesa (Daraja)' : provider === 'PESAPAL' ? 'Pesapal' : 'Not set up'} />
                <InfoRow label="Bank transfers" value={data?.bankEnabled ? 'Shown to parents' : 'Off'} />
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: spacing.sm }}>
                    Paybill keys and callback URLs are secrets; set them up from Settings → Payments on the web, on a trusted computer.
                </Text>
            </Card>
            {(data?.bankAccounts ?? []).length > 0 ? (
                <>
                    <SectionLabel>Bank accounts</SectionLabel>
                    <ListCard>
                        {(data?.bankAccounts ?? []).map((a) => (
                            <ListRow key={a.id} title={`${a.bankName} · ${a.accountNumber}`} subtitle={`${a.accountName}${a.branch ? ` · ${a.branch}` : ''}`} right={a.isPrimary ? <Badge label="Primary" variant="info" /> : undefined} />
                        ))}
                    </ListCard>
                </>
            ) : null}
        </View>
    );
}
