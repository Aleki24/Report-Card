import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react-native';
import { subjectTimeRows, type TimetablePlan } from '@shared/timetable/readiness';
import type { TimetableConfig } from '@shared/timetable/config';
import {
    DOUBLE_RULE_COPY, MAX_RULES, RULE_KINDS, RULE_KIND_COPY, RULE_STRENGTHS, RULE_STRENGTH_COPY,
    newRuleId, ruleConflicts, ruleSentence, type DoubleRules, type RuleKind, type RuleStrength, type TimetableRule,
} from '@shared/timetable/rules';
import { Button, ButtonRow, ChipSelect, ToggleRow } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { confirmAlert } from '@/lib/confirm';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';

const CONFIG_URL = '/api/academics/timetable/config';
const EVERY_CLASS = '*';

type Patch = { relations?: TimetableRule[]; doubles?: Partial<DoubleRules>; span_short_break?: string[] };

/** Why a rule cannot be kept in some classes, whatever the timetable. */
function Conflicts({ lines }: { lines: readonly string[] }) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.warn}>
            <AlertTriangle size={16} color={colors.warningText} />
            <View style={{ flex: 1 }}>
                <Text style={[styles.warnTitle, { color: colors.warningText }]}>Cannot be kept everywhere</Text>
                {lines.map((l) => <Text key={l} style={[styles.small, { color: colors.warningText }]}>• {l}</Text>)}
            </View>
        </View>
    );
}

/**
 * The web's Rules step: the built-in rules on doubles, the school's own rules
 * (subjects kept apart, not on end, not on days in a row) and the subjects whose doubles may run across
 * a short break. A phone rule holds for one class or every class.
 */
export function TimetableRules({ plan, config, onChange }: { plan: TimetablePlan; config: TimetableConfig; onChange: () => void }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const subjects = useMemo(() => subjectTimeRows(plan), [plan]);
    const { relations, doubles, span_short_break: spans } = config.rules;
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const [kind, setKind] = useState<RuleKind>('not_same_day');
    const [a, setA] = useState<string | null>(null);
    const [b, setB] = useState<string | null>(null);
    const [stream, setStream] = useState<string>(EVERY_CLASS);
    const [strength, setStrength] = useState<RuleStrength>('prefer');

    const nameOf = (ids: readonly string[]) => subjects.find((s) => s.ids.some((id) => ids.includes(id)))?.name ?? 'A removed subject';
    const classNames = new Map(plan.classes.map((c) => [c.streamId, c.name]));
    const idsOf = (key: string | null) => subjects.find((s) => s.key === key)?.ids ?? [];
    const needs = RULE_KIND_COPY[kind].subjects;
    const picked = needs === 2 ? [a, b] : [a];
    const ready = picked.every(Boolean) && new Set(picked).size === picked.length;
    const draft: TimetableRule | null = ready
        ? { id: newRuleId(), kind, subject_ids: picked.map(idsOf), stream_ids: stream === EVERY_CLASS ? [] : [stream], strength }
        : null;
    const draftConflicts = draft ? ruleConflicts(draft, plan.classes, plan.day.days) : [];
    const withDoubles = useMemo(() => {
        const ids = new Set(plan.classes.flatMap((c) => [...c.core, ...c.blocks.flatMap((x) => x.loads)]).filter((l) => l.doubles > 0).map((l) => l.subjectId));
        return subjects.filter((s) => s.ids.some((id) => ids.has(id)));
    }, [plan, subjects]);

    const save = async (key: string, patch: Patch, message: string) => {
        setSaving(key);
        try {
            await api.patch(CONFIG_URL, patch);
            toast.success(message);
            onChange();
            return true;
        } catch (err) { toast.error(errorMessage(err, 'Could not save')); return false; }
        finally { setSaving(null); }
    };
    const add = async () => {
        if (!draft) return;
        if (await save('add', { relations: [...relations, draft] }, 'Rule added. It applies to the next draft you generate.')) {
            setAdding(false); setA(null); setB(null);
        }
    };
    const subjectOptions = subjects.map((s) => ({ value: s.key, label: s.name }));

    return (
        <View>
            <Text style={styles.title}>Double lessons</Text>
            {DOUBLE_RULE_COPY.map((r) => (
                <ToggleRow key={r.key} label={r.label} description={r.hint} value={doubles[r.key]}
                    onValueChange={(on) => void save(r.key, { doubles: { [r.key]: on } }, `${r.label}: ${on ? 'on' : 'off'}.`)} />
            ))}

            <Text style={[styles.title, { marginTop: spacing.lg }]}>Your rules</Text>
            {relations.length === 0 && !adding ? <Text style={[styles.small, styles.empty]}>No rules yet.</Text> : null}
            {relations.map((r) => {
                const conflicts = ruleConflicts(r, plan.classes, plan.day.days);
                const must = r.strength === 'must';
                return (
                    <View key={r.id} style={styles.rule}>
                        <View style={styles.ruleHead}>
                            <View style={[styles.badge, { backgroundColor: must ? colors.dangerBg : colors.infoBg }]}>
                                <Text style={[styles.badgeText, { color: must ? colors.danger : colors.info }]}>{RULE_STRENGTH_COPY[r.strength].label}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.ruleText}>{ruleSentence(r, nameOf)}</Text>
                                <Text style={styles.small}>{r.stream_ids.length === 0 ? 'Every class' : r.stream_ids.map((id) => classNames.get(id) ?? 'A removed class').join(', ')}</Text>
                            </View>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Remove: ${ruleSentence(r, nameOf)}`}
                                disabled={saving === r.id}
                                hitSlop={8}
                                onPress={() => confirmAlert('Remove this rule?', ruleSentence(r, nameOf), [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Remove', style: 'destructive', onPress: () => void save(r.id, { relations: relations.filter((x) => x.id !== r.id) }, 'Rule removed.') },
                                ])}
                            >
                                <Trash2 size={18} color={colors.muted} />
                            </Pressable>
                        </View>
                        {conflicts.length > 0 ? <Conflicts lines={conflicts} /> : null}
                    </View>
                );
            })}
            {adding ? (
                <View style={styles.form}>
                    <ChipSelect label="Kind of rule" wrap options={RULE_KINDS.map((k) => ({ value: k, label: RULE_KIND_COPY[k].label, hint: RULE_KIND_COPY[k].hint }))} value={kind} onChange={setKind} />
                    <ChipSelect label={needs === 2 ? 'First subject' : 'Subject'} layout="picker" options={subjectOptions} value={a} onChange={setA} placeholder="Choose a subject" />
                    {needs === 2 ? <ChipSelect label="Second subject" layout="picker" options={subjectOptions.filter((o) => o.value !== a)} value={b} onChange={setB} placeholder="Choose a subject" /> : null}
                    <ChipSelect label="Classes" layout="picker" options={[{ value: EVERY_CLASS, label: 'Every class' }, ...plan.classes.map((c) => ({ value: c.streamId, label: c.name }))]} value={stream} onChange={setStream} />
                    <ChipSelect label="How firm" options={RULE_STRENGTHS.map((s) => ({ value: s, label: RULE_STRENGTH_COPY[s].label, hint: RULE_STRENGTH_COPY[s].hint }))} value={strength} onChange={setStrength} />
                    {draftConflicts.length > 0 ? <Conflicts lines={draftConflicts} /> : null}
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setAdding(false)} />
                        <Button label="Add rule" icon={Plus} loading={saving === 'add'} disabled={!draft} onPress={() => void add()} />
                    </ButtonRow>
                </View>
            ) : (
                <ButtonRow align="start">
                    <Button size="sm" variant="secondary" icon={Plus} label="Add a rule" disabled={relations.length >= MAX_RULES || subjects.length === 0} onPress={() => setAdding(true)} />
                </ButtonRow>
            )}

            {withDoubles.length > 0 ? (
                <>
                    <Text style={[styles.title, { marginTop: spacing.lg }]}>Doubles across a short break</Text>
                    <Text style={styles.small}>Never across lunch.</Text>
                    {withDoubles.map((s) => {
                        const on = s.ids.every((id) => spans.includes(id));
                        return (
                            <ToggleRow key={s.key} label={s.name} value={on}
                                onValueChange={(next) => void save('span', { span_short_break: next ? [...spans, ...s.ids] : spans.filter((id) => !s.ids.includes(id)) }, next ? 'Its doubles may now run across a short break.' : 'Its doubles stay within one block of lessons.')} />
                        );
                    })}
                </>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    title: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    small: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.xs },
    empty: { textAlign: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm },
    rule: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.sm, gap: spacing.sm },
    ruleHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    ruleText: { fontSize: 13, lineHeight: 18, fontFamily: fonts.medium, color: colors.foreground },
    badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 1 },
    badgeText: { fontSize: 11, fontFamily: fonts.semibold },
    form: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm, gap: spacing.xs },
    warn: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.warningBg, borderRadius: radius.md, padding: spacing.sm },
    warnTitle: { fontSize: 12, fontFamily: fonts.semibold, marginBottom: 2 },
}));
