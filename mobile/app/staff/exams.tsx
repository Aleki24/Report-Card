import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useApi } from '@/lib/api';
import { useCurrentUser } from '@/lib/UserContext';
import { useAcademicStructure, useExams } from '@/lib/useSchoolData';
import { errorMessage } from '@/lib/format';
import { Button, ButtonRow, EmptyState, LoadingView, Notice, Screen, ScreenHeader, SegmentedTabs } from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import { ExamPicker } from '@/components/exams/ExamPicker';
import { MarkEntry } from '@/components/exams/MarkEntry';
import { ExamResults } from '@/components/exams/ExamResults';
import { PublishList } from '@/components/exams/PublishList';
import { ReadyToRelease } from '@/components/exams/ReadyToRelease';
import { useApiQuery } from '@/lib/useApiQuery';
import type { ReadyPaper } from '@shared/release-ready';
import { Broadsheet } from '@/components/exams/Broadsheet';
import { CreateExamToggle } from '@/components/exams/CreateExamForm';
import type { ExamSlot, Term } from '@/lib/types';

type Tab = 'entry' | 'results' | 'all' | 'publish';

const TABS = [
    { value: 'entry', label: 'Mark entry' },
    { value: 'results', label: 'Results' },
    { value: 'all', label: 'All subjects' },
    { value: 'publish', label: 'Publish' },
] as const;

const parseTab = (t: string | undefined): Tab => (t === 'results' || t === 'all' || t === 'publish' ? t : 'entry');

/** Standard term exams an admin can set up in one tap, as on the web. */
const STANDARD_TERM_EXAMS = ['OPENER', 'MIDTERM', 'ENDTERM'] as const;

export default function ExamsScreen() {
    return (
        <RequireScreen screen="exams">
            <ExamsContent />
        </RequireScreen>
    );
}

function ExamsContent() {
    const params = useLocalSearchParams<{ tab?: string; exam?: string; term?: string }>();
    const [tab, setTab] = useState<Tab>(parseTab(params.tab));
    const [exam, setExam] = useState<ExamSlot | null>(null);
    const [pickerKey, setPickerKey] = useState(0);
    const [publishKey, setPublishKey] = useState(0);
    // What the dashboard's "ready to release" card counted, shown first on Publish.
    const ready = useApiQuery<ReadyPaper[]>(tab === 'publish' ? '/api/school/exams?ready=1' : null);
    const structure = useAcademicStructure();

    // Tab screens stay mounted, so a later deep link (?tab=results) must switch tabs too.
    useEffect(() => {
        if (params.tab) setTab(parseTab(params.tab));
    }, [params.tab]);

    // ?exam=<id>&term=<id> (the dashboard's marking list) opens that exam's mark sheet directly.
    const linked = useExams(params.exam ? { term_id: params.term ?? null } : null);
    useEffect(() => {
        if (!params.exam) return;
        const found = linked.exams.find((e) => e.id === params.exam);
        if (found) {
            setExam(found);
            setTab(params.tab ? parseTab(params.tab) : 'entry');
        }
    }, [params.exam, params.tab, linked.exams]);

    const { role } = useCurrentUser();
    const api = useApi();
    // Admins see every class (grades the school has a class in), not just those with exams already.
    const allClasses = useMemo(() => {
        const grades = structure.data?.grades ?? [];
        const withClass = new Set((structure.data?.grade_streams ?? []).map((s) => s.grade_id));
        // School order, youngest first: CBC (Playgroup, PP1, PP2, Grade 1…) then 8-4-4 Forms.
        const levelRank = new Map((structure.data?.academic_levels ?? []).map((l) => [l.id, l.code === 'CBC' ? 0 : 1]));
        return grades
            .filter((g) => withClass.has(g.id))
            .sort((a, b) => (levelRank.get(a.academic_level_id) ?? 1) - (levelRank.get(b.academic_level_id) ?? 1) || a.numeric_order - b.numeric_order)
            .map((g) => ({ key: g.id, label: g.name_display }));
    }, [structure.data]);
    const fillGaps = useCallback(async (term: Term, examTypes: string[]) => {
        await api.post('/api/school/exams', { action: 'seed', termId: term.id, academicYearId: term.academic_year_id, examTypes });
    }, [api]);

    const selectTab = (t: Tab) => {
        setTab(t);
        if (t === 'publish' || t === 'all') setExam(null);
    };

    return (
        <Screen>
            <ScreenHeader title="Exams & Marks" description="Enter marks, review results and release them." />
            <SegmentedTabs tabs={TABS} value={tab} onChange={selectTab} />

            {tab === 'publish' ? (
                <>
                    <ReadyToRelease papers={ready.data} error={ready.error} onRetry={ready.reload} onReleased={() => { ready.reload(); setPublishKey((k) => k + 1); }} />
                    <PublishList key={publishKey} onChanged={ready.reload} />
                </>
            ) : tab === 'all' ? (
                structure.loading ? <LoadingView />
                    : structure.data?.grade_streams?.length ? <Broadsheet streams={structure.data.grade_streams} />
                    : <EmptyState title="No classes yet" description="Add classes in Classes, then their marks appear here side by side." />
            ) : exam ? (
                <>
                    <ButtonRow>
                        <Button size="sm" variant="ghost" label="← Choose another exam" onPress={() => setExam(null)} />
                    </ButtonRow>
                    {tab === 'entry' ? (
                        <MarkEntry key={exam.id} exam={exam} structure={structure.data} />
                    ) : (
                        <ExamResults
                            key={exam.id}
                            exam={exam}
                            onEdit={() => setTab('entry')}
                            onChanged={(status) => {
                                setExam({ ...exam, status });
                                setPickerKey((k) => k + 1);
                            }}
                        />
                    )}
                </>
            ) : (
                <ExamPicker
                    key={pickerKey}
                    allClasses={role === 'ADMIN' ? allClasses : undefined}
                    fillGaps={role === 'ADMIN' ? fillGaps : undefined}
                    onSelect={(e) => setExam(e)}
                    emptyAction={(term, reload) => <SeedExamsButton term={term} onDone={reload} />}
                    headerAction={(term, reload) => <CreateExamToggle term={term} structure={structure.data} onCreated={reload} />}
                />
            )}
        </Screen>
    );
}

/** Admin-only: create this term's standard exam slots (POST /api/school/exams action=seed). */
function SeedExamsButton({ term, onDone }: { term: Term; onDone: () => void }) {
    const api = useApi();
    const { role } = useCurrentUser();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    if (role !== 'ADMIN') return null;

    const seed = async () => {
        setBusy(true);
        try {
            const res = await api.post<{ created: number; skipped: number }>('/api/school/exams', { action: 'seed', termId: term.id, academicYearId: term.academic_year_id, examTypes: STANDARD_TERM_EXAMS });
            setMessage({ tone: 'success', text: `Created ${res.created} exam slots (${res.skipped} already existed).` });
            onDone();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not set up exams') });
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {message ? <Notice tone={message.tone} message={message.text} /> : null}
            <Button label="Set up this term's exams" onPress={seed} loading={busy} />
        </>
    );
}
