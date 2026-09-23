import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, ChipSelect, EmptyState, ErrorBanner, LoadingView, SectionLabel } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import { examTypeLabel } from '@/lib/academics';
import { examLabel, useExams, useTerms } from '@/lib/useSchoolData';
import { ReleaseControl } from './ReleaseControl';
import type { ExamSlot } from '@/lib/types';

type StatusFilter = 'all' | 'DRAFT' | 'APPROVED';

/** Every exam the caller can release in a term, grouped by class — the web's Publish tab. */
export function PublishList() {
    const { terms, activeTermId, loading: termsLoading } = useTerms();
    const [termId, setTermId] = useState<string | null>(null);
    const [filter, setFilter] = useState<StatusFilter>('DRAFT');
    const effectiveTermId = termId ?? activeTermId;
    const { exams, loading, error, reload } = useExams(effectiveTermId ? { term_id: effectiveTermId } : null);

    const groups = useMemo(() => {
        const map = new Map<string, ExamSlot[]>();
        for (const e of exams) {
            if (filter !== 'all' && (filter === 'APPROVED' ? e.status !== 'APPROVED' : e.status === 'APPROVED')) continue;
            const key = `${e.grade_name} · ${examTypeLabel(e.exam_type)}`;
            map.set(key, [...(map.get(key) ?? []), e]);
        }
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    }, [exams, filter]);

    if (termsLoading) return <LoadingView />;

    return (
        <View>
            <ChipSelect label="Term" options={terms.map((t) => ({ value: t.id, label: t.name }))} value={effectiveTermId} onChange={setTermId} />
            <ChipSelect
                options={[
                    { value: 'DRAFT', label: 'Not released' },
                    { value: 'APPROVED', label: 'Released' },
                    { value: 'all', label: 'All' },
                ]}
                value={filter}
                onChange={setFilter}
            />
            <Text style={styles.help}>Releasing makes results visible to students and on the parent QR page. Whoever entered the marks, or an admin, can release or withdraw them.</Text>
            {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
            {loading ? (
                <LoadingView />
            ) : groups.length === 0 ? (
                <EmptyState title={filter === 'DRAFT' ? 'Nothing waiting to be released' : 'No exams here'} />
            ) : (
                groups.map(([label, list]) => (
                    <View key={label}>
                        <SectionLabel>{label}</SectionLabel>
                        {list.map((e) => (
                            <Card key={e.id} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                                <Text style={styles.name}>{examLabel(e)}</Text>
                                <Text style={[styles.help, { marginBottom: spacing.sm }]}>{e.name}</Text>
                                <ReleaseControl exam={e} compact onChanged={() => reload()} />
                            </Card>
                        ))}
                    </View>
                ))
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    help: { fontSize: 12, color: colors.muted, marginBottom: spacing.sm },
    name: { fontSize: 14, fontWeight: '700', color: colors.foreground },
});
