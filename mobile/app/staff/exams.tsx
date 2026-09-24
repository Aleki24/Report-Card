import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useApi } from '@/lib/api';
import { useCurrentUser } from '@/lib/UserContext';
import { useAcademicStructure } from '@/lib/useSchoolData';
import { errorMessage } from '@/lib/format';
import { Button, ButtonRow, Notice, Screen, ScreenHeader, SegmentedTabs } from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import { ExamPicker } from '@/components/exams/ExamPicker';
import { MarkEntry } from '@/components/exams/MarkEntry';
import { ExamResults } from '@/components/exams/ExamResults';
import { PublishList } from '@/components/exams/PublishList';
import { CreateExamToggle } from '@/components/exams/CreateExamForm';
import type { ExamSlot, Term } from '@/lib/types';

type Tab = 'entry' | 'results' | 'publish';

const TABS = [
    { value: 'entry', label: 'Mark entry' },
    { value: 'results', label: 'Results' },
    { value: 'publish', label: 'Publish' },
] as const;

const parseTab = (t: string | undefined): Tab => (t === 'results' || t === 'publish' ? t : 'entry');

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
    const params = useLocalSearchParams<{ tab?: string }>();
    const [tab, setTab] = useState<Tab>(parseTab(params.tab));
    const [exam, setExam] = useState<ExamSlot | null>(null);
    const [pickerKey, setPickerKey] = useState(0);
    const structure = useAcademicStructure();

    // Tab screens stay mounted, so a later deep link (?tab=results) must switch tabs too.
    useEffect(() => {
        if (params.tab) setTab(parseTab(params.tab));
    }, [params.tab]);

    const selectTab = (t: Tab) => {
        setTab(t);
        if (t === 'publish') setExam(null);
    };

    return (
        <Screen>
            <ScreenHeader title="Exams & Marks" description="Enter marks, review results and release them." />
            <SegmentedTabs tabs={TABS} value={tab} onChange={selectTab} />

            {tab === 'publish' ? (
                <PublishList />
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
