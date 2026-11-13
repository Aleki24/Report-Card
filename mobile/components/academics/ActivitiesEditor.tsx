import React from 'react';
import { Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { ACTIVITY_KINDS, ACTIVITY_LABELS, WEEKDAY_LABELS, type TimetableConfig } from '@shared/timetable/config';
import {
    activityBells, activityLine, activityProblem, lessonsTakenBy, withActivityAdded, withActivityPatched, withActivityRemoved,
} from '@shared/ops/forms/academics';
import { Button, ButtonRow, Card, Notice, SectionLabel, TextField } from '@/components/ui';
import { fonts, spacing, useTheme } from '@/lib/theme';

/**
 * The web's assembly, games and clubs: when each runs and for whom. No
 * lesson goes in their time; one inside the school day takes those lesson
 * periods on its days, and says how many.
 */
export function ActivitiesEditor({ config, update }: { config: TimetableConfig; update: (fn: (c: TimetableConfig) => TimetableConfig) => void }) {
    const { colors } = useTheme();
    const bells = activityBells(config);
    const label = { fontSize: 12, fontFamily: fonts.semibold, color: colors.muted, marginBottom: spacing.xs } as const;
    return (
        <View>
            <SectionLabel>Assembly, games and clubs</SectionLabel>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.sm }}>They show on every timetable, and no lesson is put in their time.</Text>
            {config.rules.activities.map((a) => {
                const taken = lessonsTakenBy(config, a);
                const problem = activityProblem(a);
                return (
                    <Card key={a.id} style={{ marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.mutedBg }}>
                        <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: colors.foreground }}>{a.label}</Text>
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.sm }}>{activityLine(config, a)}</Text>
                        <TextField label="Name" value={a.label} onChangeText={(v) => update((c) => withActivityPatched(c, a.id, { label: v }))} />
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            <View style={{ flex: 1 }}><TextField label="From" value={a.start} placeholder="HH:MM" keyboardType="numbers-and-punctuation" onChangeText={(v) => update((c) => withActivityPatched(c, a.id, { start: v }))} /></View>
                            <View style={{ flex: 1 }}><TextField label="To" value={a.end} placeholder="HH:MM" keyboardType="numbers-and-punctuation" onChangeText={(v) => update((c) => withActivityPatched(c, a.id, { end: v }))} /></View>
                        </View>
                        <Text style={label}>Days</Text>
                        <ButtonRow align="start">
                            {config.days.map((d) => (
                                <Button key={d} size="sm" variant={a.days.includes(d) ? 'primary' : 'secondary'} label={WEEKDAY_LABELS[d]}
                                    onPress={() => update((c) => withActivityPatched(c, a.id, { days: a.days.includes(d) ? a.days.filter((x) => x !== d) : [...a.days, d].sort((x, y) => x - y) }))} />
                            ))}
                        </ButtonRow>
                        {bells.length > 1 ? (
                            <>
                                <Text style={label}>Who</Text>
                                <ButtonRow align="start">
                                    <Button size="sm" variant={a.section_ids.length === 0 ? 'primary' : 'secondary'} label="Whole school" onPress={() => update((c) => withActivityPatched(c, a.id, { section_ids: [] }))} />
                                    {bells.map((b) => (
                                        <Button key={b.id} size="sm" variant={a.section_ids.includes(b.id) ? 'primary' : 'secondary'} label={b.name}
                                            onPress={() => update((c) => withActivityPatched(c, a.id, { section_ids: a.section_ids.includes(b.id) ? a.section_ids.filter((x) => x !== b.id) : [...a.section_ids, b.id] }))} />
                                    ))}
                                </ButtonRow>
                            </>
                        ) : null}
                        {problem
                            ? <Notice tone="danger" message={problem} />
                            : taken.length > 0
                                ? <Notice tone="warning" message={`Takes ${taken.map((t) => `${t.lessons} lesson${t.lessons === 1 ? '' : 's'} a week from ${t.name}`).join(', ')}. Check those classes still fit.`} />
                                : <Text style={{ fontSize: 12, color: colors.muted }}>Outside the lessons: no lesson time is lost.</Text>}
                        <ButtonRow>
                            <Button size="sm" variant="danger" label={`Remove ${a.label}`} onPress={() => update((c) => withActivityRemoved(c, a.id))} />
                        </ButtonRow>
                    </Card>
                );
            })}
            <ButtonRow align="start">
                {ACTIVITY_KINDS.map((k) => (
                    <Button key={k} size="sm" variant="secondary" icon={Plus} label={k === 'other' ? 'Something else' : ACTIVITY_LABELS[k]} onPress={() => update((c) => withActivityAdded(c, k))} />
                ))}
            </ButtonRow>
        </View>
    );
}
