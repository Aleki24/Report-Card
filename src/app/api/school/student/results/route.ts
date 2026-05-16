// src/app/api/school/student/results/route.ts
// Returns exam results with optional year/term/subject filters

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStudent } from '@/lib/student/get-current-student';
import { getStudentResults } from '@/lib/student/queries';

export async function GET(request: NextRequest) {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const filters = {
            academicYearId: searchParams.get('year') || undefined,
            termId: searchParams.get('term') || undefined,
            subjectId: searchParams.get('subject') || undefined,
        };

        const results = await getStudentResults(student, filters);
        return NextResponse.json({ data: results });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
