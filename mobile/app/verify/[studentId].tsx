import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, SearchX } from 'lucide-react-native';
import { publicGet, withQuery } from '@/lib/api';
import { errorMessage, formatDate } from '@/lib/format';
import { useOptionalCurrentUser } from '@/lib/UserContext';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { BackLink, Button, Card, EmptyState, LoadingView, Screen, StatGrid, StatTile } from '@/components/ui';
import { Wordmark } from '@/components/auth/AuthShell';

/** /api/verify/[studentId] (src/lib/verify-results.ts, which is server-only). */
interface VerifiedSubject {
    subject: string;
    code: string | null;
    score: number;
    outOf: number;
    percentage: number;
    grade: string;
    rubric: string | null;
}

interface VerifiedResults {
    school: { name: string; logoUrl: string | null };
    student: { name: string; admissionNumber: string | null; className: string | null };
    term: string | null;
    academicYear: string | null;
    examType: string | null;
    approvedAt: string | null;
    subjects: VerifiedSubject[];
    summary: {
        mean: number;
        grade: string | null;
        totalPoints: number | null;
        subjectCount: number;
        classRank: number | null;
        totalStudents: number | null;
    };
}

type Load = { state: 'loading' } | { state: 'ready'; data: VerifiedResults } | { state: 'missing'; message: string };

/**
 * What a report card's QR code opens — the web's /verify/[studentId]: the
 * school's approved results for one sitting. Public: a parent holding the
 * printed card needs no account. Opens from https://skulbase.com/verify/…
 * (Android App Links) or skulbase://verify/….
 */
export default function VerifyResultsScreen() {
    const router = useRouter();
    const user = useOptionalCurrentUser();
    const { studentId, t, e, term, examType } = useLocalSearchParams<{ studentId: string; t?: string; e?: string; term?: string; examType?: string }>();
    const [load, setLoad] = useState<Load>({ state: 'loading' });

    useEffect(() => {
        if (!studentId) return;
        setLoad({ state: 'loading' });
        // `t`/`e` are the compact keys the QR uses; the long spellings keep older links working.
        publicGet<VerifiedResults>(withQuery(`/api/verify/${encodeURIComponent(studentId)}`, { t: t ?? term, e: e ?? examType }))
            .then((data) => setLoad({ state: 'ready', data }))
            .catch((err: unknown) => setLoad({ state: 'missing', message: errorMessage(err, 'No published results found for this code.') }));
    }, [studentId, t, e, term, examType]);

    if (load.state === 'loading') return <LoadingView />;

    if (load.state === 'missing') {
        return (
            <Screen>
                <BackLink />
                <Card>
                    <EmptyState icon={SearchX} title="Results not found" description={`${load.message} Check you scanned the code on a Skulbase report card, or ask the school.`} />
                </Card>
            </Screen>
        );
    }

    const { school, student, summary, subjects } = load.data;
    const sitting = [load.data.examType, load.data.term, load.data.academicYear].filter(Boolean).join(' · ');
    const firstName = student.name.split(' ')[0] || 'the learner';

    return (
        <Screen>
            <BackLink />
            <View style={styles.schoolRow}>
                {school.logoUrl ? <Image source={{ uri: school.logoUrl }} style={styles.logo} accessibilityIgnoresInvertColors /> : null}
                <View style={{ flex: 1 }}>
                    <Text style={styles.schoolName} numberOfLines={2}>{school.name}</Text>
                    {sitting ? <Text style={styles.muted}>{sitting}</Text> : null}
                </View>
            </View>

            <View style={styles.verified}>
                <BadgeCheck size={20} color={colors.success} />
                <Text style={styles.verifiedText}>
                    Verified results, approved by the school{load.data.approvedAt ? ` on ${formatDate(new Date(load.data.approvedAt))}` : ''}.
                </Text>
            </View>

            <Text style={styles.studentName}>{student.name}</Text>
            <Text style={styles.muted}>{[student.admissionNumber && `Adm. ${student.admissionNumber}`, student.className].filter(Boolean).join(' · ')}</Text>

            <View style={{ height: spacing.md }} />
            <StatGrid>
                <StatTile label="Mean score" value={`${summary.mean}%`} />
                <StatTile label="Grade" value={summary.grade ?? '—'} />
                {summary.totalPoints != null ? <StatTile label="Points" value={summary.totalPoints} /> : null}
                {summary.classRank != null ? <StatTile label="Position" value={`${summary.classRank}${summary.totalStudents ? ` / ${summary.totalStudents}` : ''}`} /> : null}
                <StatTile label="Subjects" value={summary.subjectCount} />
            </StatGrid>

            <Card style={styles.table}>
                <Text style={styles.tableTitle}>Subject results</Text>
                <View style={[styles.tr, styles.thead]}>
                    <Text style={[styles.th, { flex: 1 }]}>Subject</Text>
                    <Text style={[styles.th, styles.num]}>Score</Text>
                    <Text style={[styles.th, styles.num]}>%</Text>
                    <Text style={[styles.th, styles.grade]}>Grade</Text>
                </View>
                {subjects.map((s, i) => (
                    <View key={`${s.subject}-${i}`} style={styles.tr}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.td}>{s.subject}</Text>
                            {s.rubric ? <Text style={styles.rubric}>{s.rubric}</Text> : null}
                        </View>
                        <Text style={[styles.td, styles.num]}>{s.score}<Text style={styles.muted}>/{s.outOf}</Text></Text>
                        <Text style={[styles.td, styles.num]}>{s.percentage}</Text>
                        <Text style={[styles.td, styles.grade, { fontFamily: fonts.semibold }]}>{s.grade}</Text>
                    </View>
                ))}
            </Card>

            {/* One sitting here; the learner's own account has every term, attendance and fees. */}
            {!user ? (
                <Card style={styles.signIn}>
                    <Text style={styles.signInTitle}>Are you {firstName}?</Text>
                    <Text style={[styles.muted, { textAlign: 'center' }]}>Sign in to your student account to see every term’s results, your subjects, attendance and fee statements.</Text>
                    <View style={{ marginTop: spacing.md, alignSelf: 'stretch' }}>
                        <Button label="Sign in to your account" onPress={() => router.replace('/(auth)/sign-in')} block />
                    </View>
                    <Text style={[styles.rubric, { textAlign: 'center', marginTop: spacing.sm }]}>Not activated yet? You’ll just need the invite code from your school.</Text>
                </Card>
            ) : null}

            <Text style={styles.footer}>Scanned from a {school.name} report card.{'\n'}Powered by <Wordmark /></Text>
        </Screen>
    );
}

const styles = StyleSheet.create({
    center: { alignItems: 'center', paddingTop: spacing.xl },
    schoolRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.md },
    logo: { width: 48, height: 48, borderRadius: radius.lg },
    schoolName: { fontSize: 18, fontFamily: fonts.display, color: colors.foreground },
    muted: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted },
    verified: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successBg, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.lg },
    verifiedText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: fonts.medium, color: '#016630' },
    studentName: { fontSize: 20, fontFamily: fonts.display, color: colors.foreground },
    table: { marginTop: spacing.lg, padding: 0, overflow: 'hidden' },
    tableTitle: { fontSize: 14, fontFamily: fonts.display, color: colors.foreground, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: spacing.sm },
    thead: { backgroundColor: colors.mutedBg },
    th: { fontSize: 11, fontFamily: fonts.semibold, color: colors.muted },
    td: { fontSize: 14, fontFamily: fonts.regular, color: colors.foreground },
    num: { width: 56, textAlign: 'right' },
    grade: { width: 48, textAlign: 'right' },
    rubric: { fontSize: 11, lineHeight: 15, fontFamily: fonts.regular, color: colors.muted },
    signIn: { marginTop: spacing.lg, alignItems: 'center', borderColor: '#bedbff', backgroundColor: '#f3f7ff' },
    signInTitle: { fontSize: 15, fontFamily: fonts.display, color: colors.foreground, marginBottom: 4 },
    footer: { marginTop: spacing.xl, fontSize: 11, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
});
