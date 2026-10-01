import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { dateTime } from '@shared/ops/format';
import type { LiveTrip } from '@shared/transport/types';
import { Card, EmptyState } from '@/components/ui';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { colors, spacing } from '@/lib/theme';
import { MapFrame, type MapFrameHandle } from './MapFrame';

const POLL_MS = 10_000;

/**
 * Every running bus on a map, refreshed every ten seconds, with its recent
 * path, route stops and alerts (speeding, silent tracker) — the web's live map.
 */
export function LiveMap() {
    const api = useApi();
    const map = useRef<MapFrameHandle>(null);
    const [ready, setReady] = useState(false);
    const [trips, setTrips] = useState<LiveTrip[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [updated, setUpdated] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        const load = () => opsGet<LiveTrip[]>(api, '/api/transport/live')
            .then((t) => { if (live) { setTrips(t); setError(null); setUpdated(new Date().toISOString()); } })
            .catch((err: unknown) => { if (live) setError(errorMessage(err, 'Could not load the buses')); });
        void load();
        const timer = setInterval(load, POLL_MS);
        return () => { live = false; clearInterval(timer); };
    }, [api]);

    useEffect(() => {
        if (ready) map.current?.send({ type: 'render', trips });
    }, [ready, trips]);

    const onReady = useCallback(() => setReady(true), []);

    const focus = (t: LiveTrip) => {
        if (t.last_lat != null && t.last_lng != null) map.current?.send({ type: 'focus', lat: t.last_lat, lng: t.last_lng });
    };

    return (
        <View>
            <MapFrame ref={map} onReady={onReady} />
            <Text style={[styles.status, error ? { color: colors.danger } : null]}>
                {error ?? (updated ? `Updated ${dateTime(updated)} · refreshes every 10 s` : 'Loading…')}
            </Text>
            {trips.length === 0 && !error ? <EmptyState title="No buses on the road right now." /> : null}
            {trips.map((t) => (
                <Pressable key={t.id} onPress={() => focus(t)} accessibilityRole="button" accessibilityHint="Shows this bus on the map">
                    <Card style={[styles.card, t.alerts.length > 0 && { borderColor: colors.danger }]}>
                        <Text style={styles.title}>🚌 {t.vehicle?.registration} <Text style={styles.muted}>· {t.route?.name ?? 'No route'}</Text></Text>
                        <Text style={styles.muted}>{t.driver?.full_name ?? 'No driver'} · {Math.round(Number(t.last_speed_kmh ?? 0))} km/h · seen {dateTime(t.last_seen_at)}</Text>
                        {t.driver?.phone ? (
                            <Text style={styles.link} onPress={() => void Linking.openURL(`tel:${t.driver?.phone}`)}>📞 {t.driver.phone}</Text>
                        ) : null}
                        {t.alerts.map((a) => <Text key={a} style={styles.alert}>⚠︎ {a}</Text>)}
                    </Card>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    status: { fontSize: 12, color: colors.muted, marginBottom: spacing.sm },
    card: { marginBottom: spacing.sm, padding: spacing.md, gap: 2 },
    title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    muted: { fontSize: 12, color: colors.muted, fontWeight: '400' },
    link: { fontSize: 12, color: colors.primary, fontWeight: '700', marginTop: 2 },
    alert: { fontSize: 12, color: colors.danger, fontWeight: '700' },
});
