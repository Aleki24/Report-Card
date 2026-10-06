import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GraduationCap, Pencil, School, UserRound, Users } from 'lucide-react-native';
import { CLASSES_OVERVIEW_URL, classDeleteBlocker, type ClassSummary, type ClassesOverview } from '@shared/classes-overview';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { errorMessage, pluralize } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import {
    Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, LoadingView, Notice,
    Screen, ScreenHeader, SearchField, SectionLabel, StatGrid, StatTile, TextField,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import { confirmAlert } from '@/lib/confirm';

export default function ClassesScreen() {
    return (
        <RequireScreen screen="classes">
            <ClassesContent />
        </RequireScreen>
    );
}

/** One class: who teaches it and what it holds, counted on the server. */
function ClassCard({ c, onEdit, onRoster }: { c: ClassSummary; onEdit: () => void; onRoster: () => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const learners = c.usage.activeStudents;
    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <View style={[styles.badge, { backgroundColor: learners > 0 ? colors.primarySoft : colors.mutedBg }]}>
                    <Text style={[styles.badgeNum, { color: learners > 0 ? colors.primary : colors.muted }]}>{learners}</Text>
                    <Text style={styles.badgeLabel}>learners</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{c.full_name}</Text>
                    <View style={styles.metaRow}>
                        <UserRound size={13} color={colors.muted} />
                        <Text style={styles.meta} numberOfLines={1}>{c.class_teachers.length > 0 ? c.class_teachers.join(', ') : 'No class teacher yet'}</Text>
                    </View>
                    <Text style={styles.meta}>{pluralize(c.usage.exams, 'exam')} · {pluralize(c.usage.reportCards, 'report card')}</Text>
                </View>
                <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${c.full_name}`} hitSlop={8} style={styles.iconBtn}>
                    <Pencil size={16} color={colors.muted} />
                </Pressable>
            </View>
            <Pressable onPress={onRoster} accessibilityRole="button" style={({ pressed }) => [styles.roster, pressed && { opacity: 0.7 }]}>
                <Users size={14} color={colors.primary} />
                <Text style={styles.rosterText}>See learners</Text>
            </Pressable>
        </View>
    );
}

function ClassesContent() {
    const { colors } = useTheme();
    const api = useApi();
    const router = useRouter();
    const overview = useApiQuery<ClassesOverview>(CLASSES_OVERVIEW_URL, { raw: true });
    const [search, setSearch] = useState('');
    const [adding, setAdding] = useState(false);
    const [gradeId, setGradeId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [fullNameInput, setFullNameInput] = useState('');
    const [editing, setEditing] = useState<{ id: string; name: string; full_name: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    const grades = overview.data?.grades ?? [];
    const curricula = overview.data?.curricula ?? [];
    const classes = useMemo(() => overview.data?.classes ?? [], [overview.data]);
    const totals = useMemo(() => ({
        learners: classes.reduce((n, c) => n + c.usage.activeStudents, 0),
        teachers: classes.filter((c) => c.class_teachers.length > 0).length,
    }), [classes]);
    const needle = search.trim().toLowerCase();
    const shown = needle ? classes.filter((c) => c.full_name.toLowerCase().includes(needle) || c.class_teachers.some((t) => t.toLowerCase().includes(needle))) : classes;

    const run = async (work: () => Promise<unknown>, done: string) => {
        setBusy(true);
        setMessage(null);
        try {
            await work();
            setMessage({ tone: 'success', text: done });
            overview.refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Something went wrong') });
        } finally {
            setBusy(false);
        }
    };

    const add = () => {
        const grade = grades.find((g) => g.id === gradeId);
        if (!grade) return setMessage({ tone: 'danger', text: 'Choose a grade.' });
        // Same naming as the web: a blank stream name means the class is just the grade.
        const finalName = name.trim() || grade.name_display;
        const finalFull = fullNameInput.trim() || (name.trim() ? `${grade.name_display} ${finalName}` : finalName);
        void run(async () => {
            await api.post('/api/admin/academic-structure', { type: 'stream', grade_id: grade.id, name: finalName, full_name: finalFull });
            setAdding(false);
            setName('');
            setFullNameInput('');
        }, `Added ${finalFull}.`);
    };

    const rename = () => {
        if (!editing) return;
        void run(async () => {
            await api.patch('/api/admin/academic-structure', { type: 'stream', id: editing.id, name: editing.name.trim(), full_name: editing.full_name.trim() });
            setEditing(null);
        }, 'Class renamed.');
    };

    const remove = (c: ClassSummary) => {
        const blocker = classDeleteBlocker(c.usage);
        if (blocker) return setMessage({ tone: 'danger', text: blocker });
        confirmAlert(`Delete ${c.full_name}?`, 'The class has nothing in it, so nothing else is lost.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void run(async () => { await api.del(withQuery('/api/admin/academic-structure', { type: 'stream', id: c.id })); setEditing(null); }, `${c.full_name} deleted.`) },
        ]);
    };

    if (overview.loading && !overview.data) return <LoadingView />;

    return (
        <Screen onRefresh={overview.refresh} refreshing={overview.refreshing}>
            <ScreenHeader title="Classes" description="Every class your school runs, with its learners and class teacher." />
            {overview.error ? <ErrorBanner message={overview.error} onRetry={overview.reload} /> : null}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}

            <StatGrid>
                <StatTile label="Classes" value={classes.length} icon={School} />
                <StatTile label="Learners" value={totals.learners} icon={GraduationCap} />
                <StatTile label="With a class teacher" value={`${totals.teachers}/${classes.length}`} icon={UserRound} />
            </StatGrid>

            {adding ? (
                <Card style={{ marginVertical: spacing.md }}>
                    <ChipSelect label="Grade" wrap options={grades.map((g) => ({ value: g.id, label: g.name_display }))} value={gradeId} onChange={setGradeId} />
                    <TextField label="Stream name (optional)" value={name} onChangeText={setName} placeholder="e.g. East — leave blank to use the grade" />
                    <TextField label="Display name (optional)" value={fullNameInput} onChangeText={setFullNameInput} placeholder="e.g. Form 2 East" />
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setAdding(false)} />
                        <Button label="Add class" onPress={add} loading={busy} />
                    </ButtonRow>
                </Card>
            ) : (
                <ButtonRow>
                    <Button label="+ Add class" onPress={() => setAdding(true)} />
                </ButtonRow>
            )}

            {classes.length > 6 ? <SearchField value={search} onChangeText={setSearch} placeholder="Find a class or class teacher" /> : null}
            {classes.length === 0 ? <EmptyState title="No classes yet" description="Add your first class above." /> : null}

            {curricula.map((level) => {
                const levelGrades = grades.filter((g) => g.academic_level_id === level.id).sort((a, b) => a.numeric_order - b.numeric_order);
                const levelClasses = levelGrades.flatMap((g) => shown.filter((c) => c.grade_id === g.id));
                if (levelClasses.length === 0) return null;
                return (
                    <View key={level.id} style={{ marginTop: spacing.md }}>
                        <SectionLabel>{level.name}</SectionLabel>
                        {levelClasses.map((c) =>
                            editing?.id === c.id ? (
                                <Card key={c.id} style={{ marginBottom: spacing.sm, backgroundColor: colors.mutedBg }}>
                                    <TextField label="Stream name" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} />
                                    <TextField label="Display name" value={editing.full_name} onChangeText={(v) => setEditing({ ...editing, full_name: v })} />
                                    <ButtonRow>
                                        <Button size="sm" variant="danger" label="Delete" onPress={() => remove(c)} />
                                        <Button size="sm" variant="secondary" label="Cancel" onPress={() => setEditing(null)} />
                                        <Button size="sm" label="Save" onPress={rename} loading={busy} />
                                    </ButtonRow>
                                </Card>
                            ) : (
                                <ClassCard
                                    key={c.id}
                                    c={c}
                                    onEdit={() => setEditing({ id: c.id, name: c.name, full_name: c.full_name })}
                                    onRoster={() => router.push({ pathname: '/staff/people', params: { tab: 'students', class: c.id } })}
                                />
                            ),
                        )}
                    </View>
                );
            })}
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: spacing.md }}>Class teachers are set per person under Users.</Text>
        </Screen>
    );
}

const useStyles = makeStyles((colors) => ({
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.card, marginBottom: spacing.sm, overflow: 'hidden' },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    badge: { width: 58, height: 58, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    badgeNum: { fontSize: 20, fontFamily: fonts.bold },
    badgeLabel: { fontSize: 10, fontFamily: fonts.semibold, color: colors.muted, marginTop: -2 },
    name: { fontSize: 16, fontFamily: fonts.bold, color: colors.foreground },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    meta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    iconBtn: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mutedBg },
    roster: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10 },
    rosterText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },
}));
