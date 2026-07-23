import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

/**
 * inviteCodesPdf.tsx
 * A printable directory of user invitation codes grouped by category
 * (Administrators / Teachers / Students) so an admin can print a page per
 * category and hand each person their activation details in person.
 */

const NAVY = '#1A365D';
const GRAY_200 = '#E2E6ED';
const GRAY_400 = '#9CA3AF';
const GRAY_700 = '#374151';
const LIGHT = '#F2F2F2';
const GREEN = '#166534';
const AMBER = '#B45309';
const RED = '#B91C1C';

export type InviteCodeStatus = 'Active' | 'Used' | 'Expired';

export interface InviteCodeRow {
    name: string;
    username: string;
    phone: string;
    code: string;
    status: InviteCodeStatus;
    expiresAt?: string;
}

export interface InviteCategory {
    /** Display heading, e.g. "Teachers" */
    label: string;
    rows: InviteCodeRow[];
}

export interface InviteCodesPdfData {
    schoolName: string;
    schoolLogoUrl?: string;
    generatedAt: string;
    categories: InviteCategory[];
}

const st = StyleSheet.create({
    page: { paddingTop: 28, paddingBottom: 40, paddingHorizontal: 32, fontFamily: 'Helvetica', fontSize: 9, color: GRAY_700 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    logo: { width: 40, height: 40, objectFit: 'contain', marginRight: 10 },
    schoolName: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5 },
    docTitle: { fontSize: 9, color: GRAY_400, marginTop: 2 },
    categoryBanner: {
        backgroundColor: NAVY, color: '#fff', paddingVertical: 6, paddingHorizontal: 12,
        borderRadius: 4, marginTop: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    categoryTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
    categoryCount: { fontSize: 9, color: '#CBD5E1' },
    table: { borderWidth: 1, borderColor: GRAY_200, borderRadius: 3, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: LIGHT, borderBottomWidth: 1, borderBottomColor: GRAY_200 },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: GRAY_200 },
    rowAlt: { backgroundColor: '#FAFBFC' },
    th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY, textTransform: 'uppercase', paddingVertical: 6, paddingHorizontal: 6 },
    td: { fontSize: 9, paddingVertical: 6, paddingHorizontal: 6, color: GRAY_700 },
    // Column widths
    cNum: { width: '6%' },
    cName: { width: '30%' },
    cUser: { width: '24%' },
    cPhone: { width: '18%' },
    cCode: { width: '14%' },
    cStatus: { width: '8%' },
    codeText: { fontFamily: 'Courier-Bold', fontSize: 11, letterSpacing: 1, color: NAVY },
    emptyNote: { fontSize: 9, color: GRAY_400, fontStyle: 'italic', paddingVertical: 10, paddingHorizontal: 6 },
    footer: {
        position: 'absolute', bottom: 18, left: 32, right: 32,
        flexDirection: 'row', justifyContent: 'space-between',
        borderTopWidth: 1, borderTopColor: GRAY_200, paddingTop: 6,
        fontSize: 7, color: GRAY_400,
    },
});

function statusColor(status: InviteCodeStatus): string {
    if (status === 'Active') return GREEN;
    if (status === 'Used') return GRAY_400;
    return status === 'Expired' ? RED : AMBER;
}

function CategoryBlock({ category }: { category: InviteCategory }) {
    return (
        <View wrap>
            <View style={st.categoryBanner}>
                <Text style={st.categoryTitle}>{category.label}</Text>
                <Text style={st.categoryCount}>{category.rows.length} {category.rows.length === 1 ? 'code' : 'codes'}</Text>
            </View>

            <View style={st.table}>
                <View style={st.tableHeader} fixed>
                    <Text style={[st.th, st.cNum]}>#</Text>
                    <Text style={[st.th, st.cName]}>Name</Text>
                    <Text style={[st.th, st.cUser]}>Username</Text>
                    <Text style={[st.th, st.cPhone]}>Phone</Text>
                    <Text style={[st.th, st.cCode]}>Invite Code</Text>
                    <Text style={[st.th, st.cStatus]}>Status</Text>
                </View>

                {category.rows.length === 0 ? (
                    <Text style={st.emptyNote}>No invite codes in this category.</Text>
                ) : (
                    category.rows.map((r, i) => (
                        <View key={i} style={i % 2 === 1 ? [st.row, st.rowAlt] : st.row} wrap={false}>
                            <Text style={[st.td, st.cNum, { color: GRAY_400 }]}>{i + 1}</Text>
                            <Text style={[st.td, st.cName]}>{r.name || '—'}</Text>
                            <Text style={[st.td, st.cUser]}>{r.username || '—'}</Text>
                            <Text style={[st.td, st.cPhone]}>{r.phone || '—'}</Text>
                            <Text style={[st.td, st.cCode]}><Text style={st.codeText}>{r.code}</Text></Text>
                            <Text style={[st.td, st.cStatus, { color: statusColor(r.status), fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>{r.status}</Text>
                        </View>
                    ))
                )}
            </View>
        </View>
    );
}

export function InviteCodesDocument({ data }: { data: InviteCodesPdfData }) {
    return (
        <Document title={`Invite Codes — ${data.schoolName}`}>
            <Page size="A4" style={st.page}>
                <View style={st.header} fixed>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt prop */}
                    {data.schoolLogoUrl ? <Image src={data.schoolLogoUrl} style={st.logo} /> : null}
                    <View>
                        <Text style={st.schoolName}>{data.schoolName}</Text>
                        <Text style={st.docTitle}>User Invitation Codes · Generated {data.generatedAt}</Text>
                    </View>
                </View>

                {data.categories.map((cat, i) => (
                    <CategoryBlock key={i} category={cat} />
                ))}

                <View style={st.footer} fixed>
                    <Text>{data.schoolName} — share these codes only with the intended users.</Text>
                    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
}

/** Render the grouped invite-code directory to a PDF Buffer. */
export async function generateInviteCodesPDF(data: InviteCodesPdfData): Promise<Buffer> {
    return renderToBuffer(<InviteCodesDocument data={data} />);
}
