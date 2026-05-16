// src/app/api/school/student/attendance/route.ts
// Returns attendance records with optional from/to date filtering

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStudent } from '@/lib/student/get-current-student';
import { getStudentAttendance } from '@/lib/student/queries';

export async function GET(request: NextRequest) {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const params = {
            from: searchParams.get('from') || undefined,
            to: searchParams.get('to') || undefined,
        };

        const attendance = await getStudentAttendance(student, params);
        return NextResponse.json({ data: attendance });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
