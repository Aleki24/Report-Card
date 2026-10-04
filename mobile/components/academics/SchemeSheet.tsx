import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { personName } from '@shared/ops/format';
import {
    SCHEME_ACTION_DONE, SCHEME_DETAIL_FIELDS, SCHEME_TONES, nextSchemeEntry, schemeActions, schemeEntriesPayload, taughtRecord,
    type SchemeAction, type SchemeDetail, type SchemeEntry,
} from '@shared/ops/forms/academics';
import { Button, ButtonRow, Card, LoadingView, Notice, SectionLabel, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { FormSheet } from '@/components/ops/FormSheet';
import { StatusPill } from '@/components/ops/bits';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { spacing, fonts, makeStyles, useTheme } from '@/lib/theme';

const ACTION_LABELS: Record<SchemeAction, string> = { SUBMIT: 'Submit for review', APPROVE: 'Approve', RETURN: 'Return' };

interface Props { schemeId: string; canReview: boolean; userId: string; onClose: () => void; onChanged: () => void }

/** The weekly plan: edit rows, draft them with AI, submit for review, and tick lessons as taught — the web's scheme editor. */
export function SchemeSheet({ schemeId, canReview, userId, onClose, onChanged }: Props) {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const toast = useToast();
    const [scheme, setScheme] = useState<SchemeDetail | null>(null);
    const [entries, setEntries] = useState<SchemeEntry[]>([]);
    const [open, setOpen] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState({ weeks: '12', lessons: '4', topics: '' });
    const [showDraft, setShowDraft] = useState(false);
    const [comment, setComment] = useState('');

    const load = useCallback(async () => {
        try {
            const s = await opsGet<SchemeDetail>(api, `/api/academics/schemes/${schemeId}`);
            setScheme(s);
            setEntries(s.entries);
            setDirty(false);
        } catch (err) { toast.error(errorMessage(err, 'Could not open the scheme')); onClose(); }
    }, [api, schemeId, toast, onClose]);
    useEffect(() => { void load(); }, [load]);

    const edit = (i: number, patch: Partial<SchemeEntry>) => { setEntries((es) => es.map((e, j) => (j === i ? { ...e, ...patch } : e))); setDirty(true); };

    const work = async (run: () => Promise<unknown>, success: string, reload = true) => {
        setBusy(true);
        try {
            await run();
            toast.success(success);
            if (reload) { await load(); onChanged(); }
            return true;
        } catch (err) {
            toast.error(errorMessage(err, 'Something went wrong'));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const save = () => void work(() => api.put(`/api/academics/schemes/${schemeId}/entries`, { entries: schemeEntriesPayload(entries) }), 'Scheme saved.');

    const runDraft = async () => {
        setBusy(true);
        try {
            const r = await api.post<{ data: { entries: SchemeEntry[] } }>(`/api/academics/schemes/${schemeId}/draft`, {
                weeks: Number(draft.weeks), lessons_per_week: Number(draft.lessons), topics: draft.topics,
            });
            setEntries(r.data.entries);
            setDirty(true);
            toast.success(`${r.data.entries.length} lessons drafted. Review them, then save.`);
        } catch (err) { toast.error(errorMessage(err, 'Drafting failed')); }
        finally { setBusy(false); }
    };

    const transition = (action: SchemeAction) => void work(
        () => api.post(`/api/academics/schemes/${schemeId}/transition`, { action, comment: comment || undefined }),
        SCHEME_ACTION_DONE[action],
    ).then((ok) => { if (ok) setComment(''); });

    const markTaught = (e: SchemeEntry & { id: string }) => {
        if (scheme) void work(() => api.post('/api/ops/records-of-work', taughtRecord(scheme, e)), 'Recorded as taught.');
    };

    const isOwner = scheme?.teacher_id === userId;
    const covered = new Set(scheme?.covered ?? []);
    const actions = scheme ? schemeActions(scheme, { owner: isOwner, reviewer: canReview }) : [];

    return (
        <FormSheet
            visible
            title={scheme?.title ?? 'Scheme of work'}
            onClose={onClose}
            onSubmit={scheme?.editable && dirty ? save : undefined}
            submitLabel="Save scheme"
            submitting={busy}
        >
            {!scheme ? <LoadingView /> : (
                <View>
                    <ButtonRow>
                        <StatusPill status={scheme.status} tones={SCHEME_TONES} />
                        <Text style={styles.muted}>{scheme.subject?.name} · {scheme.stream?.full_name} · {personName(scheme.teacher)} · {covered.size}/{scheme.entries.length} taught</Text>
                    </ButtonRow>
                    {scheme.review_comment ? <View style={{ marginTop: spacing.sm }}><Notice tone="warning" message={`Reviewer: ${scheme.review_comment}`} /></View> : null}

                    {scheme.editable ? (
                        <Card style={styles.draft}>
                            <Pressable onPress={() => setShowDraft((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showDraft }}>
                                <Text style={styles.title}>Draft with AI {showDraft ? '▴' : '▾'}</Text>
                            </Pressable>
                            {showDraft ? (
                                <View style={{ marginTop: spacing.md }}>
                                    <View style={styles.row2}>
                                        <View style={{ flex: 1 }}><TextField label="Teaching weeks" value={draft.weeks} onChangeText={(v) => setDraft((d) => ({ ...d, weeks: v }))} keyboardType="number-pad" /></View>
                                        <View style={{ flex: 1 }}><TextField label="Lessons a week" value={draft.lessons} onChangeText={(v) => setDraft((d) => ({ ...d, lessons: v }))} keyboardType="number-pad" /></View>
                                    </View>
                                    <TextField label="Topics this term (optional)" value={draft.topics} onChangeText={(v) => setDraft((d) => ({ ...d, topics: v }))} multiline />
                                    <Button size="sm" label={busy ? 'Drafting…' : 'Draft entries'} onPress={() => void runDraft()} disabled={busy} />
                                    <Text style={[styles.muted, { marginTop: spacing.sm }]}>Replaces the rows below with a draft. Check every row before saving.</Text>
                                </View>
                            ) : null}
                        </Card>
                    ) : null}

                    <SectionLabel>Lessons</SectionLabel>
                    {entries.map((e, i) => {
                        const taught = !!e.id && covered.has(e.id);
                        const expanded = open === i;
                        return (
                            <Card key={e.id ?? `new-${i}`} style={[styles.entry, taught && { borderColor: colors.success }]}>
                                <View style={styles.entryHead}>
                                    <Text style={styles.weekTag}>W{e.week} · L{e.lesson}</Text>
                                    {scheme.editable ? (
                                        <View style={{ flex: 1 }}><TextField value={e.topic} placeholder="Topic" onChangeText={(v) => edit(i, { topic: v })} /></View>
                                    ) : (
                                        <Text style={[styles.title, { flex: 1 }]}>{e.topic}{e.sub_topic ? <Text style={styles.muted}> · {e.sub_topic}</Text> : null}</Text>
                                    )}
                                    {taught ? <Text style={{ color: colors.success, fontFamily: fonts.display }}>✓</Text> : null}
                                </View>
                                <ButtonRow>
                                    {!taught && e.id && isOwner && !dirty ? <Button size="sm" variant="secondary" label="Taught" onPress={() => markTaught(e as SchemeEntry & { id: string })} /> : null}
                                    <Button size="sm" variant="ghost" label={expanded ? 'Hide details' : 'Details'} onPress={() => setOpen(expanded ? null : i)} />
                                    {scheme.editable ? <Button size="sm" variant="ghost" label="Remove" onPress={() => { setEntries((es) => es.filter((_, j) => j !== i)); setDirty(true); }} /> : null}
                                </ButtonRow>
                                {expanded ? (
                                    <View style={{ marginTop: spacing.sm }}>
                                        {scheme.editable ? (
                                            <>
                                                <View style={styles.row2}>
                                                    <View style={{ flex: 1 }}><TextField label="Week" value={String(e.week)} onChangeText={(v) => edit(i, { week: Number(v) || 1 })} keyboardType="number-pad" /></View>
                                                    <View style={{ flex: 1 }}><TextField label="Lesson" value={String(e.lesson)} onChangeText={(v) => edit(i, { lesson: Number(v) || 1 })} keyboardType="number-pad" /></View>
                                                </View>
                                                <TextField label="Sub-topic / sub-strand" value={e.sub_topic ?? ''} onChangeText={(v) => edit(i, { sub_topic: v || null })} />
                                            </>
                                        ) : null}
                                        {SCHEME_DETAIL_FIELDS.map(([key, label]) => (scheme.editable ? (
                                            <TextField key={key} label={label} value={e[key] ?? ''} onChangeText={(v) => edit(i, { [key]: v || null })} multiline />
                                        ) : (
                                            <View key={key} style={{ marginBottom: spacing.sm }}>
                                                <Text style={styles.fieldLabel}>{label}</Text>
                                                <Text style={styles.body}>{e[key] || '—'}</Text>
                                            </View>
                                        )))}
                                    </View>
                                ) : null}
                            </Card>
                        );
                    })}
                    {scheme.editable ? (
                        <Button variant="secondary" size="sm" label="+ Add lesson" onPress={() => { setEntries((es) => [...es, nextSchemeEntry(es)]); setOpen(entries.length); setDirty(true); }} />
                    ) : null}

                    {actions.length > 0 ? (
                        <View style={{ marginTop: spacing.lg }}>
                            {canReview && scheme.status !== 'DRAFT' && scheme.status !== 'RETURNED' ? (
                                <TextField label="Review comment" value={comment} onChangeText={setComment} multiline />
                            ) : null}
                            <ButtonRow>
                                {actions.map((a) => (
                                    <Button key={a} variant={a === 'RETURN' ? 'danger' : 'primary'} label={ACTION_LABELS[a]} onPress={() => transition(a)} disabled={busy || (a === 'SUBMIT' && dirty)} />
                                ))}
                            </ButtonRow>
                            {dirty ? <Text style={styles.muted}>Save your changes before submitting.</Text> : null}
                        </View>
                    ) : null}
                </View>
            )}
        </FormSheet>
    );
}

const useStyles = makeStyles((colors) => ({
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    title: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    draft: { marginTop: spacing.md, padding: spacing.md, borderStyle: 'dashed' },
    row2: { flexDirection: 'row', gap: spacing.sm },
    entry: { marginBottom: spacing.sm, padding: spacing.md },
    entryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    weekTag: { width: 64, fontSize: 12, fontFamily: fonts.bold, color: colors.muted },
    fieldLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted },
    body: { fontFamily: fonts.regular, fontSize: 13, color: colors.foreground },
}));
