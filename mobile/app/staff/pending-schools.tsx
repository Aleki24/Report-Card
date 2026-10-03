import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CircleCheck, Hourglass, Mail, MapPin, Phone, User } from 'lucide-react-native';
import type { PendingSchool } from '@shared/pending-schools';
import { webUrl } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { colors, fonts, spacing } from '@/lib/theme';
import { usePendingSchools } from '@/components/platform/PendingSchools';
import { BackLink, Button, ButtonRow, Card, EmptyState, ErrorBanner, IconTile, LoadingView, Screen, ScreenHeader } from '@/components/ui';

/** Decision links are site paths; they open the web's confirmation page. */
const openDecision = (url: string) => void WebBrowser.openBrowserAsync(url.startsWith('/') ? webUrl(url as `/${string}`) : url);

function Detail({ icon: Icon, children, onPress }: { icon: typeof User; children: React.ReactNode; onPress?: () => void }) {
    return (
        <View style={styles.detail}>
            <Icon size={14} color={colors.muted} />
            <Text style={[styles.detailText, onPress && styles.link]} onPress={onPress} numberOfLines={2}>{children}</Text>
        </View>
    );
}

function SchoolCard({ school }: { school: PendingSchool }) {
    const r = school.requester;
    const phone = school.phone || r?.phone;
    return (
        <Card style={{ marginBottom: spacing.md }}>
            <View style={styles.head}>
                <IconTile icon={Hourglass} color={colors.warning} background={colors.warningBg} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{school.name}</Text>
                    <Text style={styles.detailText}>Requested {school.requestedAt ? formatDate(new Date(school.requestedAt)) : 'recently'}</Text>
                </View>
            </View>
            <View style={styles.details}>
                {r ? <Detail icon={User}>{r.name}{r.email ? ` · ${r.email}` : ''}</Detail> : null}
                {phone ? <Detail icon={Phone} onPress={() => void Linking.openURL(`tel:${phone}`)}>{phone}</Detail> : null}
                {school.email ? <Detail icon={Mail} onPress={() => void Linking.openURL(`mailto:${school.email}`)}>{school.email}</Detail> : null}
                {school.address ? <Detail icon={MapPin}>{school.address}</Detail> : null}
            </View>
            {/* Each link opens a confirmation page; nothing happens until it is confirmed there. */}
            <ButtonRow>
                <Button variant="secondary" label="Reject" onPress={() => openDecision(school.rejectUrl)} />
                <Button label="Approve" onPress={() => openDecision(school.approveUrl)} />
            </ButtonRow>
        </Card>
    );
}

/** The web's /dashboard/pending-schools: the platform owner's queue of new schools. */
export default function PendingSchoolsScreen() {
    const { data, loading, error, refresh, refreshing } = usePendingSchools(true);
    if (loading) return <LoadingView />;
    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <BackLink />
            <ScreenHeader title="School requests" description="New schools stay locked until you approve them. You’re also told by email, SMS and WhatsApp when one asks." />
            {error ? (
                <ErrorBanner message={error} onRetry={refresh} />
            ) : (data ?? []).length === 0 ? (
                <Card>
                    <View style={{ alignItems: 'center' }}><CircleCheck size={28} color={colors.success} /></View>
                    <EmptyState title="All caught up" description="No schools are waiting for approval." />
                </Card>
            ) : (
                (data ?? []).map((s) => <SchoolCard key={s.id} school={s} />)
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    name: { fontSize: 16, fontFamily: fonts.bold, color: colors.foreground },
    details: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 },
    detail: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    detailText: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.muted },
    link: { color: colors.primary },
});
