import React, { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCurrentUser } from '@/lib/UserContext';
import { useApiQuery } from '@/lib/useApiQuery';
import { inviteDeliveryMessage } from '@shared/invite-delivery';
import type { CreatedCredential } from '@shared/import/student-rows';
import { ImportStudentsSheet } from '@/components/people/ImportStudentsSheet';
import { useAcademicStructure, useGradeStreams } from '@/lib/useSchoolData';
import { isSeniorSchoolGrade } from '@shared/curriculum-bands';
import { PATHWAY_ORDER, pathwayLabel } from '@shared/pathway-definitions';
import { BulkPathwaySheet, type CombinationOption } from '@/components/people/BulkPathwaySheet';
import { fullName, pluralize } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import { fonts, makeStyles, spacing, useTheme } from '@/lib/theme';
import { GroupHeading, PersonRow } from '@/components/people/PersonRow';
import {
    Badge, Button, ButtonRow, Card, ChipSelect, FilterGrid, EmptyState, ErrorBanner, ListCard, LoadingView, Notice,
    Screen, ScreenHeader, SearchField, SegmentedTabs,
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
    const params = useLocalSearchParams<{ tab?: string; search?: string; class?: string }>();
    const isAdmin = role === 'ADMIN';
    const [tab, setTab] = useState<Tab>(isAdmin && (params.tab === 'teachers' || params.tab === 'parents') ? params.tab : 'students');

    // Tab screens stay mounted, so a later deep link (?tab=teachers) must switch tabs too.
    useEffect(() => {
        if (isAdmin && (params.tab === 'teachers' || params.tab === 'parents' || params.tab === 'students')) setTab(params.tab);
        else if (params.search || params.class) setTab('students');
    }, [isAdmin, params.tab, params.search, params.class]);

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
    const { colors } = useTheme();
    const router = useRouter();
    const { role } = useCurrentUser();
    const { data, loading, error, refresh } = useApiQuery<StudentListItem[]>('/api/school/data?type=students');
    const { streams } = useGradeStreams();
    const structure = useAcademicStructure();
    const combinations = useApiQuery<CombinationOption[]>('/api/school/data?type=subject_combinations');
    const [pathway, setPathway] = useState<string>('');
    const [assigning, setAssigning] = useState(false);
    const [pathwayNotice, setPathwayNotice] = useState<string | null>(null);

    // Pathways and combinations only apply to CBC Senior School (Grades 10–12), as on the web.
    const seniorStreams = useMemo(() => {
        const levels = structure.data?.academic_levels ?? [];
        const grades = structure.data?.grades ?? [];
        const cbc = new Set(levels.filter((l) => l.code === 'CBC').map((l) => l.id));
        const seniorGrades = new Set(grades.filter((g) => cbc.has(g.academic_level_id) && isSeniorSchoolGrade(g)).map((g) => g.id));
        return streams.filter((s) => seniorGrades.has(s.grade_id));
    }, [structure.data, streams]);
    const hasPathways = (combinations.data ?? []).length > 0;
    // The dashboard's "Find a learner" opens here with ?search=.
    // The Classes page opens a class's learners here with ?class=.
    const { search: searchParam, class: classParam } = useLocalSearchParams<{ search?: string; class?: string }>();
    const [search, setSearch] = useState(searchParam ?? '');
    useEffect(() => { if (searchParam) setSearch(searchParam); }, [searchParam]);
    const [stream, setStream] = useState<string>(classParam ?? '');
    useEffect(() => { if (classParam) setStream(classParam); }, [classParam]);
    const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
    const [limit, setLimit] = useState(PAGE);
    const [adding, setAdding] = useState(false);
    const [importing, setImporting] = useState(false);
    const [created, setCreated] = useState<AddStudentResult | null>(null);
    const [imported, setImported] = useState<CreatedCredential[]>([]);

    const students = data ?? [];
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return students.filter((s) => {
            if (stream && s.current_grade_stream_id !== stream) return false;
            if (status === 'ACTIVE' && s.status !== 'ACTIVE') return false;
            // There is no INACTIVE status; "inactive" is anything not ACTIVE.
            if (status === 'INACTIVE' && s.status === 'ACTIVE') return false;
            if (pathway && (pathway === 'UNASSIGNED' ? !!s.pathway : s.pathway !== pathway)) return false;
            return !q || `${fullName(s.users)} ${s.admission_number ?? ''} ${s.guardian_phone ?? ''}`.toLowerCase().includes(q);
        });
    }, [students, search, stream, status, pathway]);

    // Learners under their class, classes in order, those without one last.
    const groups = useMemo(() => {
        const by = new Map<string, StudentListItem[]>();
        for (const s of filtered.slice(0, limit)) {
            const key = s.grade_streams?.full_name ?? 'No class';
            by.set(key, [...(by.get(key) ?? []), s]);
        }
        return [...by.entries()].sort(([a], [b]) => (a === 'No class' ? 1 : b === 'No class' ? -1 : a.localeCompare(b, undefined, { numeric: true })));
    }, [filtered, limit]);
    const activeCount = students.filter((s) => s.status === 'ACTIVE').length;

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
                            ? `${created.name} added. Username: ${created.username} · Invite code: ${created.invite_code}. ${inviteDeliveryMessage(created.notified)?.text ?? 'Share it so they can activate their account.'}`
                            : `${created.name} added.`
                    }
                />
            ) : null}

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
                    {role === 'ADMIN' && hasPathways && seniorStreams.length > 0 ? (
                        <Button variant="secondary" label="Pathways" onPress={() => setAssigning(true)} />
                    ) : null}
                    <Button variant="secondary" label="Import CSV / Excel" onPress={() => setImporting(true)} />
                    <Button label="+ Add student" onPress={() => setAdding(true)} />
                </ButtonRow>
            )}
            {pathwayNotice ? <Notice tone="success" message={pathwayNotice} onDismiss={() => setPathwayNotice(null)} /> : null}
            {assigning ? (
                <BulkPathwaySheet
                    visible
                    onClose={() => setAssigning(false)}
                    onSaved={(message) => { setPathwayNotice(message); refresh(); }}
                    students={students}
                    seniorStreams={seniorStreams}
                    combinations={combinations.data ?? []}
                    defaultStreamId={stream}
                />
            ) : null}
            {importing ? (
                <ImportStudentsSheet
                    streams={streams}
                    defaultClassId={stream}
                    onClose={() => setImporting(false)}
                    onImported={(list) => { if (list.length > 0) setImported(list); refresh(); }}
                />
            ) : null}
            {imported.length > 0 ? (
                <Notice
                    tone="info"
                    onDismiss={() => setImported([])}
                    message={`New sign-ins (shown once): ${imported.map((c) => `${c.first_name} ${c.last_name} — ${c.username} / ${c.invite_code}`).join('; ')}`}
                />
            ) : null}

            <SearchField value={search} onChangeText={setSearch} placeholder="Search name, admission no. or guardian phone" />
            {streams.length > 1 || (hasPathways && seniorStreams.length > 0) ? (
                <FilterGrid>
                    {streams.length > 1 ? <ChipSelect label="Class" options={[{ value: '', label: 'All classes' }, ...streams.map((s) => ({ value: s.id, label: s.full_name }))]} value={stream} onChange={setStream} /> : null}
                    {hasPathways && seniorStreams.length > 0 ? (
                        <ChipSelect
                            label="Pathway"
                            options={[
                                { value: '', label: 'Any pathway' },
                                ...PATHWAY_ORDER.map((p) => ({ value: p, label: pathwayLabel(p) })),
                                { value: 'UNASSIGNED', label: 'No pathway' },
                            ]}
                            value={pathway}
                            onChange={setPathway}
                        />
                    ) : null}
                </FilterGrid>
            ) : null}
            <ChipSelect
                layout="segmented"
                options={[
                    { value: 'ACTIVE', label: `Active ${activeCount}` },
                    { value: 'INACTIVE', label: `Inactive ${students.length - activeCount}` },
                    { value: 'ALL', label: `All ${students.length}` },
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
                        {groups.map(([className, list]) => (
                            <React.Fragment key={className}>
                                {!stream ? <GroupHeading title={className} count={list.length} /> : null}
                                {list.map((s, i) => (
                                    <PersonRow
                                        key={s.id}
                                        name={fullName(s.users)}
                                        uri={s.avatar_url}
                                        detail={s.guardian_name ? `Guardian: ${s.guardian_name}${s.guardian_phone ? ` · ${s.guardian_phone}` : ''}` : s.guardian_phone ?? null}
                                        tags={[s.admission_number ? `Adm ${s.admission_number}` : null, s.pathway ? `${pathwayLabel(s.pathway)}${s.subject_combinations ? ` · ${s.subject_combinations.code}` : ''}` : null]}
                                        badge={s.status !== 'ACTIVE' ? <Badge label={s.status ?? '—'} /> : undefined}
                                        last={i === list.length - 1}
                                        onPress={() => router.push(`/staff/people/${s.id}?type=student`)}
                                    />
                                ))}
                            </React.Fragment>
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
    const { colors } = useTheme();
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
                    {teachers.map((t, i) => (
                        <PersonRow
                            key={t.id}
                            name={fullName(t.profile)}
                            uri={t.profile.avatar_url}
                            detail={t.profile.job_title ?? roleLabel(t.profile.role)}
                            tags={[t.subjects, t.classes]}
                            badge={t.profile.is_active ? undefined : <Badge label="Inactive" variant="danger" />}
                            last={i === teachers.length - 1}
                            onPress={() => router.push(`/staff/people/${t.id}?type=teacher`)}
                        />
                    ))}
                </ListCard>
            )}
        </>
    );
}

function ParentsSection() {
    const styles = useStyles();
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
            <Text style={styles.summary}>
                {pluralize(parents.length, 'parent')} · {pluralize(parents.reduce((a, p) => a + p.students.length, 0), 'child', 'children')} linked · {parents.filter((p) => p.phone).length} with a phone
            </Text>
            <SearchField value={search} onChangeText={setSearch} placeholder="Search parents or their children" />
            {filtered.length === 0 ? (
                <EmptyState title="No parents found" description="Parents come from each student's guardian details." />
            ) : (
                <ListCard>
                    {filtered.map((p, i) => (
                        <PersonRow
                            key={p.id}
                            name={p.name}
                            detail={p.email || null}
                            tags={p.students.map((c) => `${c.first_name} ${c.last_name}${c.grade_stream ? ` · ${c.grade_stream.full_name}` : ''}`)}
                            phone={p.phone || null}
                            last={i === filtered.length - 1}
                        />
                    ))}
                </ListCard>
            )}
        </>
    );
}

const useStyles = makeStyles((colors) => ({
    summary: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted, marginBottom: spacing.md },
}));
