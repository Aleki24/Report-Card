import React, { createContext, useContext, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { humanize } from '@shared/ops/format';
import type { PillTone } from '@shared/ops/tones';
import { Button } from '@/components/ui';
import { useApi } from '@/lib/api';
import { useAction } from '@/lib/ops';
import { spacing, fonts, useTheme, type Palette } from '@/lib/theme';

function pillColors(colors: Palette, tone: PillTone): { bg: string; fg: string } {
    switch (tone) {
        case 'info': return { bg: colors.infoBg, fg: colors.info };
        case 'good': return { bg: colors.successBg, fg: colors.success };
        case 'warn': return { bg: colors.warningBg, fg: colors.warning };
        case 'bad': return { bg: colors.dangerBg, fg: colors.danger };
        case 'violet': return colors.scheme === 'dark' ? { bg: '#2a1f4d', fg: '#c4b5fd' } : { bg: '#ede9fe', fg: '#6d28d9' };
        default: return { bg: colors.mutedBg, fg: colors.muted };
    }
}

/** A status label coloured by what it means, from the same tone maps as the web. */
export function StatusPill<S extends string>({ status, tones, label }: { status: S; tones: Readonly<Record<S, PillTone>>; label?: string }) {
    const { colors } = useTheme();
    const t = pillColors(colors, tones[status] ?? 'neutral');
    return (
        <View style={[styles.pill, { backgroundColor: t.bg }]}>
            <Text style={[styles.pillText, { color: t.fg }]} numberOfLines={1}>{label ?? humanize(status)}</Text>
        </View>
    );
}

/** A small coloured count or label (a tile's tone without the tile). */
export function TonePill({ tone, label }: { tone: PillTone; label: string }) {
    const { colors } = useTheme();
    const t = pillColors(colors, tone);
    return (
        <View style={[styles.pill, { backgroundColor: t.bg }]}>
            <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
        </View>
    );
}

export const toneColor = (colors: Palette, tone: PillTone) => pillColors(colors, tone).fg;

/** A row button that calls an API action, reports the outcome and refreshes. */
export function ActionButton({
    path,
    body,
    method = 'POST',
    success,
    onDone,
    variant = 'primary',
    label,
}: {
    path: string;
    body?: unknown;
    method?: 'POST' | 'PATCH';
    success: string;
    onDone?: () => void | Promise<void>;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    label: string;
}) {
    const api = useApi();
    const { busy, run } = useAction();
    return (
        <Button
            size="sm"
            variant={variant}
            label={label}
            loading={busy}
            onPress={() => void run(() => (method === 'PATCH' ? api.patch(path, body) : api.post(path, body)), success, onDone)}
        />
    );
}

/**
 * Pull-to-refresh on a module screen reaches every list inside it: the
 * screen bumps the signal and each list reloads.
 */
const RefreshSignal = createContext(0);
export const RefreshSignalProvider = RefreshSignal.Provider;

export function useRefreshSignal(reload: () => unknown) {
    const signal = useContext(RefreshSignal);
    const first = useRef(true);
    const latest = useRef(reload);
    latest.current = reload;
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        void latest.current();
    }, [signal]);
}

const styles = StyleSheet.create({
    pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
    pillText: { fontSize: 11, fontFamily: fonts.bold },
});
