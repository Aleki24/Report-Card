/**
 * Small drawing pieces the report card templates and the mark sheet share.
 * Each takes its colours and fonts as props so a template keeps its own look.
 */
import React from 'react';
import { Text, View, Image, Svg, Circle, Path, Polygon } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { APP_LOGO, BRAND, FONTS } from './pdfTheme';

/* ── Signature ──────────────────────────────────────────────── */

/**
 * A scanned signature laid over a signature line. Absolutely positioned so it
 * takes no height: a card that fits one page still fits with a signature on.
 * Place it inside the element whose top edge is the line; `lift` is how far
 * above that edge the image's bottom sits.
 */
export function SignatureImage({ src, height = 20, lift = 1 }: { src?: string; height?: number; lift?: number }) {
    if (!src) return null;
    return (
        <Image
            src={src}
            style={{ position: 'absolute', left: 0, top: -(height + lift), height, width: height * 3.5, objectFit: 'contain' }}
        />
    );
}

/* ── School crest ───────────────────────────────────────────── */

/** The school's logo in a frame, or its initial when it has none. */
export function Crest({ logo, initial, size, background, color, fontFamily, radius, ring, fontWeight = 700 }: {
    logo?: string;
    initial: string;
    size: number;
    background: string;
    color: string;
    fontFamily: string;
    /** Corner radius; defaults to a circle. */
    radius?: number;
    /** An outer keyline, e.g. Heritage's gold ring. */
    ring?: { color: string; gap: number; width: number };
    fontWeight?: 400 | 700 | 800;
}) {
    const r = radius ?? size / 2;
    const inner = logo ? (
        // A white frame with padding: any logo shape renders whole.
        <View style={{ width: size, height: size, borderRadius: r, backgroundColor: '#FFFFFF', padding: size * 0.1, alignItems: 'center', justifyContent: 'center' }}>
            <Image src={logo} style={{ width: size * 0.8, height: size * 0.8, objectFit: 'contain' }} />
        </View>
    ) : (
        <View style={{ width: size, height: size, borderRadius: r, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily, fontWeight, fontSize: size * 0.46, color, lineHeight: 1 }}>{initial}</Text>
        </View>
    );
    if (!ring) return inner;
    const outer = size + 2 * (ring.gap + ring.width);
    return (
        <View style={{ width: outer, height: outer, borderRadius: radius != null ? r + ring.gap + ring.width : outer / 2, border: `${ring.width}pt solid ${ring.color}`, alignItems: 'center', justifyContent: 'center' }}>
            {inner}
        </View>
    );
}

/* ── Score ring ─────────────────────────────────────────────── */

/**
 * A progress ring drawn from 12 o'clock (react-pdf paints gradients as fills
 * only, so the ring takes a solid colour).
 * Children are centred inside it.
 */
export function ScoreRing({ size, stroke, pct, color, track, children }: {
    size: number;
    stroke: number;
    pct: number;
    color: string;
    track: string;
    children?: React.ReactNode;
}) {
    const r = (size - stroke) / 2;
    const mid = size / 2;
    const share = Math.max(0, Math.min(100, pct)) / 100;
    // Drawn as an arc path: react-pdf does not honour stroke-dasharray on a
    // circle, which left the ring with its track and no progress at all.
    const angle = share * 2 * Math.PI;
    const endX = mid + r * Math.sin(angle);
    const endY = mid - r * Math.cos(angle);
    const arc = `M ${mid} ${mid - r} A ${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`;
    return (
        <View style={{ width: size, height: size, position: 'relative' }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <Circle cx={mid} cy={mid} r={r} fill="none" stroke={track} strokeWidth={stroke} />
                {share >= 0.999
                    ? <Circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={stroke} />
                    : share > 0 && <Path d={arc} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />}
            </Svg>
            <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                {children}
            </View>
        </View>
    );
}

/* ── Movement ───────────────────────────────────────────────── */

export interface TrendColors { up: string; down: string; flat: string }

/**
 * A drawn triangle and the size of the move: glyph arrows are one missing
 * character away from printing blank, a polygon always prints.
 */
export function Trend({ value, unit = '', size, colors, fontFamily, fontWeight = 700, suffix, style }: {
    value: number;
    unit?: string;
    size: number;
    colors: TrendColors;
    fontFamily: string;
    fontWeight?: 400 | 600 | 700 | 800;
    suffix?: string;
    style?: Style;
}) {
    const color = value > 0 ? colors.up : value < 0 ? colors.down : colors.flat;
    const t = size * 0.62;
    return (
        <View style={[{ flexDirection: 'row', alignItems: 'center' }, style ?? {}]}>
            {value !== 0 && (
                <Svg width={t} height={t} viewBox="0 0 10 10" style={{ marginRight: size * 0.25 }}>
                    <Polygon points={value > 0 ? '5,1 9.5,9 0.5,9' : '0.5,1 9.5,1 5,9'} fill={color} />
                </Svg>
            )}
            <Text style={{ fontFamily, fontWeight, fontSize: size, color }}>
                {value === 0 ? '0' : Math.abs(value)}{unit}{suffix ? ` ${suffix}` : ''}
            </Text>
        </View>
    );
}

/* ── Footer ─────────────────────────────────────────────────── */

/**
 * The one footer every document carries: a rule, the SkulBase mark on the
 * left and the document's own meta on the right. `mono` prints the wordmark
 * in black for the ink-only template.
 */
export function BrandFooter({ ruleColor, ruleOpacity = 1, meta, paddingX, paddingBottom, mono = false, textColor = '#64748B' }: {
    ruleColor: string;
    ruleOpacity?: number;
    meta: string[];
    paddingX: number;
    paddingBottom: number;
    mono?: boolean;
    textColor?: string;
}) {
    const text: Style = { fontFamily: FONTS.inter, fontSize: 6.4, color: textColor };
    return (
        <View style={{ marginTop: 'auto', paddingTop: 8, paddingHorizontal: paddingX, paddingBottom }} wrap={false}>
            <View style={{ height: 0.75, backgroundColor: ruleColor, opacity: ruleOpacity, marginBottom: 6 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!mono && <Image src={APP_LOGO} style={{ width: 10, height: 10, objectFit: 'contain', marginRight: 4 }} />}
                    <Text style={{ fontFamily: FONTS.inter, fontWeight: 700, fontSize: 7.8 }}>
                        <Text style={{ color: mono ? '#000000' : BRAND.blue }}>skul</Text>
                        <Text style={{ color: mono ? '#000000' : BRAND.green }}>base</Text>
                    </Text>
                    <Text style={[text, { marginLeft: 4 }]}>· school management system</Text>
                </View>
                <Text style={text}>{meta.filter(Boolean).join('   ·   ')}</Text>
            </View>
        </View>
    );
}

/** The footer's right-hand meta for a report card. */
export function reportFooterMeta(hasQr: boolean, issued: string): string[] {
    return [hasQr ? 'Scan the QR code to verify this report online' : '', `Generated ${issued}`];
}
