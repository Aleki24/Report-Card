import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Directly add a student to the system.
 * Generates a UUID, inserts into public.users and public.students.
 * Students don't need to log in — this just creates their record for marks/reports.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { first_name, last_name, admission_number, grade_stream_id, academic_level_id, school_id, admin_user_id } = body;

        if (!first_name?.trim() || !last_name?.trim()) {
            return NextResponse.json({ error: 'First name and last name are required.' }, { status: 400 });
        }
        if (!academic_level_id) {
            return NextResponse.json({ error: 'Academic level is required.' }, { status: 400 });
        }
        if (!admin_user_id) {
            return NextResponse.json({ error: 'admin_user_id is required.' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller is an ADMIN
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', admin_user_id)
            .single();

        if (!adminProfile || adminProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only admins can add students.' }, { status: 403 });
        }

        const effectiveSchoolId = school_id || adminProfile.school_id;

        // Check if admission number already exists in students table
        // Check for duplicate admission number (only if provided)
        const admNo = admission_number?.trim() || null;
        if (admNo) {
            const { data: existingStudent } = await supabaseAdmin
                .from('students')
                .select('id')
                .eq('admission_number', admNo)
                .maybeSingle();

            if (existingStudent) {
                return NextResponse.json({ error: `A student with admission number "${admNo}" already exists.` }, { status: 409 });
            }
        }

        // 1. Generate a UUID for the new student
        const userId = crypto.randomUUID();
        const finalAdmNo = admNo || `STU-${Date.now().toString().slice(-6)}`;
        const emailBase = finalAdmNo.toLowerCase().replace(/[^a-z0-9]/g, '');
        const placeholderEmail = `${emailBase}@student.local`;

        // 2. Insert into public.users (no password — students don't log in by default)
        const { error: userError } = await supabaseAdmin.from('users').insert({
            id: userId,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: placeholderEmail,
            role: 'STUDENT',
            school_id: effectiveSchoolId,
        });

        if (userError) {
            return NextResponse.json({ error: `User record creation failed: ${userError.message}` }, { status: 400 });
        }

        // 3. Insert into public.students
        const { error: studentError } = await supabaseAdmin.from('students').insert({
            id: userId,
            admission_number: finalAdmNo,
            current_grade_stream_id: grade_stream_id || null,
            academic_level_id: academic_level_id,
        });

        if (studentError) {
            // Cleanup: delete user row
            await supabaseAdmin.from('users').delete().eq('id', userId);
            return NextResponse.json({ error: `Student record creation failed: ${studentError.message}` }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            student_id: userId,
            admission_number: finalAdmNo,
            message: `Student ${first_name.trim()} ${last_name.trim()} added successfully.`,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
