// src/app/api/school/student/dashboard/route.ts
// Student dashboard summary — profile, KPIs, recent results, latest report

import { NextResponse } from 'next/server';
import { getCurrentStudent } from '@/lib/student/get-current-student';
import { getStudentDashboardSummary } from '@/lib/student/queries';

export async function GET() {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const summary = await getStudentDashboardSummary(student);
        return NextResponse.json({ data: summary });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
