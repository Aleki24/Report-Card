import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronUp, CircleAlert, GraduationCap, LogOut, Repeat2, Route, type LucideIcon } from 'lucide-react-native';
import {
    OUTCOME_COPY, allowedOutcomes, choiceProblem, learnerMatches, outcomeLabel, stepCopy,
    type GradeStep, type PromotionClass, type PromotionGrade, type PromotionLearner, type PromotionOutcome, type StepTone,
} from '@shared/promotion';
import { pluralize } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import type { PromotionPlanApi } from '@/lib/usePromotionPlan';
import { ChipSelect, IconTile } from '@/components/ui';

/** The same icons as the web; wording and colour come from `@shared/promotion`. */
export const OUTCOME_ICONS: Record<PromotionOutcome, LucideIcon> = { PROMOTE: ArrowUpRight, GRADUATE: GraduationCap, REPEAT: Repeat2, TRANSFER: LogOut };
const STEP_ICONS: Record<StepTone, LucideIcon> = { MOVES_UP: ArrowUpRight, DECIDE: Route, LEAVES: GraduationCap };

/** The outcomes open to a grade as chips: a choice with `value`, one-tap actions without. */
function OutcomeChips({ step, value, onChange, label }: { step: GradeStep; value?: PromotionOutcome | null; onChange: (o: PromotionOutcome) => void; label: string }) {
    const { colors, tones } = useTheme();
    const styles = useStyles();
    const choosing = value !== undefined;
    return (
        <View style={styles.chips} accessibilityRole={choosing ? 'radiogroup' : undefined} accessibilityLabel={label}>
            {allowedOutcomes(step).map((o) => {
                const tone = tones[OUTCOME_COPY[o].hue];
                const Icon = OUTCOME_ICONS[o];
                const checked = value === o;
                return (
                    <Pressable
                        key={o}
                        onPress={() => onChange(o)}
                        accessibilityRole={choosing ? 'radio' : 'button'}
                        accessibilityState={choosing ? { checked } : undefined}
                        hitSlop={4}
                        style={({ pressed }) => [
                            styles.chip,
                            checked ? { backgroundColor: tone.bg, borderColor: tone.solid } : { borderColor: colors.border },
                            pressed && { opacity: 0.7 },
                        ]}
                    >
                        <Icon size={14} color={checked ? tone.fg : colors.muted} />
                        <Text style={[styles.chipText, { color: checked ? tone.fg : colors.foreground }]}>{outcomeLabel(o, step)}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function ClassPicker({ label, value, grade, onChange }: { label: string; value: string | null; grade: PromotionGrade; onChange: (id: string) => void }) {
    return (
        <ChipSelect
            label={label}
            layout="picker"
            placeholder="Choose a class…"
            options={grade.nextClasses.map((c) => ({ value: c.id, label: c.full_name }))}
            value={value}
            onChange={onChange}
        />
    );
}

function LearnerRow({ learner, classId, grade, plan }: { learner: PromotionLearner; classId: string; grade: PromotionGrade; plan: PromotionPlanApi }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const choice = plan.choices[learner.id];
    const problem = choiceProblem(grade, choice);
    return (
        <View style={styles.learner}>
            <Text style={styles.learnerName} numberOfLines={1}>{learner.name}</Text>
            <View style={styles.metaRow}>
                <Text style={styles.meta}>{learner.admission_number ? `Adm ${learner.admission_number}` : 'No admission number'}</Text>
                {problem ? (
                    <View style={styles.metaRow}>
                        <CircleAlert size={12} color={colors.warning} />
                        <Text style={[styles.meta, { color: colors.warning, fontFamily: fonts.semibold }]}>{problem}</Text>
                    </View>
                ) : null}
            </View>
            <OutcomeChips step={grade.step} value={choice.outcome} onChange={(outcome) => plan.setLearner(learner.id, classId, { outcome })} label={`What happens to ${learner.name}`} />
            {choice.outcome === 'PROMOTE' && grade.nextClasses.length > 1 ? (
                <ClassPicker label="Moves into" value={choice.to} grade={grade} onChange={(to) => plan.setLearner(learner.id, classId, { to })} />
            ) : null}
        </View>
    );
}

function ClassBlock({ cls, grade, plan, learners, startOpen, searching }: { cls: PromotionClass; grade: PromotionGrade; plan: PromotionPlanApi; learners: PromotionLearner[]; startOpen: boolean; searching: boolean }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const [open, setOpen] = useState(startOpen);
    const pending = cls.learners.filter((l) => !plan.choices[l.id].outcome).length;
    // A search shows its matches; otherwise the list opens and closes on tap.
    const shown = open || searching;
    const Chevron = shown ? ChevronUp : ChevronDown;
    return (
        <View style={styles.classBlock}>
            <Text style={styles.className}>{cls.full_name}</Text>
            <Text style={styles.meta}>
                {pluralize(cls.learners.length, 'learner')}
                {pending > 0 ? <Text style={{ color: colors.warning, fontFamily: fonts.semibold }}> · {pending} to decide</Text> : null}
            </Text>
            {grade.nextClasses.length > 0 && cls.learners.length > 0 ? (
                <ClassPicker label="Class moves into" value={plan.classTargets[cls.id] ?? null} grade={grade} onChange={(to) => plan.setClassTarget(cls.id, to)} />
            ) : null}
            {learners.length > 0 ? (
                <>
                    <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: shown }} style={styles.toggle}>
                        <Text style={styles.toggleText}>
                            {shown ? 'Hide learners' : learners.length === cls.learners.length ? 'Change anyone repeating or leaving' : `${pluralize(learners.length, 'matching learner')}`}
                        </Text>
                        <Chevron size={16} color={colors.primary} />
                    </Pressable>
                    {shown ? learners.map((l) => <LearnerRow key={l.id} learner={l} classId={cls.id} grade={grade} plan={plan} />) : null}
                </>
            ) : null}
        </View>
    );
}

/** One grade: where its learners go, set for the whole grade, a class, or a learner. */
export function GradePromotionCard({ grade, plan, query }: { grade: PromotionGrade; plan: PromotionPlanApi; query: string }) {
    const { colors, tones } = useTheme();
    const styles = useStyles();
    const copy = stepCopy(grade.step, grade.name);
    const tone = tones[copy.hue];
    const mustDecide = copy.tone === 'DECIDE';
    const learnerCount = grade.classes.reduce((n, c) => n + c.learners.length, 0);
    const visible = grade.classes.map((cls) => ({ cls, learners: cls.learners.filter((l) => learnerMatches(l, query)) }));
    if (query && visible.every((v) => v.learners.length === 0)) return null;

    return (
        <View style={styles.card}>
            <View style={styles.head}>
                <IconTile icon={STEP_ICONS[copy.tone]} hue={copy.hue} />
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{grade.name}</Text>
                        <ArrowRight size={14} color={colors.muted} />
                        <Text style={[styles.title, { color: tone.fg }]}>{copy.target}</Text>
                    </View>
                    <Text style={styles.meta}>{grade.curriculum} · {pluralize(learnerCount, 'learner')} in {pluralize(grade.classes.length, 'class', 'classes')}</Text>
                </View>
            </View>
            <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                <Text style={[styles.badgeText, { color: tone.fg }]}>{copy.badge}</Text>
            </View>
            <Text style={[styles.explain, mustDecide ? { backgroundColor: colors.warningBg, color: colors.foreground } : { backgroundColor: colors.mutedBg }]}>{copy.explain}</Text>
            {learnerCount > 0 ? (
                <View style={{ marginTop: spacing.sm }}>
                    <Text style={styles.label}>Everyone in {grade.name}</Text>
                    <OutcomeChips step={grade.step} onChange={(o) => plan.setClassesOutcome(grade.classes.map((c) => c.id), o)} label={`Set every ${grade.name} learner`} />
                </View>
            ) : null}
            {visible.map(({ cls, learners }) => (
                <ClassBlock key={cls.id} cls={cls} grade={grade} plan={plan} learners={learners} startOpen={mustDecide} searching={!!query} />
            ))}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    title: { fontSize: 16, fontFamily: fonts.bold, color: colors.foreground },
    badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: spacing.sm },
    badgeText: { fontSize: 12, fontFamily: fonts.semibold },
    explain: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.sm, overflow: 'hidden' },
    label: { fontSize: 12, fontFamily: fonts.semibold, color: colors.muted, marginBottom: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36 },
    chipText: { fontSize: 13, fontFamily: fonts.semibold },
    classBlock: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.sm, gap: 4 },
    className: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 },
    toggleText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary, flexShrink: 1 },
    learner: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm, gap: 6 },
    learnerName: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
    meta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
}));
