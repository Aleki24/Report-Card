import React from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Rect } from 'react-native-svg';
import { useRouter, type Href } from 'expo-router';
import { CalendarRange, Search, type LucideIcon } from 'lucide-react-native';
import { useOptionalCurrentUser } from '@/lib/UserContext';
import { roleLabel } from '@/lib/roles';
import type { TermSummary } from '@shared/dashboard';
import { formatLongToday, getGreeting, getSwahiliGreeting } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { CountUp, PressScale } from './kit';

/** Red, white, green, amber and blue: a strip of Maasai-style beadwork along the hero's foot. */
const BEADS = ['#ef4444', '#ffffff', '#22c55e', '#f59e0b', '#38bdf8', '#ffffff'] as const;

function Beadwork() {
    const bead = 7;
    const gap = 3;
    const count = 60;
    return (
        <Svg height={bead} width={count * (bead + gap)} style={{ opacity: 0.55 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: count }, (_, i) => (
                <Rect key={i} x={i * (bead + gap)} y={0} width={bead} height={bead} rx={2} fill={BEADS[i % BEADS.length]} />
            ))}
        </Svg>
    );
}

const dayMonth = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

/** "Term 3 · 2026 · Week 5 of 12 · 47 days left", the break, or a nudge to set dates. */
function TermLine({ term, canEditTerms }: { term: TermSummary | null; canEditTerms: boolean }) {
    const styles = useStyles();
    const router = useRouter();
    if (!term || term.kind === 'none') {
        return canEditTerms ? (
            <Pressable onPress={() => router.push('/staff/settings?tab=calendar')} accessibilityRole="link">
                <Text style={styles.termText}>No term dates set. <Text style={styles.termLink}>Add your terms ›</Text></Text>
            </Pressable>
        ) : <Text style={styles.termText}>Your school hasn’t set its term dates yet.</Text>;
    }
    if (term.kind === 'break') {
        return (
            <View style={styles.termRow}>
                <View style={styles.pill}><Text style={styles.pillText}>School break</Text></View>
                <Text style={styles.termText}>{term.nextName && term.nextStart ? `${term.nextName} opens ${dayMonth(term.nextStart)}` : 'No upcoming term dates set'}</Text>
            </View>
        );
    }
    const progress = Math.max(0, Math.min(100, Math.round((term.week / term.weeks) * 100)));
    return (
        <View>
            <View style={styles.termRow}>
                <View style={styles.pill}>
                    <CalendarRange size={12} color="#ffffff" />
                    <Text style={styles.pillText}>{[term.name, term.year].filter(Boolean).join(' · ')}</Text>
                </View>
                <Text style={styles.termText}>Week {term.week} of {term.weeks} · {term.daysLeft === 0 ? 'ends today' : `${term.daysLeft} day${term.daysLeft === 1 ? '' : 's'} left`}</Text>
            </View>
            <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }} accessibilityLabel="How far through the term">
                <View style={[styles.fill, { width: `${progress}%` }]} />
            </View>
        </View>
    );
}

export interface HeroAction { label: string; icon: LucideIcon; href: Href; primary?: boolean; onPress?: () => void }

/** White primary and glassy secondary buttons on the hero. */
export function HeroActions({ actions }: { actions: readonly HeroAction[] }) {
    const styles = useStyles();
    const router = useRouter();
    return (
        <View style={styles.actions}>
            {actions.map(({ label, icon: Icon, href, primary, onPress }) => (
                <PressScale key={label} onPress={onPress ?? (() => router.push(href))} style={[styles.action, primary ? styles.actionPrimary : styles.actionGhost]} accessibilityRole="link" accessibilityLabel={label}>
                    <Icon size={16} color={primary ? '#1e3a8a' : '#ffffff'} />
                    <Text style={[styles.actionText, { color: primary ? '#1e3a8a' : '#ffffff' }]} numberOfLines={1}>{label}</Text>
                </PressScale>
            ))}
        </View>
    );
}

/** A glassy chip on the hero: the next exam, homework due. */
export function HeroChip({ icon: Icon, label, warm }: { icon: LucideIcon; label: string; warm?: boolean }) {
    const styles = useStyles();
    return (
        <View style={[styles.chip, warm && styles.chipWarm]}>
            <Icon size={13} color="#ffffff" />
            <Text style={styles.chipText}>{label}</Text>
        </View>
    );
}

const initialsOf = (first?: string | null, last?: string | null) =>
    `${(first ?? '').trim().charAt(0)}${(last ?? '').trim().charAt(0)}`.toUpperCase() || '·';

/** Where each role's own account page lives. */
function profileHref(role: string | null | undefined): Href {
    if (role === 'STUDENT') return '/student/profile';
    if (role === 'PARENT') return '/parent/profile';
    return '/staff/profile';
}

/**
 * Who is signed in, above the hero on the page itself: their photo
 * (initials until they add one), their role and the school's crest.
 */
function ProfileBar() {
    const styles = useStyles();
    const router = useRouter();
    const user = useOptionalCurrentUser();
    if (!user?.profile) return null;
    const { profile, avatarUrl, schoolName, schoolLogoUrl, role } = user;
    const title = profile.job_title?.trim() || roleLabel(role);
    return (
        <View style={styles.identity}>
            <PressScale onPress={() => router.push(profileHref(role))} style={styles.avatarRing} accessibilityRole="link" accessibilityLabel="Your profile">
                {avatarUrl
                    ? <Image source={{ uri: avatarUrl }} style={styles.avatar} accessibilityIgnoresInvertColors />
                    : <View style={[styles.avatar, styles.avatarBlank]}><Text style={styles.avatarText}>{initialsOf(profile.first_name, profile.last_name)}</Text></View>}
                <View style={styles.onlineDot} />
            </PressScale>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.identityName} numberOfLines={1}>{[profile.first_name, profile.last_name].filter(Boolean).join(' ')}</Text>
                <Text style={styles.identityRole} numberOfLines={1}>{[title, schoolName].filter(Boolean).join(' · ')}</Text>
            </View>
            {schoolLogoUrl ? (
                <View style={styles.crest}><Image source={{ uri: schoolLogoUrl }} style={styles.crestImg} resizeMode="contain" accessibilityLabel={schoolName ?? 'School logo'} /></View>
            ) : null}
        </View>
    );
}

/** A figure on the hero's frosted glass: learners, present today, pass rate. */
export interface HeroStat { label: string; value: string | number; icon: LucideIcon; href?: Href }

function HeroStats({ stats }: { stats: readonly HeroStat[] }) {
    const styles = useStyles();
    const router = useRouter();
    return (
        <View style={styles.stats}>
            {stats.map(({ label, value, icon: Icon, href }) => {
                const body = (
                    <>
                        <View style={styles.statIcon}><Icon size={14} color="#ffffff" /></View>
                        <CountUp value={value} style={styles.statValue} />
                        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
                    </>
                );
                return (
                    <View key={label} style={styles.statCell}>
                        {href
                            ? <PressScale onPress={() => router.push(href)} style={styles.stat} accessibilityRole="link" accessibilityLabel={`${label}: ${value}`}>{body}</PressScale>
                            : <View style={styles.stat}>{body}</View>}
                    </View>
                );
            })}
        </View>
    );
}

/**
 * The gradient card every home opens with: who is signed in, soft rings, a
 * greeting in Kiswahili and English, and beadwork along its foot.
 */
export function HeroFrame({ name, eyebrow, gradient, aside, children }: {
    name: string;
    eyebrow?: string;
    gradient?: readonly [string, string, ...string[]];
    /** Beside the greeting, e.g. the learner's score ring. */
    aside?: React.ReactNode;
    children?: React.ReactNode;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <>
        <ProfileBar />
        <LinearGradient colors={gradient ?? colors.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Svg style={styles.rings} width={220} height={220} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Circle cx={160} cy={60} r={90} fill="rgba(255,255,255,0.07)" />
                <Circle cx={190} cy={20} r={50} fill="rgba(255,255,255,0.06)" />
            </Svg>
            <View style={styles.top}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.eyebrow}>{eyebrow ?? `${getSwahiliGreeting()} · ${formatLongToday()}`}</Text>
                    <Text style={styles.greeting} accessibilityRole="header">{getGreeting()}, {name || 'there'}</Text>
                </View>
                {aside}
            </View>
            {children}
            <View style={styles.beads}><Beadwork /></View>
        </LinearGradient>
        </>
    );
}

/**
 * The top of every staff home: where the school is in its term, and the
 * next thing to do.
 */
export function DashboardHero({ name, term, canEditTerms, eyebrow, summary, actions, search, stats }: {
    name: string;
    term: TermSummary | null;
    canEditTerms: boolean;
    /** Replaces the date line, e.g. a job title. */
    eyebrow?: string;
    /** A line under the term, such as how much marking is left. */
    summary?: string | null;
    actions?: readonly HeroAction[];
    /** Find a learner from the home screen (admins). */
    search?: boolean;
    /** Up to three headline figures on frosted tiles. */
    stats?: readonly HeroStat[];
}) {
    const styles = useStyles();
    const router = useRouter();
    const [query, setQuery] = React.useState('');
    return (
        <HeroFrame name={name} eyebrow={eyebrow}>
            <View style={{ marginTop: spacing.sm }}>
                <TermLine term={term} canEditTerms={canEditTerms} />
            </View>
            {summary ? <Text style={styles.summary}>{summary}</Text> : null}
            {stats?.length ? <HeroStats stats={stats} /> : null}
            {search ? (
                <View style={styles.search}>
                    <Search size={16} color="rgba(255,255,255,0.8)" />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Find a learner by name or adm. no."
                        placeholderTextColor="rgba(255,255,255,0.65)"
                        style={styles.searchInput}
                        returnKeyType="search"
                        onSubmitEditing={() => { if (query.trim()) router.push(`/staff/people?search=${encodeURIComponent(query.trim())}`); }}
                        accessibilityLabel="Find a learner"
                    />
                </View>
            ) : null}
            {actions?.length ? <HeroActions actions={actions} /> : null}
        </HeroFrame>
    );
}

const useStyles = makeStyles((colors) => ({
    hero: { borderRadius: radius.xxxl, padding: spacing.lg, paddingBottom: spacing.lg + 10, overflow: 'hidden', marginBottom: spacing.sm },
    rings: { position: 'absolute', top: -20, right: -40 },
    identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
    avatarRing: { padding: 2, borderRadius: 26, borderWidth: 2, borderColor: colors.primary },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarBlank: { backgroundColor: colors.primarySolid, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontFamily: fonts.display, color: '#ffffff' },
    onlineDot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.background },
    identityName: { fontSize: 16, fontFamily: fonts.display, color: colors.foreground, letterSpacing: -0.2 },
    identityRole: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted, marginTop: 1 },
    crest: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 4, alignItems: 'center', justifyContent: 'center' },
    crestImg: { width: '100%', height: '100%' },
    stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    statCell: { flex: 1, minWidth: 0 },
    stat: { padding: spacing.sm + 2, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    statIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    statValue: { fontSize: 20, lineHeight: 24, fontFamily: fonts.display, color: '#ffffff', letterSpacing: -0.4 },
    statLabel: { fontSize: 11, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
    top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
    chipWarm: { backgroundColor: 'rgba(251,191,36,0.28)', borderColor: 'rgba(253,230,138,0.45)' },
    chipText: { fontSize: 12, fontFamily: fonts.bold, color: '#ffffff' },
    eyebrow: { fontSize: 12, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.8)' },
    greeting: { fontSize: 21, lineHeight: 27, fontFamily: fonts.display, color: '#ffffff', letterSpacing: -0.4, marginTop: 2 },
    termRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
    pillText: { fontSize: 12, fontFamily: fonts.bold, color: '#ffffff' },
    termText: { fontSize: 13, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.88)' },
    termLink: { fontFamily: fonts.bold, color: '#ffffff', textDecorationLine: 'underline' },
    track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', marginTop: 10, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3, backgroundColor: '#ffffff' },
    summary: { fontSize: 13, lineHeight: 19, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.9)', marginTop: spacing.md },
    search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.md, height: 44, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
    searchInput: { flex: 1, height: '100%', fontSize: 14, fontFamily: fonts.medium, color: '#ffffff' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    action: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 42, paddingHorizontal: spacing.lg, borderRadius: radius.xl, maxWidth: '100%' },
    actionPrimary: { backgroundColor: '#ffffff' },
    actionGhost: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
    actionText: { fontSize: 14, fontFamily: fonts.bold, flexShrink: 1 },
    beads: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, overflow: 'hidden' },
}));
