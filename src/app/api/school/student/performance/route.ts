// src/app/api/school/student/performance/route.ts
// Returns term-by-term performance trends derived from exam_marks

import { NextResponse } from 'next/server';
import { getCurrentStudent } from '@/lib/student/get-current-student';
import { getStudentPerformanceTrends } from '@/lib/student/queries';

export async function GET() {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const trends = await getStudentPerformanceTrends(student);
        return NextResponse.json({ data: trends });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
