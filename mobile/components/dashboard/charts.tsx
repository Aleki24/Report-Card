import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { fonts, makeStyles, useTheme } from '@/lib/theme';

/** The learner's average as a ring, for the hero (white on the gradient). */
export function ScoreRing({ value, size = 96 }: { value: number; size?: number }) {
    const stroke = 9;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, value));
    return (
        <Svg width={size} height={size} accessibilityRole="image" accessibilityLabel={`${Math.round(value)}% average`}>
            <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
            <Circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff" strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - pct / 100)}
                rotation={-90} origin={`${size / 2}, ${size / 2}`}
            />
            <SvgText x={size / 2} y={size / 2 + 2} textAnchor="middle" fontSize={21} fontFamily={fonts.display} fill="#ffffff">{`${Math.round(value)}%`}</SvgText>
            <SvgText x={size / 2} y={size / 2 + 17} textAnchor="middle" fontSize={8} fontFamily={fonts.bold} fill="rgba(255,255,255,0.75)" letterSpacing={1}>AVERAGE</SvgText>
        </Svg>
    );
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
    labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 6 },
    label: { flex: 1, fontSize: 10, lineHeight: 13, fontFamily: fonts.medium, color: colors.muted, textAlign: 'center' },
}));
