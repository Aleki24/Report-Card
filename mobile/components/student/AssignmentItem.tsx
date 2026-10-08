import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, CircleCheck, Paperclip, Star, type LucideIcon } from 'lucide-react-native';
import { dueLabel, dueState, localToday, type StudentAssignment } from '@shared/assignments';
import { attachmentName } from '@shared/attachments';
import { formatDate } from '@/lib/format';
import { useFileViewer } from '@/components/FileViewer';
import { viewableAttachment } from '@/lib/viewableFile';
import { fonts, makeStyles, radius, spacing, useTheme, type Palette } from '@/lib/theme';
import { Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { SubmitAssignment } from './SubmitAssignment';

export type HomeworkStatus = 'graded' | 'handed-in' | 'overdue' | 'due';

export function homeworkStatus(a: StudentAssignment, today = localToday()): HomeworkStatus {
    if (a.submission?.gradedAt || a.submission?.grade != null) return 'graded';
    if (a.submission) return 'handed-in';
    return dueState(a.dueDate, today) === 'overdue' ? 'overdue' : 'due';
}

/** What needs doing first: work due, then overdue, then handed in, then marked. */
export const HOMEWORK_ORDER: Readonly<Record<HomeworkStatus, number>> = { due: 0, overdue: 1, 'handed-in': 2, graded: 3 };

export const sortHomework = (list: readonly StudentAssignment[], today = localToday()): StudentAssignment[] =>
    [...list].sort((a, b) => HOMEWORK_ORDER[homeworkStatus(a, today)] - HOMEWORK_ORDER[homeworkStatus(b, today)] || a.dueDate.localeCompare(b.dueDate));

interface Chip { bg: string; fg: string; label: string; icon: LucideIcon | null }

function statusChip(a: StudentAssignment, status: HomeworkStatus, colors: Palette, today: string): Chip {
    if (status === 'graded') {
        return {
            bg: colors.scheme === 'dark' ? '#2a1f4d' : '#ede9fe',
            fg: colors.scheme === 'dark' ? '#c4b5fd' : '#6d28d9',
            label: a.submission?.grade != null ? `Marked · ${a.submission.grade}%` : 'Marked',
            icon: Star,
        };
    }
    if (status === 'handed-in') return { bg: colors.successBg, fg: colors.success, label: 'Handed in', icon: CircleCheck };
    if (status === 'overdue') return { bg: colors.dangerBg, fg: colors.danger, label: dueLabel(a.dueDate, today), icon: null };
    const soon = dueState(a.dueDate, today) !== 'later';
    return { bg: soon ? colors.warningBg : colors.mutedBg, fg: soon ? colors.warning : colors.muted, label: dueLabel(a.dueDate, today), icon: null };
}

/**
 * One piece of homework as the learner sees it. Tapping it opens the
 * teacher's instructions and worksheet, what the learner handed in, and the
 * grade and feedback once marked; work not yet marked can be handed in here.
 *
 * Tapping used to go straight to the hand-in form, which showed only the
 * title: the instructions and the attached worksheet never reached the app.
 */
export function AssignmentItem({ assignment: a, divider, showSubject = true, onChanged }: {
    assignment: StudentAssignment;
    divider?: boolean;
    showSubject?: boolean;
    onChanged: () => void;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    const toast = useToast();
    const viewer = useFileViewer();
    const [open, setOpen] = useState(false);
    const [handingIn, setHandingIn] = useState(false);
    const today = localToday();
    const status = homeworkStatus(a, today);
    const chip = statusChip(a, status, colors, today);
    const ChipIcon = chip.icon;
    const Chevron = open ? ChevronUp : ChevronDown;
    const mine = a.submission;

    const view = (url: string) => viewer.view(viewableAttachment(url));

    return (
        <View style={[styles.item, divider && styles.divider]}>
            <Pressable
                onPress={() => { setOpen(!open); setHandingIn(false); }}
                style={styles.head}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${a.title}, ${chip.label}`}
            >
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={open ? undefined : 1}>{a.title}</Text>
                    {showSubject ? <Text style={styles.meta} numberOfLines={1}>{a.subjectName}</Text> : null}
                </View>
                <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                    {ChipIcon ? <ChipIcon size={11} color={chip.fg} /> : null}
                    <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
                </View>
                <Chevron size={18} color={colors.muted} />
            </Pressable>

            {open ? (
                <View style={styles.body}>
                    <Text style={styles.label}>Instructions · due {formatDate(a.dueDate, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                    {a.description
                        ? <Text style={styles.text} selectable>{a.description}</Text>
                        : <Text style={styles.muted}>{a.fileUrl ? 'Your teacher attached the work below.' : 'No written instructions.'}</Text>}
                    {a.fileUrl ? <FileButton label={attachmentName(a.fileUrl)} onPress={() => view(a.fileUrl as string)} /> : null}

                    {mine ? (
                        <View style={styles.mine}>
                            <Text style={styles.label}>Your hand-in · {formatDate(mine.submittedAt, { day: 'numeric', month: 'short' })}</Text>
                            {mine.text ? <Text style={styles.text} selectable>{mine.text}</Text> : null}
                            {mine.fileUrl ? <FileButton label={attachmentName(mine.fileUrl)} onPress={() => view(mine.fileUrl as string)} /> : null}
                            {status === 'graded' ? (
                                <View style={styles.grade}>
                                    <Text style={styles.gradeValue}>{mine.grade != null ? `${mine.grade}%` : 'Marked'}</Text>
                                    {mine.feedback ? <Text style={styles.text} selectable>“{mine.feedback}”</Text> : <Text style={styles.muted}>No comment from your teacher.</Text>}
                                </View>
                            ) : null}
                        </View>
                    ) : null}

                    {status === 'graded' ? (
                        <Text style={styles.muted}>Your teacher has marked this, so it can’t be changed.</Text>
                    ) : handingIn ? (
                        <SubmitAssignment
                            assignment={a}
                            onCancel={() => setHandingIn(false)}
                            onDone={() => {
                                setHandingIn(false);
                                toast.success(mine ? 'Your hand-in was updated.' : 'Handed in. Well done!');
                                onChanged();
                            }}
                        />
                    ) : (
                        <View style={styles.actions}>
                            <Button size="sm" label={mine ? 'Replace my hand-in' : 'Hand in'} onPress={() => setHandingIn(true)} />
                        </View>
                    )}
                </View>
            ) : null}
        </View>
    );
}

function FileButton({ label, onPress }: { label: string; onPress: () => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.file, pressed && { opacity: 0.7 }]} accessibilityRole="link" accessibilityLabel={`Open ${label}`}>
            <Paperclip size={15} color={colors.primary} />
            <Text style={styles.fileText} numberOfLines={1}>{label}</Text>
            <Text style={styles.fileAction}>Open</Text>
        </Pressable>
    );
}

const useStyles = makeStyles((colors) => ({
    item: { paddingVertical: spacing.md },
    divider: { borderTopWidth: 1, borderTopColor: colors.border },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    meta: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    chipText: { fontSize: 11, fontFamily: fonts.bold },
    body: { gap: spacing.sm, marginTop: spacing.md },
    label: { fontSize: 11, fontFamily: fonts.bold, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.muted },
    text: { fontSize: 14, lineHeight: 21, fontFamily: fonts.regular, color: colors.foreground },
    muted: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted },
    file: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
    fileText: { flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },
    fileAction: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
    mine: { gap: spacing.sm, marginTop: spacing.xs, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    grade: { gap: 4, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.mutedBg },
    gradeValue: { fontSize: 18, fontFamily: fonts.display, color: colors.foreground },
    actions: { flexDirection: 'row', justifyContent: 'flex-end' },
}));
