// src/app/api/school/student/report-cards/route.ts
// Returns student's report cards with subject breakdowns

import { NextResponse } from 'next/server';
import { getCurrentStudent } from '@/lib/student/get-current-student';
import { getStudentReportCards } from '@/lib/student/queries';

export async function GET() {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const reportCards = await getStudentReportCards(student);
        return NextResponse.json({ data: reportCards });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
