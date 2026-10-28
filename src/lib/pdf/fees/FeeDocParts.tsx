import React from 'react';
import { View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { FONTS } from '../pdfFonts';

/**
 * What a school's fee documents share: the letterhead, a document title
 * band, labelled fields and the footer, in one palette, so a receipt and a
 * statement from the same school look like they belong together.
 */

export const FEE_INK = '#0F172A';
export const FEE_MUTED = '#475569';
export const FEE_FAINT = '#94A3B8';
export const FEE_RULE = '#E2E8F0';
export const FEE_TINT = '#F8FAFC';
export const FEE_ACCENT = '#1D4ED8';
export const FEE_GOOD = '#047857';
export const FEE_WARN = '#B45309';

export const FEE_FONT = FONTS.inter;

// Emails, links and receipt codes must not break with a hyphen ("bur-sar@").
try {
    Font.registerHyphenationCallback(word => [word]);
} catch {
    // Never let a font problem stop a receipt from being produced.
}

export interface FeeSchool {
    name: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    email?: string;
    motto?: string;
}

/** The `schools` columns fee documents print. */
export const FEE_SCHOOL_COLUMNS = 'name, logo_url, address, phone, email, motto';

export function feeSchool(row: { name: string | null; logo_url: string | null; address: string | null; phone: string | null; email: string | null; motto: string | null } | null | undefined): FeeSchool {
    return {
        name: row?.name || 'School',
        logoUrl: row?.logo_url || undefined,
        address: row?.address || undefined,
        phone: row?.phone || undefined,
        email: row?.email || undefined,
        motto: row?.motto || undefined,
    };
}

const s = StyleSheet.create({
    letterhead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: `1.5pt solid ${FEE_INK}` },
    logo: { width: 46, height: 46, objectFit: 'contain' },
    schoolBlock: { flex: 1 },
    schoolName: { fontFamily: FEE_FONT, fontSize: 15, fontWeight: 800, color: FEE_INK, letterSpacing: -0.2 },
    motto: { fontFamily: FEE_FONT, fontSize: 7.5, color: FEE_MUTED, marginTop: 1.5 },
    contact: { fontFamily: FEE_FONT, fontSize: 7.5, color: FEE_MUTED, marginTop: 3 },
    titleBlock: { alignItems: 'flex-end' },
    title: { fontFamily: FEE_FONT, fontSize: 11, fontWeight: 800, color: FEE_ACCENT, letterSpacing: 1.6, textTransform: 'uppercase' },
    titleMeta: { fontFamily: FEE_FONT, fontSize: 8.5, fontWeight: 600, color: FEE_INK, marginTop: 3 },
    titleSub: { fontFamily: FEE_FONT, fontSize: 7.5, color: FEE_MUTED, marginTop: 1.5 },

    fieldLabel: { fontFamily: FEE_FONT, fontSize: 6.5, fontWeight: 700, color: FEE_FAINT, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
    fieldValue: { fontFamily: FEE_FONT, fontSize: 9.5, fontWeight: 600, color: FEE_INK },

    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8, borderTop: `0.5pt solid ${FEE_RULE}` },
    footerText: { fontFamily: FEE_FONT, fontSize: 6.5, color: FEE_FAINT, lineHeight: 1.4 },
    qr: { width: 52, height: 52 },
});

/** School name, motto and contacts on the left; what the document is on the right. */
export function FeeLetterhead({ school, title, meta, sub }: { school: FeeSchool; title: string; meta?: string; sub?: string }) {
    const reach = [school.phone, school.email].filter(Boolean).join('  ·  ');
    return (
        <View style={s.letterhead}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt prop */}
            {school.logoUrl ? <Image src={school.logoUrl} style={s.logo} /> : null}
            <View style={s.schoolBlock}>
                <Text style={s.schoolName}>{school.name}</Text>
                {school.motto ? <Text style={s.motto}>{school.motto}</Text> : null}
                {school.address ? <Text style={s.contact}>{school.address}</Text> : null}
                {reach ? <Text style={[s.contact, { marginTop: 1 }]}>{reach}</Text> : null}
            </View>
            <View style={s.titleBlock}>
                <Text style={s.title}>{title}</Text>
                {meta ? <Text style={s.titleMeta}>{meta}</Text> : null}
                {sub ? <Text style={s.titleSub}>{sub}</Text> : null}
            </View>
        </View>
    );
}

export function FeeField({ label, value, width = '50%' }: { label: string; value: string; width?: string }) {
    return (
        <View style={{ width, marginBottom: 9, paddingRight: 8 }}>
            <Text style={s.fieldLabel}>{label}</Text>
            <Text style={s.fieldValue}>{value}</Text>
        </View>
    );
}

/** Fixed to the bottom of every page; the QR (when given) checks the document online. */
export function FeeFooter({ lines, qrDataUri, inset }: { lines: string[]; qrDataUri?: string | null; inset: number }) {
    return (
        <View style={[s.footer, { left: inset, right: inset, bottom: inset - 14 }]} fixed>
            <View style={{ flex: 1 }}>
                {lines.map(line => <Text key={line} style={s.footerText}>{line}</Text>)}
            </View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt prop */}
            {qrDataUri ? <Image src={qrDataUri} style={s.qr} /> : null}
        </View>
    );
}

/** "14 Oct 2026" */
export const docDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "14 Oct 2026, 10:42" */
export const docDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
