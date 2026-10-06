import React, { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeStyles, radius, spacing } from '@/lib/theme';

function Block({ height, width = '100%', round = radius.xxl }: { height: number; width?: DimensionValue; round?: number }) {
    const styles = useStyles();
    return <View style={[styles.block, { height, width, borderRadius: round }]} />;
}

/** The dashboard's shape while it loads, breathing gently: the page arrives where it is expected. */
export function DashboardSkeleton() {
    const styles = useStyles();
    const opacity = useSharedValue(0.55);
    useEffect(() => { opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [opacity]);
    const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return (
        <SafeAreaView style={styles.safe} edges={['top']} accessibilityLabel="Loading your dashboard">
            <Animated.View style={[styles.content, pulse]}>
                <Block height={190} round={radius.xxxl} />
                <View style={styles.gap} />
                <Block height={18} width="45%" round={6} />
                <View style={styles.gapSm} />
                <Block height={92} />
                <View style={styles.gap} />
                <View style={styles.row}>
                    <View style={styles.half}><Block height={112} /></View>
                    <View style={styles.half}><Block height={112} /></View>
                </View>
                <View style={styles.row}>
                    <View style={styles.half}><Block height={112} /></View>
                    <View style={styles.half}><Block height={112} /></View>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((colors) => ({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
    block: { backgroundColor: colors.elevated },
    gap: { height: spacing.xl },
    gapSm: { height: spacing.md },
    row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    half: { flex: 1 },
}));
