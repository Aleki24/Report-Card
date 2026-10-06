import React, { useState } from 'react';
import { whatsappNumber } from './PersonRow';
import { Linking, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import {
    AtSign, Award, BookMarked, BookOpen, Cake, Camera, CalendarDays, ClipboardCheck, Copy, FileText, Hash, Layers, Mail,
    MessageCircle, Pencil, Phone, School, Trash2, TrendingUp, UserRound, Users, type LucideIcon,
} from 'lucide-react-native';
import type { StudentProfileResponse, TermPerformance } from '@shared/user-profile';
import { formatDate, gradeTone, initials } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme, shadowFor } from '@/lib/theme';
import { Avatar, SegmentedTabs } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { InsightCard, KpiGrid, KpiTile, Meter, PressScale, Reveal } from '@/components/dashboard/kit';

export type StudentTab = 'overview' | 'academics' | 'records';

const TABS = [
    { value: 'overview', label: 'Overview' },
    { value: 'academics', label: 'Academics' },
    { value: 'records', label: 'Records' },
] as const;

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Active', TRANSFERRED: 'Transferred', GRADUATED: 'Graduated', DEACTIVATED: 'Deactivated' };

const humanize = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Years since a date of birth, or null. */
function ageFrom(dob: string | null): number | null {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age >= 0 && age < 120 ? age : null;
}

/** The most recent term that has any marks recorded. */
function latestTermWithMarks(history: readonly TermPerformance[]): TermPerformance | null {
    for (let i = history.length - 1; i >= 0; i--) if (history[i].subjects.length > 0) return history[i];
    return null;
}


/** One detail line: icon, label, value; tappable to call/mail, long-press to copy. */
function InfoItem({ icon: Icon, label, value, href, copy }: { icon: LucideIcon; label: string; value: string | null | undefined; href?: string; copy?: boolean }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const toast = useToast();
    const shown = value && value.trim() ? value : null;
    const copyIt = () => {
        if (!shown) return;
        void Clipboard.setStringAsync(shown).then(() => toast.success(`${label} copied`));
    };
    return (
        <Pressable
            disabled={!shown || (!href && !copy)}
            onPress={() => (href ? void Linking.openURL(href) : copyIt())}
            onLongPress={copyIt}
            style={({ pressed }) => [styles.info, pressed && { opacity: 0.7 }]}
            accessibilityLabel={`${label}: ${shown ?? 'not set'}`}
        >
            <View style={styles.infoIcon}><Icon size={15} color={colors.muted} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={[styles.infoValue, !shown && styles.infoEmpty, href && shown ? { color: colors.primary } : null]} numberOfLines={2}>{shown ?? 'Not set'}</Text>
            </View>
            {copy && shown ? <Copy size={14} color={colors.muted} /> : null}
        </Pressable>
    );
}

function Quiet({ children }: { children: string }) {
    const styles = useStyles();
    return <Text style={styles.quiet}>{children}</Text>;
}

/** A row with a coloured bar: a term average, a subject mark or a term's attendance. */
function ScoreRow({ label, percent, right }: { label: string; percent: number | null; right?: string }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const color = percent == null ? colors.muted : gradeTone(colors, percent);
    return (
        <View style={styles.scoreRow}>
            <View style={styles.scoreHead}>
                <Text style={styles.scoreLabel} numberOfLines={1}>{label}</Text>
                <Text style={[styles.scoreValue, { color }]}>{right ?? (percent == null ? '—' : `${Math.round(percent)}%`)}</Text>
            </View>
            {percent != null ? <Meter value={percent} color={color} track={colors.mutedBg} height={7} /> : null}
        </View>
    );
}

export interface StudentProfileActions {
    canManage: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onChangePhoto: () => void;
    uploadingPhoto: boolean;
}

/**
 * The web's student profile (src/components/users/profile/StudentProfileView):
 * a banner with photo and status, then Overview, Academics, and Reports &
 * attendance, laid out for a phone.
 */
export function StudentProfile({ data, username, actions }: { data: StudentProfileResponse; username?: string | null; actions: StudentProfileActions }) {
    const { colors, scheme } = useTheme();
    const styles = useStyles();
    const [tab, setTab] = useState<StudentTab>('overview');
    const { profile: p, academicHistory, reportHistory, attendanceHistory } = data;
    const latestTerm = latestTermWithMarks(academicHistory);
    const latestReport = reportHistory[0] ?? null;
    const latestAttendance = attendanceHistory[0] ?? null;
    const age = ageFrom(p.date_of_birth);
    const active = p.status === 'ACTIVE';
    const name = `${p.first_name} ${p.last_name}`.trim();
    const guardianPhone = p.guardian_phone?.trim() || null;

    return (
        <View>
            {/* Banner, photo and identity */}
            <Reveal index={0}>
                <View style={styles.cardShell}>
                    <LinearGradient
                        colors={scheme === 'dark' ? ['#065f46', '#15803d', '#4d7c0f'] : ['#10b981', '#22c55e', '#84cc16']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.banner}
                    >
                        <View style={styles.bubbleA} />
                        <View style={styles.bubbleB} />
                    </LinearGradient>
                    <View style={styles.identity}>
                        <View style={styles.avatarRing}>
                            <Avatar label={initials(p)} size={84} color="#16a34a" uri={p.avatar_url} />
                            {actions.canManage ? (
                                <Pressable onPress={actions.onChangePhoto} disabled={actions.uploadingPhoto} style={styles.camera} accessibilityRole="button" accessibilityLabel="Change photo">
                                    <Camera size={15} color="#ffffff" />
                                </Pressable>
                            ) : null}
                        </View>
                        <Text style={styles.name} accessibilityRole="header">{name.toUpperCase()}</Text>
                        <Text style={styles.klass}>{[p.grade_stream?.full_name ?? 'No class yet', p.admission_number && `Adm. ${p.admission_number}`].filter(Boolean).join(' · ')}</Text>
                        <View style={styles.chips}>
                            <View style={[styles.chip, { backgroundColor: colors.successBg, borderColor: `${colors.success}55` }]}>
                                <UserRound size={12} color={colors.success} />
                                <Text style={[styles.chipText, { color: colors.success }]}>Student</Text>
                            </View>
                            <View style={[styles.chip, { backgroundColor: active ? colors.infoBg : colors.warningBg, borderColor: active ? `${colors.info}55` : `${colors.warning}55` }]}>
                                <View style={[styles.dot, { backgroundColor: active ? colors.info : colors.warning }]} />
                                <Text style={[styles.chipText, { color: active ? colors.info : colors.warning }]}>{STATUS_LABEL[p.status] ?? humanize(p.status)}</Text>
                            </View>
                        </View>
                        <View style={styles.actions}>
                            {actions.canManage ? (
                                <PressScale onPress={actions.onEdit} style={styles.action} accessibilityLabel="Edit details">
                                    <Pencil size={15} color={colors.foreground} /><Text style={styles.actionText}>Edit details</Text>
                                </PressScale>
                            ) : null}
                            {guardianPhone ? (
                                <PressScale onPress={() => void Linking.openURL(`tel:${guardianPhone}`)} style={styles.action} accessibilityLabel="Call guardian">
                                    <Phone size={15} color={colors.foreground} /><Text style={styles.actionText}>Call guardian</Text>
                                </PressScale>
                            ) : null}
                        </View>
                    </View>
                </View>
            </Reveal>

            <View style={{ marginTop: spacing.lg }}>
                <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
            </View>

            {tab === 'overview' ? (
                <View>
                    <Reveal index={1}>
                        <KpiGrid>
                            <KpiTile title={latestTerm ? `Latest average · ${latestTerm.term_name}` : 'Latest average · no marks yet'} value={latestTerm ? `${latestTerm.average}%` : '—'} icon={TrendingUp} hue="violet" />
                            <KpiTile title={latestReport ? `Position · ${latestReport.term} report` : 'Position · no reports yet'} value={latestReport?.position ?? '—'} icon={Award} hue="amber" />
                            <KpiTile title={latestAttendance ? `Attendance · ${latestAttendance.term}` : 'Attendance · not recorded'} value={latestAttendance?.percentage != null ? `${latestAttendance.percentage}%` : '—'} icon={ClipboardCheck} hue="teal" />
                            <KpiTile title={p.enrolled_subjects.length ? 'Subjects · enrolled' : 'Subjects · with marks this term'} value={p.enrolled_subjects.length || latestTerm?.subjects.length || '—'} icon={BookOpen} hue="emerald" />
                        </KpiGrid>
                    </Reveal>

                    <Reveal index={2} style={{ marginTop: spacing.lg }}>
                        <InsightCard title="Personal details">
                            <InfoItem icon={Hash} label="Admission no." value={p.admission_number} copy />
                            {username ? <InfoItem icon={AtSign} label="Username" value={username} copy /> : null}
                            <InfoItem icon={UserRound} label="Gender" value={p.gender ? humanize(p.gender) : null} />
                            <InfoItem icon={Cake} label="Date of birth" value={p.date_of_birth ? `${formatDate(p.date_of_birth)}${age !== null ? ` · ${age} yrs` : ''}` : null} />
                            <InfoItem icon={CalendarDays} label="Enrolled" value={p.date_enrolled ? formatDate(p.date_enrolled) : null} />
                            <InfoItem icon={Layers} label="Enrolment status" value={STATUS_LABEL[p.status] ?? humanize(p.status)} />
                            <InfoItem icon={Phone} label="Phone" value={p.phone} href={p.phone ? `tel:${p.phone}` : undefined} />
                            <InfoItem icon={Mail} label="Email" value={p.email} href={p.email ? `mailto:${p.email}` : undefined} />
                        </InsightCard>

                        <InsightCard title="Class & curriculum">
                            <InfoItem icon={School} label="Class" value={p.grade_stream?.full_name} />
                            <InfoItem icon={Layers} label="Level" value={p.academic_level?.name} />
                            {p.pathway || p.subject_combination ? (
                                <InfoItem icon={BookMarked} label="Pathway" value={[p.pathway && humanize(p.pathway), p.track && humanize(p.track), p.subject_combination?.name].filter(Boolean).join(' · ')} />
                            ) : null}
                        </InsightCard>

                        <InsightCard title="Parent / guardian">
                            {!p.guardian_name && !guardianPhone && !p.guardian_email ? <Quiet>No guardian details on record.</Quiet> : (
                                <View>
                                    <View style={styles.guardianHead}>
                                        <View style={styles.guardianIcon}><Users size={18} color={colors.primary} /></View>
                                        <Text style={styles.guardianName}>{p.guardian_name || 'Guardian'}</Text>
                                    </View>
                                    <InfoItem icon={Phone} label="Phone" value={guardianPhone} href={guardianPhone ? `tel:${guardianPhone}` : undefined} />
                                    <InfoItem icon={Mail} label="Email" value={p.guardian_email} href={p.guardian_email ? `mailto:${p.guardian_email}` : undefined} />
                                    {guardianPhone ? (
                                        <View style={styles.contactRow}>
                                            <PressScale onPress={() => void Linking.openURL(`tel:${guardianPhone}`)} style={[styles.contact, { backgroundColor: colors.primarySoft }]} accessibilityLabel="Call guardian">
                                                <Phone size={16} color={colors.primary} /><Text style={[styles.contactText, { color: colors.primary }]}>Call</Text>
                                            </PressScale>
                                            <PressScale onPress={() => void Linking.openURL(`sms:${guardianPhone}`)} style={[styles.contact, { backgroundColor: colors.infoBg }]} accessibilityLabel="Text guardian">
                                                <MessageCircle size={16} color={colors.info} /><Text style={[styles.contactText, { color: colors.info }]}>SMS</Text>
                                            </PressScale>
                                            <PressScale onPress={() => void Linking.openURL(`https://wa.me/${whatsappNumber(guardianPhone)}`)} style={[styles.contact, { backgroundColor: colors.successBg }]} accessibilityLabel="WhatsApp guardian">
                                                <MessageCircle size={16} color={colors.success} /><Text style={[styles.contactText, { color: colors.success }]}>WhatsApp</Text>
                                            </PressScale>
                                        </View>
                                    ) : null}
                                </View>
                            )}
                        </InsightCard>

                        {actions.canManage ? (
                            <Pressable onPress={actions.onDelete} style={({ pressed }) => [styles.delete, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                                <Trash2 size={15} color={colors.danger} />
                                <Text style={[styles.deleteText, { color: colors.danger }]}>Delete student</Text>
                            </Pressable>
                        ) : null}
                    </Reveal>
                </View>
            ) : tab === 'academics' ? (
                <Reveal index={1}>
                    <InsightCard title="Term performance" meta="This academic year">
                        {academicHistory.length === 0 ? <Quiet>No terms set up for the current academic year yet.</Quiet> : academicHistory.map((t) => (
                            <ScoreRow key={t.term_id} label={t.term_name} percent={t.subjects.length > 0 ? t.average : null} right={t.subjects.length > 0 ? undefined : 'No marks yet'} />
                        ))}
                    </InsightCard>
                    <InsightCard title={latestTerm ? `Subject marks · ${latestTerm.term_name}` : 'Subject marks'}>
                        {!latestTerm ? <Quiet>No marks have been entered for this student yet.</Quiet> : latestTerm.subjects.map((s, i) => (
                            <ScoreRow key={`${s.subject_name}-${i}`} label={s.subject_name} percent={s.percentage} right={`${Math.round(s.percentage)}%${s.grade_symbol ? ` · ${s.grade_symbol}` : ''}`} />
                        ))}
                    </InsightCard>
                    <InsightCard title="Enrolled subjects">
                        {p.enrolled_subjects.length === 0 ? <Quiet>Takes the standard subjects for the class.</Quiet> : (
                            <View style={styles.subjectChips}>
                                {p.enrolled_subjects.map((s) => {
                                    const core = s.role === 'CORE';
                                    return (
                                        <View key={s.id} style={[styles.subjectChip, core && { borderColor: `${colors.primary}55`, backgroundColor: colors.primarySoft }]}>
                                            <Text style={[styles.subjectChipText, core && { color: colors.primary }]}>{s.name}</Text>
                                            <Text style={[styles.subjectRole, core && { color: colors.primary }]}>{core ? 'CORE' : 'ELECTIVE'}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </InsightCard>
                </Reveal>
            ) : (
                <Reveal index={1}>
                    <InsightCard title="Report cards">
                        {reportHistory.length === 0 ? <Quiet>No report cards have been generated yet.</Quiet> : reportHistory.map((r, i) => (
                            <View key={r.id} style={[styles.report, i > 0 && styles.divider]}>
                                <View style={[styles.reportIcon, { backgroundColor: colors.primarySoft }]}><FileText size={16} color={colors.primary} /></View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.reportTitle} numberOfLines={1}>{r.term} · {r.year}</Text>
                                    <Text style={styles.reportMeta}>Generated {formatDate(r.generated_at)}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    {r.average !== null ? <Text style={[styles.pill, { color: gradeTone(colors, r.average), backgroundColor: colors.mutedBg }]}>{Math.round(r.average)}% avg</Text> : null}
                                    {r.position !== null ? <Text style={[styles.pill, { color: colors.primary, backgroundColor: colors.primarySoft }]}>Position {r.position}</Text> : null}
                                </View>
                            </View>
                        ))}
                    </InsightCard>
                    <InsightCard title="Attendance" meta="From report cards">
                        {attendanceHistory.length === 0 ? <Quiet>No attendance has been recorded on a report card yet.</Quiet> : attendanceHistory.map((a) => (
                            <ScoreRow key={a.id} label={`${a.term} · ${a.year}`} percent={a.percentage} right={`${a.present}/${a.total} days${a.percentage !== null ? ` · ${a.percentage}%` : ''}`} />
                        ))}
                    </InsightCard>
                </Reveal>
            )}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    cardShell: { backgroundColor: colors.card, borderRadius: radius.xxxl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadowFor(colors) },
    banner: { height: 110, overflow: 'hidden' },
    bubbleA: { position: 'absolute', width: 160, height: 160, borderRadius: 80, right: -40, top: -60, backgroundColor: 'rgba(255,255,255,0.18)' },
    bubbleB: { position: 'absolute', width: 110, height: 110, borderRadius: 55, left: '40%', bottom: -70, backgroundColor: 'rgba(255,255,255,0.14)' },
    identity: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, marginTop: -46 },
    avatarRing: { alignSelf: 'flex-start', padding: 4, borderRadius: 50, backgroundColor: colors.card },
    camera: { position: 'absolute', right: 0, bottom: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySolid, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card },
    name: { marginTop: spacing.sm, fontSize: 21, lineHeight: 26, fontFamily: fonts.display, color: colors.foreground, letterSpacing: 0.2 },
    klass: { fontSize: 14, fontFamily: fonts.medium, color: colors.muted, marginTop: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    chipText: { fontSize: 12, fontFamily: fonts.bold },
    dot: { width: 7, height: 7, borderRadius: 4 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    action: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingHorizontal: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
    actionText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
    info: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 9 },
    infoIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
    infoLabel: { fontSize: 11, fontFamily: fonts.semibold, color: colors.muted, letterSpacing: 0.3 },
    infoValue: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground, marginTop: 1 },
    infoEmpty: { color: colors.placeholder, fontFamily: fonts.regular },
    quiet: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.xl, padding: spacing.md },
    scoreRow: { paddingVertical: 8, gap: 6 },
    scoreHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
    scoreLabel: { flex: 1, fontSize: 14, fontFamily: fonts.medium, color: colors.foreground },
    scoreValue: { fontSize: 13, fontFamily: fonts.bold },
    guardianHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 4 },
    guardianIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    guardianName: { fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    contactRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    contact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.xl, paddingHorizontal: spacing.md, flexGrow: 1 },
    contactText: { fontSize: 13, fontFamily: fonts.bold },
    delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, marginBottom: spacing.lg },
    deleteText: { fontSize: 13, fontFamily: fonts.semibold },
    subjectChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    subjectChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated },
    subjectChipText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.foreground },
    subjectRole: { fontSize: 9, fontFamily: fonts.bold, letterSpacing: 0.6, color: colors.muted },
    report: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    divider: { borderTopWidth: 1, borderTopColor: colors.border },
    reportIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    reportTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    reportMeta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    pill: { fontSize: 11, fontFamily: fonts.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
}));
