import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
    Bus, Briefcase, GraduationCap, HeartPulse, LifeBuoy, Mail, Package, ShieldCheck, Users, UserRound, Wallet, School,
    type LucideIcon,
} from 'lucide-react-native';
import { DUTY_MANUAL_SLUGS, MANUALS, ROLE_MANUAL_SLUGS, manualsFor, type ManualSlug } from '@shared/manual';
import { useOptionalCurrentUser } from '@/lib/UserContext';
import { colors, fonts, spacing } from '@/lib/theme';
import { BackLink, IconTile, ListCard, ListRow, Screen, ScreenHeader, SectionLabel } from '@/components/ui';

/** One icon per guide, picked to match what the guide covers. */
const GUIDE_ICONS: Record<ManualSlug, LucideIcon> = {
    admin: School,
    'class-teacher': Users,
    'subject-teacher': Briefcase,
    staff: UserRound,
    student: GraduationCap,
    parent: Users,
    leadership: ShieldCheck,
    finance: Wallet,
    welfare: LifeBuoy,
    health: HeartPulse,
    transport: Bus,
    operations: Package,
};

function GuideList({ slugs }: { slugs: readonly ManualSlug[] }) {
    const router = useRouter();
    return (
        <ListCard>
            {slugs.map((slug) => (
                <ListRow
                    key={slug}
                    title={MANUALS[slug].title}
                    subtitle={MANUALS[slug].audience}
                    left={<IconTile icon={GUIDE_ICONS[slug]} />}
                    onPress={() => router.push({ pathname: '/help/[slug]', params: { slug } })}
                />
            ))}
        </ListCard>
    );
}

/**
 * The web's /help (and /dashboard/help, /student/help, /parent/help): every
 * user guide, with the reader's own first when signed in. Open signed out too.
 */
export default function HelpScreen() {
    const router = useRouter();
    const user = useOptionalCurrentUser();
    const mine = user?.role ? manualsFor(user.role, user.access.duties) : [];

    return (
        <Screen>
            <BackLink />
            <ScreenHeader title="Help & guides" description="Step-by-step guides with pictures of every screen. Read one here, or download the PDF to keep, print or share." />

            {mine.length > 0 ? (
                <>
                    <SectionLabel>Your guides</SectionLabel>
                    <GuideList slugs={mine} />
                </>
            ) : null}

            <SectionLabel>Guides by account</SectionLabel>
            <Text style={styles.note}>Start with the guide for the kind of account you have.</Text>
            <GuideList slugs={ROLE_MANUAL_SLUGS} />

            <SectionLabel>Guides for duties</SectionLabel>
            <Text style={styles.note}>If your school has given you a duty, such as bursar, matron or DOS, read its guide as well.</Text>
            <GuideList slugs={DUTY_MANUAL_SLUGS} />

            <SectionLabel>Still stuck?</SectionLabel>
            <ListCard>
                <ListRow
                    title="Contact Skulbase support"
                    subtitle="Send us a message and we’ll get back to you by email."
                    left={<IconTile icon={Mail} />}
                    onPress={() => router.push('/help/contact')}
                />
            </ListCard>
            <View style={{ height: spacing.lg }} />
        </Screen>
    );
}

const styles = StyleSheet.create({
    note: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.sm },
});
