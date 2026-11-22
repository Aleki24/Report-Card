import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { humanize } from '@shared/ops/format';
import { GUARDIAN_RELATIONSHIPS, type GuardianRelationship } from '@shared/ops/forms/platform';
import { CLASS_LINK_LIMIT, splitName, type ClassGuardianLearner, type ClassLinkResult } from '@shared/parents/class-guardians';
import { normalizeMpesaPhone } from '@shared/phone';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { errorMessage } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { Button, ChipSelect, EmptyState, ErrorBanner, LoadingView, Notice, TextField } from '@/components/ui';
import { LookupField } from '@/components/ops/SelectField';

interface Draft { first: string; last: string; phone: string; relationship: GuardianRelationship }

const blank = (l: ClassGuardianLearner): Draft => {
    const { first, last } = splitName(l.recordName);
    return { first, last, phone: l.recordPhone ?? '', relationship: 'GUARDIAN' };
};
/** Filled in enough to link: both names and a phone. */
const ready = (d: Draft | undefined): d is Draft => !!d && !!d.first.trim() && !!d.last.trim() && d.phone.trim().length >= 9;

/**
 * The web's "Whole class": link a class's parents in one sitting, starting
 * from the contact on each learner's record. Each parent gets the portal
 * invite by SMS; a parent of two learners is matched by phone, not made twice.
 */
export function ClassParents() {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const [streamId, setStreamId] = useState('');
    const query = useApiQuery<ClassGuardianLearner[]>(streamId ? withQuery('/api/admin/parents/class', { grade_stream_id: streamId }) : null);
    const learners = query.data;
    const [edits, setEdits] = useState<Record<string, Partial<Draft>>>({});
    const [results, setResults] = useState<Record<string, ClassLinkResult>>({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);

    const draftOf = (l: ClassGuardianLearner): Draft => ({ ...blank(l), ...edits[l.id] });
    const unlinked = useMemo(() => (learners ?? []).filter((l) => l.links.length === 0), [learners]);
    const toLink = unlinked.filter((l) => ready(draftOf(l)) && !results[l.id]?.ok);
    const linkedCount = (learners ?? []).length - unlinked.length + Object.values(results).filter((r) => r.ok).length;
    const update = (id: string, patch: Partial<Draft>) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

    const pick = (id: string) => {
        setStreamId(id);
        setEdits({});
        setResults({});
        setMessage(null);
    };

    const save = async () => {
        const batch = toLink.slice(0, CLASS_LINK_LIMIT);
        if (batch.length === 0) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await api.post<{ data: ClassLinkResult[] }>('/api/admin/parents/class', {
                links: batch.map((l) => {
                    const d = draftOf(l);
                    return { student_id: l.id, first_name: d.first.trim(), last_name: d.last.trim(), phone: d.phone.trim(), relationship: d.relationship, is_primary: true };
                }),
            });
            const out = res.data ?? [];
            setResults((prev) => ({ ...prev, ...Object.fromEntries(out.map((r) => [r.student_id, r])) }));
            const ok = out.filter((r) => r.ok).length;
            const failed = out.length - ok;
            setMessage(failed === 0
                ? { tone: 'success', text: `Linked ${ok} ${ok === 1 ? 'parent' : 'parents'}. New parents get their invite code by SMS.` }
                : { tone: 'warning', text: `Linked ${ok}; ${failed} need a look (marked below).` });
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not link the parents') });
        } finally {
            setSaving(false);
        }
    };

    return (
        <View>
            <LookupField label="Class" lookup="streams" value={streamId} onChange={pick} />
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            {!streamId ? null : query.error && !learners ? (
                <ErrorBanner message={query.error} onRetry={query.reload} />
            ) : !learners ? (
                <LoadingView />
            ) : learners.length === 0 ? (
                <EmptyState title="No active learners in this class" />
            ) : (
                <>
                    <View style={styles.summary}>
                        <Text style={styles.summaryText}>{linkedCount} of {learners.length} learners have a parent linked</Text>
                        <Button
                            label={saving ? 'Linking…' : `Link ${toLink.length} ${toLink.length === 1 ? 'parent' : 'parents'}`}
                            onPress={save}
                            loading={saving}
                            disabled={toLink.length === 0}
                        />
                    </View>
                    {learners.map((l) => {
                        const d = draftOf(l);
                        const result = results[l.id];
                        const linked = l.links.length > 0 || result?.ok;
                        const phoneOk = !d.phone.trim() || !!normalizeMpesaPhone(d.phone);
                        return (
                            <View key={l.id} style={[styles.card, result && !result.ok && { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }]}>
                                <Text style={styles.name}>{l.name}{l.admissionNumber ? <Text style={styles.sub}> · {l.admissionNumber}</Text> : null}</Text>
                                {linked ? (
                                    <View style={styles.linked}>
                                        <CheckCircle2 size={14} color={colors.successText} />
                                        <Text style={[styles.sub, { color: colors.successText, flex: 1 }]}>
                                            {l.links.length > 0
                                                ? l.links.map((g) => `${g.name}${g.relationship ? ` (${humanize(g.relationship).toLowerCase()})` : ''}`).join(', ')
                                                : result?.reused ? 'Linked to their existing parent account' : 'Linked · invite sent'}
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        <View style={styles.pair}>
                                            <View style={{ flex: 1 }}><TextField label="First name" value={d.first} onChangeText={(t) => update(l.id, { first: t })} /></View>
                                            <View style={{ flex: 1 }}><TextField label="Last name" value={d.last} onChangeText={(t) => update(l.id, { last: t })} /></View>
                                        </View>
                                        <TextField label="Phone" value={d.phone} onChangeText={(t) => update(l.id, { phone: t })} keyboardType="phone-pad" placeholder="07…" />
                                        {!phoneOk ? <Text style={[styles.sub, { color: colors.warningText }]}>That doesn’t look like a Kenyan mobile number; SMS may not reach it.</Text> : null}
                                        <ChipSelect label="Relationship" options={GUARDIAN_RELATIONSHIPS.map((r) => ({ value: r, label: humanize(r) }))} value={d.relationship} onChange={(r) => update(l.id, { relationship: r })} />
                                    </>
                                )}
                                {result && !result.ok ? <Text style={[styles.sub, { color: colors.danger }]}>{result.error}</Text> : null}
                            </View>
                        );
                    })}
                </>
            )}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    summary: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, marginBottom: spacing.md },
    summaryText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    card: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, marginBottom: spacing.sm },
    name: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    sub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    linked: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pair: { flexDirection: 'row', gap: spacing.sm },
}));
