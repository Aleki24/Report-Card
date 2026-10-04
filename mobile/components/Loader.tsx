import React, { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { fonts, makeStyles, spacing } from '@/lib/theme';

/** The beadwork colours of the home hero: red, green, amber, blue, violet. */
const BEADS = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6'] as const;

function Bead({ color, index, size }: { color: string; index: number; size: number }) {
    const lift = useSharedValue(0);
    useEffect(() => {
        lift.value = withDelay(
            index * 110,
            withRepeat(withSequence(
                withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
                withTiming(0, { duration: 260 }),
            ), -1),
        );
    }, [index, lift]);
    const style = useAnimatedStyle(() => ({
        transform: [{ translateY: -lift.value * size * 0.9 }, { scale: 1 + lift.value * 0.15 }],
        opacity: 0.55 + lift.value * 0.45,
    }));
    return <Animated.View style={[{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: color }, style]} />;
}

/** A row of beads rising in a wave: the app's one loading mark. */
export function Beads({ size = 10, label = 'Loading' }: { size?: number; label?: string }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: size * 0.6, height: size * 2.2 }} accessibilityRole="progressbar" accessibilityLabel={label}>
            {BEADS.map((c, i) => <Bead key={c} color={c} index={i} size={size} />)}
        </View>
    );
}

/** Content loading inside a screen or card. */
export function InlineLoader({ message }: { message?: string }) {
    const styles = useStyles();
    return (
        <View style={styles.inline}>
            <Beads />
            {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
    );
}

/** The whole app getting ready: the logo breathing over the beads. */
export function BrandLoader({ message = 'Getting your school ready…' }: { message?: string }) {
    const styles = useStyles();
    const breathe = useSharedValue(0);
    useEffect(() => {
        breathe.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    }, [breathe]);
    const logo = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.05 }] }));
    return (
        <View style={styles.full}>
            <Animated.View style={[styles.logoWrap, logo]}>
                <Image source={require('@/assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            </Animated.View>
            <Text style={styles.wordmark}>Skulbase</Text>
            <View style={{ marginTop: spacing.xl }}><Beads size={11} /></View>
            <Text style={styles.message}>{message}</Text>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    inline: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 1.5, gap: spacing.md, flexGrow: 1 },
    full: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.xl },
    logoWrap: { width: 84, height: 84, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
    logo: { width: '100%', height: '100%' },
    wordmark: { marginTop: spacing.md, fontSize: 22, fontFamily: fonts.display, color: colors.foreground, letterSpacing: -0.5 },
    message: { marginTop: spacing.md, fontSize: 13, fontFamily: fonts.medium, color: colors.muted, textAlign: 'center' },
}));
