import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { dateTime, humanize, personName } from '@shared/ops/format';
import { EDITABLE_BY_OWNER, PRINT_STATUSES, TRANSITIONS, canAct, canOpenFiles, type PaperAction, type PaperFileKind } from '@shared/academics/exam-papers';
import { PAPER_ACTION_ORDER, PAPER_FILE_TYPES, PAPER_STATUS_TONES, type ExamPaper, type PaperReview } from '@shared/ops/forms/academics';
import { Button, ButtonRow, ChipSelect, InfoRow, LoadingView, SectionLabel, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { FormSheet } from '@/components/ops/FormSheet';
import { StatusPill } from '@/components/ops/bits';
import { useApi, type PickedFile } from '@/lib/api';
import { errorMessage, fileSafe } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { colors, spacing } from '@/lib/theme';

type Detail = ExamPaper & { reviews: PaperReview[] };

/** A paper's details, files, moderation history and the actions open to the viewer — the web's paper drawer. */
export function ExamPaperSheet({ paperId, onClose, onChanged }: { paperId: string; onClose: () => void; onChanged: () => void }) {
    const api = useApi();
    const toast = useToast();
    const { profile, can } = useCurrentUser();
    const [paper, setPaper] = useState<Detail | null>(null);
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    const [replace, setReplace] = useState<{ paper: PickedFile | null; scheme: PickedFile | null }>({ paper: null, scheme: null });

    const load = useCallback(async () => {
        try { setPaper(await opsGet<Detail>(api, `/api/academics/exam-papers/${paperId}`)); }
        catch (err) { toast.error(errorMessage(err, 'Could not open the paper')); onClose(); }
    }, [api, paperId, toast, onClose]);
    useEffect(() => { void load(); }, [load]);

    const actor = { userId: profile?.id ?? '', can };

    const act = async (work: () => Promise<unknown>, success: string) => {
        setBusy(true);
        try {
            await work();
            toast.success(success);
            await load();
            onChanged();
            return true;
        } catch (err) {
            toast.error(errorMessage(err, 'Something went wrong'));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const run = (action: PaperAction) => void act(
        () => api.post(`/api/academics/exam-papers/${paperId}/transition`, { action, comment: comment || undefined }),
        `${TRANSITIONS[action].label}: done.`,
    ).then((ok) => { if (ok) setComment(''); });

    const openFile = (kind: PaperFileKind) => {
        if (!paper) return;
        api.downloadAndShare(`/api/academics/exam-papers/${paperId}/file?kind=${kind}`, `${fileSafe(paper.title)}-${kind}.pdf`)
            .catch((err: unknown) => toast.error(errorMessage(err, 'Could not open the file')));
    };

    const pick = async (kind: 'paper' | 'scheme') => {
        const file = await api.pickFile(PAPER_FILE_TYPES).catch(() => null);
        if (file) setReplace((r) => ({ ...r, [kind]: file }));
    };

    const actions = paper ? PAPER_ACTION_ORDER.filter((a) => canAct(a, paper, actor)) : [];
    const canComment = paper ? canAct('COMMENT', paper, actor) : false;
    const ownerEditable = !!paper && ((paper.uploaded_by === actor.userId && EDITABLE_BY_OWNER.includes(paper.status)) || can('exam_papers.manage'));

    return (
        <FormSheet visible title={paper?.title ?? 'Exam paper'} onClose={onClose}>
            {!paper ? <LoadingView /> : (
                <View>
                    <View style={{ marginBottom: spacing.sm }}><StatusPill status={paper.status} tones={PAPER_STATUS_TONES} /></View>
                    <InfoRow label="Subject" value={`${paper.subject?.name ?? '—'}${paper.paper_label ? ` (${paper.paper_label})` : ''}`} />
                    <InfoRow label="Class" value={paper.grade?.name_display ?? 'Any'} />
                    <InfoRow label="Term / exam" value={[paper.term?.name, paper.exam?.name].filter(Boolean).join(' · ') || '—'} />
                    <InfoRow label="Set by" value={personName(paper.uploader)} />
                    <InfoRow label="Moderated by" value={paper.moderator ? personName(paper.moderator) : '—'} />
                    <InfoRow label="Release" value={dateTime(paper.release_at)} />
                    <InfoRow label="Copies" value={paper.copies_needed || '—'} />

                    {canOpenFiles(paper, actor) ? (
                        <>
                            <ButtonRow>
                                <Button variant="secondary" label="Open paper" onPress={() => openFile('paper')} disabled={!paper.paper_path} />
                                <Button variant="secondary" label="Marking scheme" onPress={() => openFile('scheme')} disabled={!paper.scheme_path} />
                            </ButtonRow>
                            <Text style={styles.note}>PDFs open stamped with your name and the time. Every download is logged.</Text>
                        </>
                    ) : null}

                    {ownerEditable ? (
                        <>
                            <SectionLabel>Replace files</SectionLabel>
                            <ButtonRow>
                                <Button size="sm" variant="secondary" label={replace.paper ? `Paper: ${replace.paper.name}` : 'Choose paper'} onPress={() => void pick('paper')} />
                                <Button size="sm" variant="secondary" label={replace.scheme ? `Scheme: ${replace.scheme.name}` : 'Choose scheme'} onPress={() => void pick('scheme')} />
                                <Button
                                    size="sm"
                                    label="Upload"
                                    disabled={busy || (!replace.paper && !replace.scheme)}
                                    onPress={() => void act(() => api.sendForm('PATCH', `/api/academics/exam-papers/${paperId}`, {}, replace), 'Files replaced.')
                                        .then((ok) => { if (ok) setReplace({ paper: null, scheme: null }); })}
                                />
                            </ButtonRow>
                        </>
                    ) : null}

                    {can('exam_papers.manage') && (paper.status === 'APPROVED' || paper.status === 'LOCKED') ? (
                        <View style={{ marginTop: spacing.md }}>
                            <ChipSelect
                                label="Printing"
                                options={PRINT_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
                                value={paper.print_status}
                                onChange={(v) => void act(() => api.patch(`/api/academics/exam-papers/${paperId}`, { print_status: v }), 'Printing updated.')}
                            />
                        </View>
                    ) : null}

                    {actions.length > 0 || canComment ? (
                        <View style={{ marginTop: spacing.md }}>
                            <TextField label="Comment" value={comment} onChangeText={setComment} multiline placeholder="Required when returning a paper." />
                            <ButtonRow>
                                {actions.map((a) => (
                                    <Button key={a} variant={a === 'RETURN' ? 'danger' : 'primary'} label={TRANSITIONS[a].label} disabled={busy} onPress={() => run(a)} />
                                ))}
                                {canComment ? <Button variant="secondary" label="Add comment" disabled={busy || !comment.trim()} onPress={() => run('COMMENT')} /> : null}
                            </ButtonRow>
                        </View>
                    ) : null}

                    <SectionLabel>History</SectionLabel>
                    {paper.reviews.length === 0 ? <Text style={styles.note}>No moderation activity yet.</Text> : paper.reviews.map((r) => (
                        <View key={r.id} style={styles.review}>
                            <Text style={styles.reviewHead}>{personName(r.reviewer)} <Text style={styles.note}>· {humanize(r.action)} · {dateTime(r.created_at)}</Text></Text>
                            {r.comment ? <Text style={styles.note}>{r.comment}</Text> : null}
                        </View>
                    ))}
                </View>
            )}
        </FormSheet>
    );
}

const styles = StyleSheet.create({
    note: { fontSize: 12, color: colors.muted, marginTop: 4 },
    review: { borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.md, marginBottom: spacing.sm },
    reviewHead: { fontSize: 13, fontWeight: '700', color: colors.foreground },
});
