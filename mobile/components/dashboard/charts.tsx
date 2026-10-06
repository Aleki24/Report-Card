import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { fonts, makeStyles, useTheme } from '@/lib/theme';

/** A value out of 100 as a ring, with the figure in its centre and a short caption under it. */
export function Ring({ value, size = 96, stroke, color, track, textColor, caption, decimals = 0 }: {
    value: number;
    size?: number;
    stroke?: number;
    color: string;
    track: string;
    textColor: string;
    caption?: string;
    decimals?: number;
}) {
    const width = stroke ?? Math.max(6, Math.round(size / 10.5));
    const r = (size - width) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, value));
    const shown = `${value.toFixed(decimals)}%`;
    const big = Math.round(size * (caption ? 0.22 : 0.25));
    return (
        <Svg width={size} height={size} accessibilityRole="image" accessibilityLabel={`${shown}${caption ? ` ${caption.toLowerCase()}` : ''}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={width} />
            <Circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round"
                strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - pct / 100)}
                rotation={-90} origin={`${size / 2}, ${size / 2}`}
            />
            <SvgText x={size / 2} y={size / 2 + big * 0.36 - (caption ? size * 0.05 : 0)} textAnchor="middle" fontSize={big} fontFamily={fonts.display} fill={textColor}>{shown}</SvgText>
            {caption ? (
                <SvgText x={size / 2} y={size / 2 + big * 0.36 + size * 0.11} textAnchor="middle" fontSize={Math.max(7, size * 0.085)} fontFamily={fonts.bold} fill={textColor} fillOpacity={0.7} letterSpacing={1}>{caption.toUpperCase()}</SvgText>
            ) : null}
        </Svg>
    );
}

/** The learner's average as a ring, for the hero (white on the gradient). */
export function ScoreRing({ value, size = 96 }: { value: number; size?: number }) {
    return <Ring value={value} size={size} stroke={9} color="#ffffff" track="rgba(255,255,255,0.22)" textColor="#ffffff" caption="Average" />;
}

export interface Column { key: string; label: string; value: number; color: string; /** Shown when the column is tapped. */ detail?: string }

function Bar({ value, color, height, active }: { value: number; color: string; height: number; active: boolean }) {
    const h = useSharedValue(0);
    useEffect(() => { h.value = withTiming(Math.max(3, (Math.max(0, Math.min(100, value)) / 100) * height), { duration: 650, easing: Easing.out(Easing.cubic) }); }, [value, height, h]);
    const style = useAnimatedStyle(() => ({ height: h.value }));
    return <Animated.View style={[{ width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: color, opacity: active ? 1 : 0.85 }, style]} />;
}

/**
 * One column per item, tallest wins the eye; tap a column for its detail.
 * Scrolls sideways when there are more columns than fit.
 */
export function ColumnChart({ columns, height = 150, guide, guideLabel }: {
    columns: readonly Column[];
    height?: number;
    /** A dashed line across, e.g. the pass mark. */
    guide?: number;
    guideLabel?: string;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    const [selected, setSelected] = useState<string | null>(null);
    const [width, setWidth] = useState(0);
    const colWidth = 44;
    const contentWidth = Math.max(width, columns.length * colWidth);
    const picked = columns.find((c) => c.key === selected) ?? null;
    const guideY = guide != null ? height * (1 - guide / 100) : null;
    return (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            <View style={styles.detail}>
                {picked ? (
                    <>
                        <View style={[styles.detailDot, { backgroundColor: picked.color }]} />
                        <Text style={styles.detailText} numberOfLines={2}><Text style={styles.detailStrong}>{picked.label}</Text>{picked.detail ? `  ·  ${picked.detail}` : ''}</Text>
                    </>
                ) : <Text style={styles.detailHint}>Tap a column for details</Text>}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width: contentWidth }}>
                <View style={{ width: contentWidth }}>
                    <View style={{ height: height + 18, justifyContent: 'flex-end' }}>
                        {[25, 50, 75, 100].map((g) => (
                            <View key={g} style={[styles.grid, { bottom: (g / 100) * height }]} />
                        ))}
                        {guideY != null ? (
                            <View style={[styles.guide, { top: guideY + 18, borderColor: colors.warning }]}>
                                {guideLabel ? <Text style={[styles.guideLabel, { color: colors.warning }]}>{guideLabel}</Text> : null}
                            </View>
                        ) : null}
                        <View style={styles.columns}>
                            {columns.map((c) => {
                                const active = c.key === selected;
                                return (
                                    <Pressable key={c.key} onPress={() => setSelected(active ? null : c.key)} style={styles.col} accessibilityRole="button" accessibilityLabel={`${c.label}: ${Math.round(c.value)}%`}>
                                        <View style={[styles.colTrack, { height: height + 18 }]}>
                                            <Text style={[styles.colValue, active && { color: c.color }]}>{Math.round(c.value)}</Text>
                                            <Bar value={c.value} color={c.color} height={height} active={active || !selected} />
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                    <View style={styles.colLabels}>
                        {columns.map((c) => (
                            <Text key={c.key} style={[styles.colLabel, c.key === selected && { color: colors.foreground, fontFamily: fonts.bold }]} numberOfLines={2}>{shortLabel(c.label)}</Text>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

/** "Religious Education" → "Rel. Edu."; short names stay as they are. */
export function shortLabel(label: string): string {
    const words = label.replace(/\(.*?\)/g, '').split(/[\s&/-]+/).filter((w) => w && !/^(and|of|the)$/i.test(w));
    if (label.length <= 9) return label;
    if (words.length === 1) return `${words[0].slice(0, 7)}.`;
    return words.slice(0, 2).map((w) => (w.length > 4 ? `${w.slice(0, 4)}.` : w)).join(' ');
}

export interface TrendPoint { label: string; value: number }

/**
 * Average per term as a line over a soft fill, with the pass mark dashed
 * across: is the learner above the line, and which way are they heading?
 */
export function TrendChart({ points, passMark, height = 170 }: { points: readonly TrendPoint[]; passMark: number; height?: number }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const [width, setWidth] = useState(0);
    const padX = 18;
    const top = 18;
    const bottom = 10;
    const plotH = height - top - bottom;
    const y = (v: number) => top + plotH * (1 - Math.max(0, Math.min(100, v)) / 100);
    const x = (i: number) => (points.length === 1 ? width / 2 : padX + ((width - padX * 2) * i) / (points.length - 1));
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = points.length > 1 ? `${line} L${x(points.length - 1).toFixed(1)},${height - bottom} L${x(0).toFixed(1)},${height - bottom} Z` : '';
    return (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel={`Averages by term: ${points.map((p) => `${p.label} ${p.value}%`).join(', ')}`}>
            {width > 0 ? (
                <Svg width={width} height={height}>
                    <Defs>
                        <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.28} />
                            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
                        </LinearGradient>
                    </Defs>
                    {[25, 50, 75].map((g) => <Line key={g} x1={0} x2={width} y1={y(g)} y2={y(g)} stroke={colors.border} strokeWidth={1} />)}
                    <Line x1={0} x2={width} y1={y(passMark)} y2={y(passMark)} stroke={colors.warning} strokeWidth={1.5} strokeDasharray="5 4" />
                    <SvgText x={width - 2} y={y(passMark) - 5} textAnchor="end" fontSize={10} fontFamily={fonts.semibold} fill={colors.warning}>{`Pass ${passMark}%`}</SvgText>
                    {area ? <Path d={area} fill="url(#trendFill)" /> : null}
                    <Path d={line} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                    {points.map((p, i) => (
                        <React.Fragment key={`${p.label}-${i}`}>
                            <Circle cx={x(i)} cy={y(p.value)} r={5} fill={colors.card} stroke={colors.primary} strokeWidth={2.5} />
                            <SvgText x={x(i)} y={y(p.value) - 10} textAnchor="middle" fontSize={11} fontFamily={fonts.bold} fill={colors.foreground}>{`${Math.round(p.value)}%`}</SvgText>
                        </React.Fragment>
                    ))}
                </Svg>
            ) : <View style={{ height }} />}
            <View style={styles.labels}>
                {points.map((p, i) => <Text key={`${p.label}-${i}`} style={styles.label} numberOfLines={2}>{p.label}</Text>)}
            </View>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    detail: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.elevated, marginBottom: 8 },
    detailDot: { width: 10, height: 10, borderRadius: 3 },
    detailText: { flex: 1, fontSize: 12, fontFamily: fonts.medium, color: colors.muted },
    detailStrong: { fontFamily: fonts.bold, color: colors.foreground },
    detailHint: { fontSize: 12, fontFamily: fonts.medium, color: colors.placeholder },
    grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border, opacity: 0.7 },
    guide: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed' },
    guideLabel: { position: 'absolute', right: 2, top: -16, fontSize: 10, fontFamily: fonts.bold },
    columns: { flexDirection: 'row', alignItems: 'flex-end' },
    col: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
    colValue: { textAlign: 'center', fontSize: 11, fontFamily: fonts.bold, color: colors.muted, marginBottom: 3 },
    colTrack: { width: '100%', justifyContent: 'flex-end' },
    colLabels: { flexDirection: 'row', marginTop: 6 },
    colLabel: { flex: 1, fontSize: 10, lineHeight: 12, fontFamily: fonts.medium, color: colors.muted, textAlign: 'center', paddingHorizontal: 1 },
    labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 6 },
    label: { flex: 1, fontSize: 10, lineHeight: 13, fontFamily: fonts.medium, color: colors.muted, textAlign: 'center' },
}));
