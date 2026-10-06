import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { humanize, today } from '@shared/ops/format';
import { ROLL_SHORT, ROLL_TONES, currentRollSession, rollSavedMessage, type Roll } from '@shared/ops/forms/welfare';
import { ROLL_SESSIONS, ROLL_STATUSES, type RollSession, type RollStatus } from '@shared/ops/resources/welfare';
import { Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { SelectField } from '@/components/ops/SelectField';
import { toneColor } from '@/components/ops/bits';
import { useApi, withQuery } from '@/lib/api';
import { opsGet, useOpsList } from '@/lib/ops';
import { errorMessage } from '@/lib/format';
import { radius, spacing, fonts, makeStyles, useTheme } from '@/lib/theme';

/** Morning, evening or night roll for a dorm, pre-filled for learners on exeat or in sick bay — the web's roll call. */
export function RollCall() {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const toast = useToast();
    const dorms = useOpsList<{ id: string; name: string; house: string | null }>('dorms');
    const [dormId, setDormId] = useState('');
    const [session, setSession] = useState<RollSession>(currentRollSession);
    const [day, setDay] = useState(today());
    const [roll, setRoll] = useState<Roll | null>(null);
    const [notes, setNotes] = useState('');
    const [opening, setOpening] = useState(false);
    const [saving, setSaving] = useState(false);

    const reset = () => setRoll(null);

    const open = async () => {
        if (!dormId) { toast.error('Choose a dorm.'); return; }
        setOpening(true);
        try {
            const r = await opsGet<Roll>(api, withQuery('/api/welfare/rollcall', { dorm_id: dormId, session, date: day }));
            setRoll({ ...r, entries: r.entries.map((e) => ({ ...e, status: e.status ?? e.suggested })) });
            setNotes(r.notes ?? '');
        } catch (err) {
            toast.error(errorMessage(err, 'Could not open the roll'));
        } finally {
            setOpening(false);
        }
    };

    const setStatus = (id: string, status: RollStatus) =>
        setRoll((r) => r && { ...r, entries: r.entries.map((e) => (e.studentId === id ? { ...e, status } : e)) });

    const save = async () => {
        if (!roll) return;
        const unmarked = roll.entries.filter((e) => !e.status).length;
        if (unmarked > 0) { toast.error(`${unmarked} learners are not marked yet.`); return; }
        setSaving(true);
        try {
            const r = await api.put<{ data: { saved: number; absent: number } }>('/api/welfare/rollcall', {
                dorm_id: dormId, session, date: day, notes: notes || undefined,
                entries: roll.entries.map((e) => ({ student_id: e.studentId, status: e.status })),
            });
            toast.success(rollSavedMessage(r.data.absent));
            setRoll((x) => x && { ...x, taken: true });
        } catch (err) {
            toast.error(errorMessage(err, 'Could not save the roll'));
        } finally {
            setSaving(false);
        }
    };

    const counts = Object.fromEntries(ROLL_STATUSES.map((s) => [s, roll?.entries.filter((e) => e.status === s).length ?? 0])) as Record<RollStatus, number>;

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <SelectField
                    label="Dorm"
                    options={dorms.rows.map((d) => ({ id: d.id, label: d.name, hint: d.house ?? undefined }))}
                    loading={dorms.loading}
                    value={dormId}
                    onChange={(v) => { setDormId(v); reset(); }}
                />
                <ChipSelect label="Session" options={ROLL_SESSIONS.map((s) => ({ value: s, label: humanize(s) }))} value={session} onChange={(v) => { setSession(v); reset(); }} />
                <TextField label="Date" value={day} onChangeText={(v) => { setDay(v); reset(); }} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                <Button label="Open roll" onPress={() => void open()} loading={opening} block />
            </Card>

            {roll ? (
                <>
                    <View style={styles.counts}>
                        {ROLL_STATUSES.map((s) => <Badge key={s} label={`${humanize(s)} ${counts[s]}`} />)}
                        {roll.taken ? <Badge variant="success" label="Already taken — saving updates it" /> : null}
                    </View>
                    <ButtonRow>
                        <Button size="sm" variant="secondary" label="Rest present" onPress={() => setRoll((r) => r && { ...r, entries: r.entries.map((e) => ({ ...e, status: e.status ?? 'PRESENT' })) })} />
                    </ButtonRow>
                    {roll.entries.length === 0 ? (
                        <EmptyState title="Nobody is allocated to this dorm yet." description="Allocate beds under Dorms." />
                    ) : (
                        roll.entries.map((e) => (
                            <Card key={e.studentId} style={styles.entry}>
                                <Text style={styles.name}>{e.name}</Text>
                                <Text style={styles.meta}>
                                    {e.admissionNumber}{e.bed ? ` · bed ${e.bed}` : ''}{e.suggested ? ` · (${humanize(e.suggested)})` : ''}
                                </Text>
                                <View style={styles.statusRow} accessibilityRole="radiogroup" accessibilityLabel={`Status for ${e.name}`}>
                                    {ROLL_STATUSES.map((s) => {
                                        const on = e.status === s;
                                        return (
                                            <Pressable
                                                key={s}
                                                onPress={() => setStatus(e.studentId, s)}
                                                accessibilityRole="radio"
                                                accessibilityState={{ checked: on }}
                                                accessibilityLabel={humanize(s)}
                                                style={[styles.statusBtn, on && { backgroundColor: toneColor(colors, ROLL_TONES[s]) }]}
                                            >
                                                <Text style={[styles.statusText, on && { color: colors.white }]}>{ROLL_SHORT[s]}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </Card>
                        ))
                    )}
                    {roll.entries.length > 0 ? (
                        <View style={{ marginTop: spacing.md }}>
                            <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
                            <Button label="Save roll" onPress={() => void save()} loading={saving} block />
                        </View>
                    ) : null}
                </>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    counts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    entry: { marginBottom: spacing.sm, padding: spacing.md },
    name: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    statusRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    statusBtn: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
    statusText: { fontSize: 13, fontFamily: fonts.display, color: colors.muted },
}));
