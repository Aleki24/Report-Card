import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { useGradeStreams } from '@/lib/useSchoolData';
import { roleLabel } from '@/lib/roles';
import { errorMessage, formatDate, formatPercent, fullName, initials, scoreColor } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    Avatar, BackLink, Badge, Button, ButtonRow, Card, EmptyState, ErrorBanner, InfoRow, ListCard, ListRow,
    LoadingView, Notice, ProgressBar, Screen, SectionLabel, TextField,
} from '@/components/ui';
import { StudentForm, type StudentStatus } from '@/components/people/StudentForm';
import type { StudentDetail, TeacherDetail } from '@/lib/types';
import { confirmAlert } from '@/lib/confirm';

export default function PersonDetailScreen() {
    const { id, type } = useLocalSearchParams<{ id: string; type?: 'student' | 'teacher' }>();
    return <Screen>{type === 'teacher' ? <TeacherView id={id} /> : <StudentView id={id} />}</Screen>;
}

function StudentView({ id }: { id: string }) {
    const api = useApi();
    const router = useRouter();
    const { role } = useCurrentUser();
    const { data, loading, error, reload } = useApiQuery<StudentDetail>(`/api/school/students/${id}`, { raw: true });
    const { streams } = useGradeStreams();
    const [editing, setEditing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const canManage = role === 'ADMIN' || role === 'CLASS_TEACHER';

    if (loading) return <LoadingView />;
    if (error || !data) return <><BackLink /><ErrorBanner message={error ?? 'Student not found'} onRetry={reload} /></>;
    const p = data.profile;

    const remove = () =>
        confirmAlert('Delete this student?', `${fullName(p)} and their records will be removed. This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.del(`/api/admin/delete-student?student_id=${id}`);
                        router.back();
                    } catch (err) {
                        setMessage(errorMessage(err, 'Failed to delete'));
                    }
                },
            },
        ]);

    return (
        <>
            <BackLink />
            {message ? <Notice tone="danger" message={message} onDismiss={() => setMessage(null)} /> : null}
            <View style={styles.headerRow}>
                <Avatar label={initials(p)} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{fullName(p)}</Text>
                    <Text style={styles.subtitle}>
                        {p.admission_number ?? '—'} · {p.grade_stream?.full_name ?? 'Unassigned'}
                    </Text>
                </View>
                {p.status && p.status !== 'ACTIVE' ? <Badge label={p.status} /> : null}
            </View>

            {editing ? (
                <StudentForm
                    studentId={id}
                    streams={streams}
                    initial={{
                        first_name: p.first_name,
                        last_name: p.last_name,
                        admission_number: p.admission_number ?? '',
                        gender: p.gender ?? '',
                        date_of_birth: p.date_of_birth ?? '',
                        grade_stream_id: p.grade_stream?.id ?? null,
                        guardian_name: p.guardian_name ?? '',
                        guardian_phone: p.guardian_phone ?? '',
                        guardian_email: p.guardian_email ?? '',
                        status: (p.status as StudentStatus | null) ?? 'ACTIVE',
                    }}
                    onCancel={() => setEditing(false)}
                    onSaved={() => {
                        setEditing(false);
                        reload();
                    }}
                />
            ) : (
                <Card style={{ marginBottom: spacing.md }}>
                    <InfoRow label="Curriculum" value={p.academic_level?.name} />
                    <InfoRow label="Gender" value={p.gender} />
                    <InfoRow label="Date of birth" value={p.date_of_birth ? formatDate(p.date_of_birth) : null} />
                    <InfoRow label="Enrolled" value={p.date_enrolled ? formatDate(p.date_enrolled) : null} />
                    <InfoRow label="Guardian" value={p.guardian_name} />
                    <InfoRow label="Guardian phone" value={p.guardian_phone} />
                    <InfoRow label="Guardian email" value={p.guardian_email} />
                    <ButtonRow>
                        {p.guardian_phone ? <Button size="sm" variant="ghost" label="Call guardian" onPress={() => void Linking.openURL(`tel:${p.guardian_phone}`)} /> : null}
                        {canManage ? <Button size="sm" variant="secondary" label="Edit" onPress={() => setEditing(true)} /> : null}
                        {canManage ? <Button size="sm" variant="danger" label="Delete" onPress={remove} /> : null}
                    </ButtonRow>
                </Card>
            )}

            <SectionLabel>Academic history</SectionLabel>
            {data.academicHistory.length === 0 ? (
                <Card><EmptyState title="No marks yet" /></Card>
            ) : (
                data.academicHistory.map((t) => (
                    <Card key={t.term_id} style={{ marginBottom: spacing.sm }}>
                        <View style={styles.termHeader}>
                            <Text style={styles.termName}>{t.term_name}</Text>
                            <Text style={[styles.termAvg, { color: scoreColor(t.average) }]}>{formatPercent(t.average, 1)}</Text>
                        </View>
                        {t.subjects.map((s) => (
                            <View key={s.name} style={styles.subjectRow}>
                                <Text style={styles.subjectName} numberOfLines={1}>{s.name}</Text>
                                <View style={{ flex: 1 }}>
                                    <ProgressBar value={s.percentage} color={scoreColor(s.percentage)} />
                                </View>
                                <Text style={styles.subjectPct}>{formatPercent(s.percentage)}</Text>
                            </View>
                        ))}
                    </Card>
                ))
            )}

            <SectionLabel>Report cards</SectionLabel>
            <ListCard>
                {data.reportHistory.length === 0 ? (
                    <EmptyState title="No reports yet" />
                ) : (
                    data.reportHistory.map((r) => (
                        <ListRow
                            key={r.id}
                            title={`${r.term} — ${r.year}`}
                            subtitle={r.position ? `Position ${r.position}` : null}
                            right={<Badge label={formatPercent(r.average, 1)} variant={(r.average ?? 0) >= 50 ? 'success' : 'danger'} />}
                        />
                    ))
                )}
            </ListCard>

            <SectionLabel>Attendance</SectionLabel>
            <ListCard>
                {data.attendanceHistory.length === 0 ? (
                    <EmptyState title="No attendance recorded" />
                ) : (
                    data.attendanceHistory.map((a) => (
                        <ListRow key={a.id} title={`${a.term} — ${a.year}`} subtitle={`${a.present} of ${a.total} days`} right={<Text style={styles.subjectPct}>{formatPercent(a.percentage)}</Text>} />
                    ))
                )}
            </ListCard>
        </>
    );
}

function TeacherView({ id }: { id: string }) {
    const api = useApi();
    const { role } = useCurrentUser();
    const { data, loading, error, reload } = useApiQuery<TeacherDetail>(`/api/school/teachers/${id}`, { raw: true });
    const [edit, setEdit] = useState<{ first_name: string; last_name: string; phone: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    if (loading) return <LoadingView />;
    if (error || !data) return <><BackLink /><ErrorBanner message={error ?? 'Not found'} onRetry={reload} /></>;
    const p = data.profile;

    const save = async () => {
        if (!edit) return;
        setSaving(true);
        try {
            await api.patch('/api/admin/update-teacher', { teacher_id: id, first_name: edit.first_name.trim(), last_name: edit.last_name.trim(), phone: edit.phone.trim() || null });
            setEdit(null);
            reload();
        } catch (err) {
            setMessage(errorMessage(err, 'Failed to save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <BackLink />
            {message ? <Notice tone="danger" message={message} onDismiss={() => setMessage(null)} /> : null}
            <View style={styles.headerRow}>
                <Avatar label={initials(p)} color={colors.info} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{fullName(p)}</Text>
                    <Text style={styles.subtitle}>{roleLabel(p.role)}</Text>
                </View>
                {p.is_active ? null : <Badge label="Inactive" variant="danger" />}
            </View>

            {edit ? (
                <Card style={{ marginBottom: spacing.md }}>
                    <TextField label="First name" value={edit.first_name} onChangeText={(first_name) => setEdit({ ...edit, first_name })} />
                    <TextField label="Last name" value={edit.last_name} onChangeText={(last_name) => setEdit({ ...edit, last_name })} />
                    <TextField label="Phone" value={edit.phone} onChangeText={(phone) => setEdit({ ...edit, phone })} keyboardType="phone-pad" />
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setEdit(null)} />
                        <Button label="Save" onPress={save} loading={saving} />
                    </ButtonRow>
                </Card>
            ) : (
                <Card style={{ marginBottom: spacing.md }}>
                    <InfoRow label="Email" value={p.email} />
                    <InfoRow label="Phone" value={p.phone} />
                    <InfoRow label="Joined" value={formatDate(p.created_at)} />
                    <ButtonRow>
                        {p.phone ? <Button size="sm" variant="ghost" label="Call" onPress={() => void Linking.openURL(`tel:${p.phone}`)} /> : null}
                        {role === 'ADMIN' ? <Button size="sm" variant="secondary" label="Edit" onPress={() => setEdit({ first_name: p.first_name, last_name: p.last_name, phone: p.phone ?? '' })} /> : null}
                    </ButtonRow>
                </Card>
            )}

            <SectionLabel>Class teacher of</SectionLabel>
            <ListCard>
                {data.classAssignments.length === 0 ? (
                    <EmptyState title="No class assigned" />
                ) : (
                    data.classAssignments.map((c) => <ListRow key={c.id} title={c.stream} subtitle={c.year} />)
                )}
            </ListCard>

            <SectionLabel>Teaches</SectionLabel>
            <ListCard>
                {data.subjectAssignments.length === 0 ? (
                    <EmptyState title="No subjects assigned" description="Assign subjects under Subjects." />
                ) : (
                    data.subjectAssignments.map((s, i) => <ListRow key={`${s.subject}-${s.grade}-${i}`} title={s.subject} subtitle={`${s.grade}${s.subject_code ? ` · ${s.subject_code}` : ''}`} />)
                )}
            </ListCard>
        </>
    );
}

const styles = StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
    title: { fontSize: 20, fontWeight: '800', color: colors.foreground },
    subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
    termHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    termName: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    termAvg: { fontSize: 14, fontWeight: '800' },
    subjectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
    subjectName: { width: 110, fontSize: 12, color: colors.foreground, fontWeight: '600' },
    subjectPct: { width: 44, textAlign: 'right', fontSize: 12, fontWeight: '700', color: colors.foreground },
});
