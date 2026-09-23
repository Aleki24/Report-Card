import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCurrentUser } from '@/lib/UserContext';
import { useApiQuery } from '@/lib/useApiQuery';
import { useGradeStreams } from '@/lib/useSchoolData';
import { fullName, pluralize } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import { colors, spacing } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SearchField, SegmentedTabs, StatGrid, StatTile,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import { EMPTY_STUDENT, StudentForm, type AddStudentResult } from '@/components/people/StudentForm';
import type { StudentListItem, TeacherListItem } from '@/lib/types';

type Tab = 'students' | 'teachers' | 'parents';

interface Parent {
    id: string;
    name: string;
    phone: string;
    email: string;
    students: { id: string; first_name: string; last_name: string; admission_number: string | null; grade_stream: { full_name: string } | null }[];
}

const PAGE = 40;

export default function PeopleScreen() {
    return (
        <RequireScreen screen="people/index">
            <PeopleContent />
        </RequireScreen>
    );
}

function PeopleContent() {
    const { role } = useCurrentUser();
    const params = useLocalSearchParams<{ tab?: string }>();
    const isAdmin = role === 'ADMIN';
    const [tab, setTab] = useState<Tab>(isAdmin && (params.tab === 'teachers' || params.tab === 'parents') ? params.tab : 'students');

    // Tab screens stay mounted, so a later deep link (?tab=teachers) must switch tabs too.
    useEffect(() => {
        if (isAdmin && (params.tab === 'teachers' || params.tab === 'parents' || params.tab === 'students')) setTab(params.tab);
    }, [isAdmin, params.tab]);

    return (
        <Screen>
            <ScreenHeader title="People" description={isAdmin ? 'Students, staff and parents at your school.' : 'The learners in your class.'} />
            {isAdmin ? (
                <SegmentedTabs
                    tabs={[
                        { value: 'students', label: 'Students' },
                        { value: 'teachers', label: 'Staff' },
                        { value: 'parents', label: 'Parents' },
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            ) : null}
            {tab === 'students' ? <StudentsSection /> : tab === 'teachers' ? <TeachersSection /> : <ParentsSection />}
        </Screen>
    );
}

function StudentsSection() {
    const router = useRouter();
    const { data, loading, error, refresh } = useApiQuery<StudentListItem[]>('/api/school/data?type=students');
    const { streams } = useGradeStreams();
    const [search, setSearch] = useState('');
    const [stream, setStream] = useState<string>('');
    const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
    const [limit, setLimit] = useState(PAGE);
    const [adding, setAdding] = useState(false);
    const [created, setCreated] = useState<AddStudentResult | null>(null);

    const students = data ?? [];
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return students.filter((s) => {
            if (stream && s.current_grade_stream_id !== stream) return false;
            if (status === 'ACTIVE' && s.status !== 'ACTIVE') return false;
            // There is no INACTIVE status; "inactive" is anything not ACTIVE.
            if (status === 'INACTIVE' && s.status === 'ACTIVE') return false;
            return !q || `${fullName(s.users)} ${s.admission_number ?? ''} ${s.guardian_phone ?? ''}`.toLowerCase().includes(q);
        });
    }, [students, search, stream, status]);

    if (loading) return <LoadingView />;

    return (
        <>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {created ? (
                <Notice
                    tone="success"
                    onDismiss={() => setCreated(null)}
                    message={
                        created.invite_code
                            ? `${created.name} added. Username: ${created.username} · Invite code: ${created.invite_code} — share it so they can activate their account.`
                            : `${created.name} added.`
                    }
                />
            ) : null}

            <StatGrid>
                <StatTile label="Total" value={students.length} />
                <StatTile label="Active" value={students.filter((s) => s.status === 'ACTIVE').length} />
            </StatGrid>

            {adding ? (
                <StudentForm
                    initial={{ ...EMPTY_STUDENT, grade_stream_id: stream || (streams.length === 1 ? streams[0].id : null) }}
                    streams={streams}
                    onCancel={() => setAdding(false)}
                    onSaved={(res) => {
                        setAdding(false);
                        setCreated(res);
                        refresh();
                    }}
                />
            ) : (
                <ButtonRow>
                    <Button label="+ Add student" onPress={() => setAdding(true)} />
                </ButtonRow>
            )}

            <SearchField value={search} onChangeText={setSearch} placeholder="Search name, admission no. or guardian phone" />
            {streams.length > 1 ? (
                <ChipSelect options={[{ value: '', label: 'All classes' }, ...streams.map((s) => ({ value: s.id, label: s.full_name }))]} value={stream} onChange={setStream} />
            ) : null}
            <ChipSelect
                options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'INACTIVE', label: 'Inactive' },
                    { value: 'ALL', label: 'All' },
                ]}
                value={status}
                onChange={setStatus}
            />

            {filtered.length === 0 ? (
                <EmptyState title="No students found" />
            ) : (
                <>
                    <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.sm }}>{pluralize(filtered.length, 'student')}</Text>
                    <ListCard>
                        {filtered.slice(0, limit).map((s) => (
                            <ListRow
                                key={s.id}
                                title={fullName(s.users)}
                                subtitle={`${s.admission_number ?? '—'} · ${s.grade_streams?.full_name ?? 'Unassigned'}`}
                                right={s.status !== 'ACTIVE' ? <Badge label={s.status ?? '—'} /> : undefined}
                                onPress={() => router.push(`/staff/people/${s.id}?type=student`)}
                            />
                        ))}
                    </ListCard>
                    {filtered.length > limit ? (
                        <ButtonRow>
                            <Button variant="ghost" label={`Show ${Math.min(PAGE, filtered.length - limit)} more`} onPress={() => setLimit((l) => l + PAGE)} />
                        </ButtonRow>
                    ) : null}
                </>
            )}
        </>
    );
}

function TeachersSection() {
    const router = useRouter();
    const { data, loading, error, refresh } = useApiQuery<TeacherListItem[]>('/api/school/data?type=teachers');
    const [search, setSearch] = useState('');

    if (loading) return <LoadingView />;
    const q = search.trim().toLowerCase();
    const teachers = (data ?? []).filter((t) => !q || `${fullName(t.profile)} ${t.subjects} ${t.classes}`.toLowerCase().includes(q));

    return (
        <>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            <Card style={{ marginBottom: spacing.md }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>New staff join with an invite code. Create accounts and assign roles under Users.</Text>
                <ButtonRow>
                    <Button size="sm" variant="secondary" label="Open Users" onPress={() => router.push('/staff/users')} />
                </ButtonRow>
            </Card>
            <SearchField value={search} onChangeText={setSearch} placeholder="Search name, subject or class" />
            {teachers.length === 0 ? (
                <EmptyState title="No staff found" />
            ) : (
                <ListCard>
                    {teachers.map((t) => (
                        <ListRow
                            key={t.id}
                            title={fullName(t.profile)}
                            subtitle={[t.profile.job_title ?? roleLabel(t.profile.role), t.subjects, t.classes].filter(Boolean).join(' · ')}
                            right={t.profile.is_active ? undefined : <Badge label="Inactive" variant="danger" />}
                            onPress={() => router.push(`/staff/people/${t.id}?type=teacher`)}
                        />
                    ))}
                </ListCard>
            )}
        </>
    );
}

function ParentsSection() {
    const { data, loading, error, refresh } = useApiQuery<Parent[]>('/api/school/data?type=parents');
    const [search, setSearch] = useState('');

    if (loading) return <LoadingView />;
    const parents = data ?? [];
    const q = search.trim().toLowerCase();
    const filtered = parents.filter(
        (p) => !q || p.name.toLowerCase().includes(q) || p.phone.includes(q) || p.email.toLowerCase().includes(q) || p.students.some((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)),
    );

    return (
        <>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            <StatGrid>
                <StatTile label="Parents" value={parents.length} />
                <StatTile label="Linked students" value={parents.reduce((a, p) => a + p.students.length, 0)} />
                <StatTile label="With phone" value={parents.filter((p) => p.phone).length} />
                <StatTile label="With email" value={parents.filter((p) => p.email).length} />
            </StatGrid>
            <SearchField value={search} onChangeText={setSearch} placeholder="Search parents or their children" />
            {filtered.length === 0 ? (
                <EmptyState title="No parents found" description="Parents come from each student's guardian details." />
            ) : (
                <ListCard>
                    {filtered.map((p) => (
                        <ListRow
                            key={p.id}
                            title={p.name}
                            subtitle={[p.phone, p.email].filter(Boolean).join(' · ')}
                            meta={p.students.map((s) => `${s.first_name} ${s.last_name}${s.grade_stream ? ` (${s.grade_stream.full_name})` : ''}`).join(', ')}
                            onPress={p.phone ? () => void Linking.openURL(`tel:${p.phone}`) : undefined}
                        />
                    ))}
                </ListCard>
            )}
        </>
    );
}
