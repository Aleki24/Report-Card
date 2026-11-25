import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, PhoneOff, Plus, Route, Upload, UserCog, UsersRound, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCurrentUser } from '@/lib/UserContext';
import { useApiQuery } from '@/lib/useApiQuery';
import { inviteDeliveryMessage } from '@shared/invite-delivery';
import type { CreatedCredential } from '@shared/import/student-rows';
import { ImportStudentsSheet } from '@/components/people/ImportStudentsSheet';
import { useAcademicStructure, useManagedGradeStreams } from '@/lib/useSchoolData';
import { isSeniorSchoolGrade } from '@shared/curriculum-bands';
import { PATHWAY_ORDER, pathwayLabel } from '@shared/pathway-definitions';
import { BulkPathwaySheet, type CombinationOption } from '@/components/people/BulkPathwaySheet';
import { fullName, pluralize } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import { fonts, makeStyles, spacing, useTheme } from '@/lib/theme';
import { GroupHeading, PersonRow } from '@/components/people/PersonRow';
import {
    Badge, Button, ButtonRow, ChipSelect, FilterGrid, EmptyState, ErrorBanner, LoadingView, Notice,
    Screen, ScreenHeader, SearchField, SegmentedTabs, StatGrid, StatTile,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import { EMPTY_STUDENT, StudentForm, type AddStudentResult } from '@/components/people/StudentForm';
import type { StudentListItem, TeacherListItem } from '@/lib/types';
import type { UserRole } from '@/lib/roles';

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
    // The tab's one main action sits in the header, as on every screen.
    const [adding, setAdding] = useState(false);

    // Tab screens stay mounted, so a later deep link (?tab=teachers) must switch tabs too.
    useEffect(() => {
        if (isAdmin && (params.tab === 'teachers' || params.tab === 'parents' || params.tab === 'students')) setTab(params.tab);
        else if (params.search || params.class) setTab('students');
    }, [isAdmin, params.tab, params.search, params.class]);

    return (
        <Screen>
            <ScreenHeader title="People" action={tab === 'students' && !adding ? <Button size="sm" icon={Plus} label="Add" onPress={() => setAdding(true)} /> : undefined} />
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
            {tab === 'students' ? <StudentsSection adding={adding} setAdding={setAdding} /> : tab === 'teachers' ? <TeachersSection /> : <ParentsSection />}
        </Screen>
    );
}

function StudentsSection({ adding, setAdding }: { adding: boolean; setAdding: (adding: boolean) => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const { role } = useCurrentUser();
    // A class teacher's People is their own class (as on the web), and they
    // add or move learners only within the classes they run.
    const { data, loading, error, refresh } = useApiQuery<StudentListItem[]>(`/api/school/data?type=students${role === 'CLASS_TEACHER' ? '&scope=class' : ''}`);
    const { streams } = useManagedGradeStreams();
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
    // From the "No guardian phone" tile: only the learners nobody can text.
    const [noPhone, setNoPhone] = useState(false);
    const [limit, setLimit] = useState(PAGE);
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
            if (noPhone && s.guardian_phone?.trim()) return false;
            return !q || `${fullName(s.users)} ${s.admission_number ?? ''} ${s.guardian_phone ?? ''}`.toLowerCase().includes(q);
        });
    }, [students, search, stream, status, pathway, noPhone]);

    // Learners under their class, classes in order, those without one last.
    const groups = useMemo(() => {
        const by = new Map<string, StudentListItem[]>();
        const byName = [...filtered].sort((a, b) => fullName(a.users).localeCompare(fullName(b.users)));
        for (const s of byName.slice(0, limit)) {
            const key = s.grade_streams?.full_name ?? 'No class';
            by.set(key, [...(by.get(key) ?? []), s]);
        }
        return [...by.entries()].sort(([a], [b]) => (a === 'No class' ? 1 : b === 'No class' ? -1 : a.localeCompare(b, undefined, { numeric: true })));
    }, [filtered, limit]);
    const active = students.filter((s) => s.status === 'ACTIVE');
    const activeCount = active.length;
    const classCount = new Set(active.map((s) => s.current_grade_stream_id).filter(Boolean)).size;
    const withoutPhone = active.filter((s) => !s.guardian_phone?.trim()).length;

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

            <StatGrid>
                <StatTile icon={UsersRound} label="Learners" value={activeCount} sub={`in ${pluralize(classCount, 'class', 'classes')}`} />
                <StatTile
                    icon={PhoneOff}
                    label="No phone"
                    value={withoutPhone}
                    sub={withoutPhone > 0 ? (noPhone ? 'showing them' : 'tap to see them') : 'every guardian reachable'}
                    tone={withoutPhone > 0 ? colors.warning : colors.success}
                    onPress={withoutPhone > 0 ? () => { setNoPhone((v) => !v); setStatus('ACTIVE'); } : undefined}
                />
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
                <ActionBar>
                    <View style={{ flex: 1 }}><Button variant="secondary" icon={Upload} label="Import" onPress={() => setImporting(true)} /></View>
                    {role === 'ADMIN' && hasPathways && seniorStreams.length > 0 ? (
                        <View style={{ flex: 1 }}><Button variant="secondary" icon={Route} label="Pathways" onPress={() => setAssigning(true)} /></View>
                    ) : null}
                </ActionBar>
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

            {noPhone ? (
                <Pressable onPress={() => setNoPhone(false)} accessibilityRole="button" accessibilityLabel="Show everyone, not only learners without a guardian phone" style={styles.filterChip}>
                    <Text style={styles.filterChipText}>Without a guardian phone</Text>
                    <X size={14} color={colors.warningText} />
                </Pressable>
            ) : null}
            {filtered.length === 0 ? (
                <EmptyState title="No students found" />
            ) : (
                <>
                    <Text style={styles.count}>{pluralize(filtered.length, 'student')}</Text>
                    <View>
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
                    </View>
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

/** The tab's actions across the full width, in line with the tiles and search below. */
function ActionBar({ children }: { children: React.ReactNode }) {
    const styles = useStyles();
    return <View style={styles.actions}>{children}</View>;
}

/** Staff grouped by what they do, leaders first. */
const ROLE_ORDER: readonly UserRole[] = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'];
const roleRank = (role: UserRole) => {
    const i = ROLE_ORDER.indexOf(role);
    return i === -1 ? ROLE_ORDER.length : i;
};

function TeachersSection() {
    const { colors } = useTheme();
    const router = useRouter();
    const { data, loading, error, refresh } = useApiQuery<TeacherListItem[]>('/api/school/data?type=teachers');
    const [search, setSearch] = useState('');

    const staff = useMemo(() => data ?? [], [data]);
    const groups = useMemo(() => {
        const q = search.trim().toLowerCase();
        const shown = staff
            .filter((t) => !q || `${fullName(t.profile)} ${t.profile.job_title ?? ''} ${t.subjects} ${t.classes}`.toLowerCase().includes(q))
            .sort((a, b) => roleRank(a.profile.role) - roleRank(b.profile.role) || fullName(a.profile).localeCompare(fullName(b.profile)));
        const by = new Map<string, TeacherListItem[]>();
        for (const t of shown) {
            const key = roleLabel(t.profile.role);
            by.set(key, [...(by.get(key) ?? []), t]);
        }
        return [...by.entries()];
    }, [staff, search]);

    if (loading) return <LoadingView />;
    const active = staff.filter((t) => t.profile.is_active);
    const teaching = active.filter((t) => t.stats.subjectCount > 0 || t.stats.classCount > 0).length;

    return (
        <>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            <StatGrid>
                <StatTile icon={UsersRound} label="Staff" value={active.length} sub={staff.length > active.length ? `${staff.length - active.length} inactive` : undefined} />
                <StatTile icon={GraduationCap} label="Teaching" value={teaching} sub={active.length > teaching ? `${active.length - teaching} not assigned` : 'everyone assigned'} tone={active.length > teaching ? colors.warning : colors.success} />
            </StatGrid>
            <ActionBar>
                <View style={{ flex: 1 }}><Button variant="secondary" icon={UserCog} label="Accounts & roles" onPress={() => router.push('/staff/users')} /></View>
            </ActionBar>
            <SearchField value={search} onChangeText={setSearch} placeholder="Search name, subject or class" />
            {groups.length === 0 ? (
                <EmptyState title="No staff found" />
            ) : (
                <View>
                    {groups.map(([group, list]) => (
                        <React.Fragment key={group}>
                            <GroupHeading title={group} count={list.length} />
                            {list.map((t, i) => (
                                <PersonRow
                                    key={t.id}
                                    name={fullName(t.profile)}
                                    uri={t.profile.avatar_url}
                                    detail={t.profile.job_title ?? null}
                                    tags={[t.classes, t.subjects]}
                                    phone={t.profile.phone}
                                    badge={t.profile.is_active ? undefined : <Badge label="Inactive" variant="danger" />}
                                    last={i === list.length - 1}
                                    onPress={() => router.push(`/staff/people/${t.id}?type=teacher`)}
                                />
                            ))}
                        </React.Fragment>
                    ))}
                </View>
            )}
        </>
    );
}

function ParentsSection() {
    const { colors } = useTheme();
    const router = useRouter();
    const { data, loading, error, refresh } = useApiQuery<Parent[]>('/api/school/data?type=parents');
    const [search, setSearch] = useState('');

    if (loading) return <LoadingView />;
    const parents = data ?? [];
    const q = search.trim().toLowerCase();
    const filtered = parents
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.phone.includes(q) || p.email.toLowerCase().includes(q) || p.students.some((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name));
    const children = parents.reduce((n, p) => n + p.students.length, 0);
    const noPhone = parents.filter((p) => !p.phone).length;

    return (
        <>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            <StatGrid>
                <StatTile icon={UsersRound} label="Parents" value={parents.length} sub={`${pluralize(children, 'child', 'children')} linked`} />
                <StatTile icon={PhoneOff} label="No phone" value={noPhone} sub={noPhone > 0 ? 'cannot get SMS' : 'everyone reachable'} tone={noPhone > 0 ? colors.warning : colors.success} />
            </StatGrid>
            <ActionBar>
                <View style={{ flex: 1 }}><Button variant="secondary" icon={Plus} label="Link a class's parents" onPress={() => router.push('/staff/parent-accounts?tab=class')} /></View>
            </ActionBar>
            <SearchField value={search} onChangeText={setSearch} placeholder="Search parents or their children" />
            {filtered.length === 0 ? (
                <EmptyState title="No parents found" />
            ) : (
                <View>
                    {filtered.map((p, i) => (
                        <PersonRow
                            key={p.id}
                            name={p.name}
                            detail={p.email || null}
                            tags={p.students.map((c) => `${c.first_name} ${c.last_name}${c.grade_stream ? ` · ${c.grade_stream.full_name}` : ''}`)}
                            phone={p.phone || null}
                            badge={p.phone ? undefined : <Badge label="No phone" variant="warning" />}
                            last={i === filtered.length - 1}
                        />
                    ))}
                </View>
            )}
        </>
    );
}

const useStyles = makeStyles((colors) => ({
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
    count: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted, marginBottom: spacing.sm },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginBottom: spacing.sm,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder,
    },
    filterChipText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.warningText },
}));
