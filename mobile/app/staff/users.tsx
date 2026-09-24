import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useGradeStreams } from '@/lib/useSchoolData';
import { ROLE_LABELS, roleLabel, type UserRole } from '@/lib/roles';
import { errorMessage, formatDate, fullName, pluralize } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SearchField, StatGrid, StatTile, TextField, ToggleRow,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import { confirmAlert } from '@/lib/confirm';

interface SchoolUser {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    username: string | null;
    phone: string | null;
    role: UserRole;
    is_active: boolean;
    created_at: string;
    job_title: string | null;
    admission_number: string | null;
}

interface UserAssignments {
    class_teacher: { grade_stream_id: string } | null;
    subject_assignments: { subject_id: string; grade_id: string }[];
}

/** The web's invite form offers one "Teacher" choice; picking a class makes them a class teacher. */
type InviteRole = 'TEACHER' | 'ADMIN' | 'STAFF';
const INVITE_ROLES: { value: InviteRole; label: string }[] = [
    { value: 'TEACHER', label: 'Teacher' },
    { value: 'ADMIN', label: 'Admin' },
    { value: 'STAFF', label: 'Non-teaching staff' },
];

const NO_CLASS = '__none__';

type Filter = 'ALL' | UserRole;

export default function UsersScreen() {
    return (
        <RequireScreen screen="users">
            <UsersContent />
        </RequireScreen>
    );
}

function UsersContent() {
    const api = useApi();
    const { data, loading, error, refresh, refreshing } = useApiQuery<SchoolUser[]>('/api/school/data?type=users');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('ALL');
    const [inviting, setInviting] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    const users = data ?? [];
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter((u) => (filter === 'ALL' || u.role === filter) && (!q || `${fullName(u)} ${u.username ?? ''} ${u.phone ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q)));
    }, [users, search, filter]);

    const resetCode = (u: SchoolUser) =>
        confirmAlert('Issue a new invite code?', `${fullName(u)} will use it to sign in again. Their old code stops working.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Issue code',
                onPress: async () => {
                    setBusy(u.id);
                    try {
                        const res = await api.post<{ password: string; notified?: boolean }>('/api/admin/reset-user-password', { user_id: u.id });
                        setMessage({ tone: 'success', text: `New invite code for ${fullName(u)}: ${res.password}${res.notified ? ' (sent by SMS)' : ''}` });
                        refresh();
                    } catch (err) {
                        setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to reset') });
                    } finally {
                        setBusy(null);
                    }
                },
            },
        ]);

    const printCodes = async () => {
        setBusy('print');
        try {
            await api.downloadAndShare('/api/admin/invite-codes/pdf?category=all&status=active&format=pdf', 'Invite_codes.pdf');
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Download failed') });
        } finally {
            setBusy(null);
        }
    };

    if (loading) return <LoadingView />;

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="Users" description="Invite staff, set roles and classes, and manage access." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}

            <StatGrid>
                <StatTile label="Accounts" value={users.length} />
                <StatTile label="Staff" value={users.filter((u) => u.role !== 'STUDENT').length} />
                <StatTile label="Students" value={users.filter((u) => u.role === 'STUDENT').length} />
                <StatTile label="Inactive" value={users.filter((u) => !u.is_active).length} />
            </StatGrid>

            {inviting ? (
                <InviteForm
                    nextSequence={users.length + 1}
                    onCancel={() => setInviting(false)}
                    onDone={(text) => {
                        setInviting(false);
                        setMessage({ tone: 'success', text });
                        refresh();
                    }}
                />
            ) : (
                <ButtonRow>
                    <Button variant="secondary" label="Print invite codes" onPress={printCodes} loading={busy === 'print'} />
                    <Button label="+ Invite user" onPress={() => setInviting(true)} />
                </ButtonRow>
            )}

            <View style={{ marginTop: spacing.md }}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Search name, username or phone" />
                <ChipSelect
                    options={[{ value: 'ALL' as Filter, label: 'All' }, ...(['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STAFF', 'STUDENT', 'PENDING'] as const).map((r) => ({ value: r as Filter, label: ROLE_LABELS[r] }))]}
                    value={filter}
                    onChange={setFilter}
                />
            </View>

            {filtered.length === 0 ? (
                <EmptyState title="No users found" />
            ) : (
                <>
                    <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.sm }}>{pluralize(filtered.length, 'account')}</Text>
                    <ListCard>
                        {filtered.map((u) => (
                            <View key={u.id}>
                                <ListRow
                                    title={fullName(u)}
                                    subtitle={[u.job_title ?? roleLabel(u.role), u.username, u.phone ?? u.email].filter(Boolean).join(' · ')}
                                    meta={`Joined ${formatDate(u.created_at)}${u.admission_number ? ` · ${u.admission_number}` : ''}`}
                                    right={u.is_active ? <Badge label={roleLabel(u.role)} variant={u.role === 'ADMIN' ? 'danger' : u.role === 'STUDENT' ? 'success' : 'info'} /> : <Badge label="Inactive" />}
                                    onPress={() => setEditing(editing === u.id ? null : u.id)}
                                />
                                {editing === u.id ? (
                                    <EditUser
                                        user={u}
                                        onReset={() => resetCode(u)}
                                        resetting={busy === u.id}
                                        onCancel={() => setEditing(null)}
                                        onSaved={() => {
                                            setEditing(null);
                                            setMessage({ tone: 'success', text: `${fullName(u)} updated.` });
                                            refresh();
                                        }}
                                    />
                                ) : null}
                            </View>
                        ))}
                    </ListCard>
                </>
            )}
        </Screen>
    );
}

function InviteForm({ nextSequence, onCancel, onDone }: { nextSequence: number; onCancel: () => void; onDone: (message: string) => void }) {
    const api = useApi();
    const { streams } = useGradeStreams();
    const [first, setFirst] = useState('');
    const [last, setLast] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<InviteRole>('TEACHER');
    const [jobTitle, setJobTitle] = useState('');
    const [classId, setClassId] = useState<string>(NO_CLASS);
    const [sequence, setSequence] = useState(String(nextSequence));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        const seq = parseInt(sequence, 10);
        if (!first.trim() || !last.trim() || !phone.trim()) return setError('Name and phone are required.');
        if (!Number.isInteger(seq) || seq < 1) return setError('Sequence number must be a whole number from 1.');
        const payload: Record<string, unknown> = { first_name: first.trim(), last_name: last.trim(), phone: phone.trim(), sequence_number: seq };
        if (role === 'TEACHER') {
            payload.role = classId === NO_CLASS ? 'SUBJECT_TEACHER' : 'CLASS_TEACHER';
            if (classId !== NO_CLASS) payload.class_teacher_grade_stream_id = classId;
            payload.subject_teacher_subjects = [];
        } else {
            payload.role = role;
            if (role === 'STAFF') payload.job_title = jobTitle.trim() || undefined;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await api.post<{ credentials: { username: string; invite_code: string }; notified?: boolean }>('/api/admin/create-user', payload);
            onDone(`Invited ${first.trim()} ${last.trim()}. Username ${res.credentials.username} · invite code ${res.credentials.invite_code}${res.notified ? ' (sent by SMS)' : ''}. Assign subjects under Subjects → Teachers.`);
        } catch (err) {
            setError(errorMessage(err, 'Failed to invite'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card style={{ marginBottom: spacing.md }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.foreground, marginBottom: spacing.md }}>Invite a user</Text>
            {error ? <ErrorBanner message={error} /> : null}
            <ChipSelect label="Role" options={INVITE_ROLES} value={role} onChange={setRole} />
            <TextField label="First name" value={first} onChangeText={setFirst} autoCapitalize="words" />
            <TextField label="Last name" value={last} onChangeText={setLast} autoCapitalize="words" />
            <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0712345678" />
            {role === 'STAFF' ? <TextField label="Job title" value={jobTitle} onChangeText={setJobTitle} placeholder="e.g. Bursar" /> : null}
            {role === 'TEACHER' ? (
                <ChipSelect
                    label="Class teacher of (optional)"
                    options={[{ value: NO_CLASS, label: 'No class' }, ...streams.map((s) => ({ value: s.id, label: s.full_name }))]}
                    value={classId}
                    onChange={setClassId}
                />
            ) : null}
            <TextField label="Sequence number (for the username)" value={sequence} onChangeText={setSequence} keyboardType="number-pad" />
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.sm }}>Students are added from People, which also creates their invite code.</Text>
            <ButtonRow>
                <Button variant="secondary" label="Cancel" onPress={onCancel} />
                <Button label="Invite" onPress={submit} loading={saving} />
            </ButtonRow>
        </Card>
    );
}

function EditUser({ user, onSaved, onCancel, onReset, resetting }: { user: SchoolUser; onSaved: () => void; onCancel: () => void; onReset: () => void; resetting: boolean }) {
    const api = useApi();
    const { streams } = useGradeStreams();
    const isTeacher = user.role === 'CLASS_TEACHER' || user.role === 'SUBJECT_TEACHER';
    // Current assignments are sent back unchanged, so saving here never wipes subjects set elsewhere.
    const assignments = useApiQuery<UserAssignments>(isTeacher ? `/api/admin/user-assignments?user_id=${user.id}` : null, { raw: true });
    const [first, setFirst] = useState(user.first_name);
    const [last, setLast] = useState(user.last_name);
    const [phone, setPhone] = useState(user.phone ?? '');
    const [role, setRole] = useState<UserRole>(user.role);
    const [jobTitle, setJobTitle] = useState(user.job_title ?? '');
    const [active, setActive] = useState(user.is_active);
    const [classId, setClassId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const effectiveClass = classId ?? assignments.data?.class_teacher?.grade_stream_id ?? NO_CLASS;
    const teacherRole = role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER';

    const save = async () => {
        const payload: Record<string, unknown> = { user_id: user.id, first_name: first.trim(), last_name: last.trim(), phone: phone.trim(), role, is_active: active };
        if (role === 'STAFF') payload.job_title = jobTitle.trim();
        if (teacherRole) {
            payload.role = effectiveClass === NO_CLASS ? 'SUBJECT_TEACHER' : 'CLASS_TEACHER';
            payload.class_teacher_grade_stream_id = effectiveClass === NO_CLASS ? null : effectiveClass;
            payload.subject_teacher_subjects = (assignments.data?.subject_assignments ?? []).map(({ subject_id, grade_id }) => ({ subject_id, grade_id }));
        }
        setSaving(true);
        setError(null);
        try {
            await api.put('/api/admin/update-user', payload);
            onSaved();
        } catch (err) {
            setError(errorMessage(err, 'Failed to update'));
        } finally {
            setSaving(false);
        }
    };

    if (isTeacher && assignments.loading) return <LoadingView />;

    return (
        <View style={{ padding: spacing.md, backgroundColor: colors.mutedBg }}>
            {error ? <ErrorBanner message={error} /> : null}
            <TextField label="First name" value={first} onChangeText={setFirst} />
            <TextField label="Last name" value={last} onChangeText={setLast} />
            <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            {user.role !== 'STUDENT' ? (
                <ChipSelect
                    label="Role"
                    wrap
                    options={(['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER', 'STAFF'] as const).map((r) => ({ value: r as UserRole, label: ROLE_LABELS[r] }))}
                    value={teacherRole ? (effectiveClass === NO_CLASS ? 'SUBJECT_TEACHER' : 'CLASS_TEACHER') : role}
                    onChange={(r) => {
                        setRole(r);
                        if (r === 'SUBJECT_TEACHER') setClassId(NO_CLASS);
                    }}
                />
            ) : null}
            {teacherRole ? (
                <ChipSelect label="Class teacher of" options={[{ value: NO_CLASS, label: 'No class' }, ...streams.map((s) => ({ value: s.id, label: s.full_name }))]} value={effectiveClass} onChange={setClassId} />
            ) : null}
            {role === 'STAFF' ? <TextField label="Job title" value={jobTitle} onChangeText={setJobTitle} /> : null}
            <ToggleRow label="Active" description="Inactive accounts are signed out and can't sign in." value={active} onValueChange={setActive} />
            <ButtonRow>
                <Button size="sm" variant="ghost" label="New invite code" onPress={onReset} loading={resetting} />
                <Button size="sm" variant="secondary" label="Cancel" onPress={onCancel} />
                <Button size="sm" label="Save" onPress={save} loading={saving} />
            </ButtonRow>
        </View>
    );
}
