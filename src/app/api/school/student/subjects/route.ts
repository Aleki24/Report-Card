// src/app/api/school/student/subjects/route.ts
// Returns subjects for the student's academic level

import { NextResponse } from 'next/server';
import { getCurrentStudent } from '@/lib/student/get-current-student';
import { getStudentSubjects } from '@/lib/student/queries';

export async function GET() {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const subjects = await getStudentSubjects(student);
        return NextResponse.json({ data: subjects });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
