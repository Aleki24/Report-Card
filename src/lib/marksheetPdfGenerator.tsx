import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';

export interface MarkSheetData {
    schoolName: string;
    schoolLogoUrl?: string;
    schoolAddress?: string;
    examTitle: string;
    academicYear: string;
    className: string;
    gradingSystemType: 'KCSE' | 'CBC';
    subjects: string[]; // List of subject names (act as columns)
    students: {
        studentName: string;
        admissionNumber: string;
        marks: Record<string, number | null>; // map of subjectName to percentage or score
        overallPercentage: number;
        overallGrade: string;
        totalPoints: number;
        classRank: number;
    }[];
    gradeDistribution: Record<string, number>;
    meanGrade: string;
    meanPercentage: number;
}

const s = StyleSheet.create({
    page: { padding: 24, fontFamily: 'Helvetica', fontSize: 9, color: '#333' },
    headerWrap: { flexDirection: 'row', alignItems: 'center', borderBottom: '2pt solid #1E3A8A', paddingBottom: 10, marginBottom: 12, justifyContent: 'space-between' },
    logo: { width: 48, height: 48 },
    headerTextWrap: { flex: 1, alignItems: 'center' },
    schoolName: { fontSize: 16, fontWeight: 'bold', color: '#1E3A8A', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
    schoolAddress: { fontSize: 8, color: '#64748B', marginTop: 2, textAlign: 'center' },
    reportTitle: { textAlign: 'center', fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1E3A8A', marginVertical: 6 },
    infoRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 12 },
    infoText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0F172A' },
    
    table: { marginBottom: 12, border: '0.5pt solid #CBD5E1', borderBottom: 0 },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: '#1E3A8A' },
    tableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #CBD5E1' },
    tableRowAlt: { flexDirection: 'row', borderBottom: '0.5pt solid #CBD5E1', backgroundColor: '#F8FAFC' },
    
    // Fixed widths for standard columns
    colRank: { width: '5%', textAlign: 'center', borderRight: '0.5pt solid #CBD5E1', padding: 4 },
    colName: { width: '20%', borderRight: '0.5pt solid #CBD5E1', padding: 4 },
    colAdm: { width: '8%', textAlign: 'center', borderRight: '0.5pt solid #CBD5E1', padding: 4 },
    colSummary: { width: '8%', textAlign: 'center', borderRight: '0.5pt solid #CBD5E1', padding: 4 },

    thText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
    tdText: { fontSize: 7 },
    tdTextBold: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
    
    footer: { position: 'absolute', bottom: 20, left: 24, right: 24, textAlign: 'center', fontSize: 7, color: '#94A3B8', borderTop: '0.5pt solid #E2E8F0', paddingTop: 6 },
    
    summaryLine: { marginTop: 10, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1E3A8A' }
});

export function MarkSheetDocument({ data }: { data: MarkSheetData }) {
    // Calculate dynamic width for subject columns
    // We have Rank (5%), Name (20%), Adm (8%), and Summary columns Total (8%), Grade (8%) = 49% total fixed.
    // Leaves 51% for subjects.
    const remainingWidth = 51;
    const numSubjects = data.subjects.length > 0 ? data.subjects.length : 1;
    const colSubjWidth = `${remainingWidth / numSubjects}%`;
    const isKCSE = data.gradingSystemType === 'KCSE';

    return (
        <Document>
            <Page size="A4" orientation="landscape" style={s.page}>
                <View style={s.headerWrap}>
                    <View style={{ width: 48 }} />
                    <View style={s.headerTextWrap}>
                        <Text style={s.schoolName}>{data.schoolName}</Text>
                        {data.schoolAddress && <Text style={s.schoolAddress}>{data.schoolAddress}</Text>}
                        <Text style={s.reportTitle}>{data.examTitle} — Class Broad Sheet</Text>
                    </View>
                    {data.schoolLogoUrl ? <Image style={s.logo} src={data.schoolLogoUrl} /> : <View style={{ width: 48 }} />}
                </View>

                <View style={s.infoRow}>
                    <Text style={s.infoText}>Class: {data.className}</Text>
                    <Text style={s.infoText}>Year: {data.academicYear}</Text>
                </View>

                <View style={s.table}>
                    <View style={s.tableHeaderRow}>
                        <Text style={[s.colRank, s.thText]}>Pos</Text>
                        <Text style={[s.colName, s.thText]}>Student Name</Text>
                        <Text style={[s.colAdm, s.thText]}>Adm Number</Text>
                        
                        {data.subjects.map(subj => (
                            <Text key={subj} style={[s.thText, { width: colSubjWidth, textAlign: 'center', borderRight: '0.5pt solid #CBD5E1', padding: 4 }]}>
                                {subj.substring(0, 10)}
                            </Text>
                        ))}
                        
                        <Text style={[s.colSummary, s.thText]}>Total %</Text>
                        <Text style={[s.colSummary, s.thText]}>Points</Text>
                        <Text style={[s.colSummary, s.thText]}>Grade</Text>
                    </View>

                    {data.students.map((student, idx) => {
                        const rowStyle = idx % 2 === 0 ? s.tableRowAlt : s.tableRow;
                        return (
                            <View key={student.admissionNumber || idx} style={rowStyle}>
                                <Text style={[s.colRank, s.tdText]}>{student.classRank}</Text>
                                <Text style={[s.colName, s.tdTextBold]}>{student.studentName}</Text>
                                <Text style={[s.colAdm, s.tdText]}>{student.admissionNumber}</Text>
                                
                                {data.subjects.map(subj => {
                                    const val = student.marks[subj];
                                    return (
                                        <Text key={subj} style={[s.tdText, { width: colSubjWidth, textAlign: 'center', borderRight: '0.5pt solid #CBD5E1', padding: 4 }]}>
                                            {val !== null ? val : '-'}
                                        </Text>
                                    );
                                })}
                                
                                <Text style={[s.colSummary, s.tdTextBold]}>{student.overallPercentage.toFixed(1)}</Text>
                                <Text style={[s.colSummary, s.tdTextBold]}>{isKCSE ? student.totalPoints : '-'}</Text>
                                <Text style={[s.colSummary, s.tdTextBold]}>{student.overallGrade}</Text>
                            </View>
                        );
                    })}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                    <View>
                        <Text style={s.summaryLine}>Class Mean Grade: {data.meanGrade}</Text>
                        <Text style={s.summaryLine}>Class Mean %: {data.meanPercentage.toFixed(2)}%</Text>
                    </View>
                    <View>
                        <Text style={s.summaryLine}>Total Students: {data.students.length}</Text>
                    </View>
                </View>

                <Text style={s.footer}>
                    Generated by ResultsApp • Mark Sheet
                </Text>
            </Page>
        </Document>
    );
}

export async function generateMarkSheetPDF(data: MarkSheetData): Promise<Buffer> {
    const buffer = await renderToBuffer(<MarkSheetDocument data={data} />);
    return Buffer.from(buffer);
}
