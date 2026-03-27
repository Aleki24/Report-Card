import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !(session.user as any).id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const availableRoles = new Set<string>();

        // We only check for multiple roles if the user is a teacher
        // (Admins and Students only have one role)
        const sessionUser = session.user as any;
        const currentRole = sessionUser.role;
        const userId = sessionUser.id;
        const schoolId = sessionUser.schoolId;

        // Get current academic year
        let currentYearId: string | null = null;
        if (schoolId) {
            const { data: currentYear } = await supabase
                .from('academic_years')
                .select('id')
                .eq('school_id', schoolId)
                .order('start_date', { ascending: false })
                .limit(1)
                .single();
            currentYearId = currentYear?.id ?? null;
        }
        
        if (currentRole === 'CLASS_TEACHER' || currentRole === 'SUBJECT_TEACHER') {
            // Add current role
            availableRoles.add(currentRole);

            // Check if they are a class teacher (for current academic year)
            let classQuery = supabase
                .from('class_teachers')
                .select('id')
                .eq('user_id', userId);
            
            if (currentYearId) {
                classQuery = classQuery.eq('academic_year_id', currentYearId);
            }

            const { data: classAssigned } = await classQuery.limit(1).maybeSingle();

            if (classAssigned) {
                availableRoles.add('CLASS_TEACHER');
            }

            // Check if they are a subject teacher (they should have subject_teachers record)
            const { data: subjectAssigned } = await supabase
                .from('subject_teachers')
                .select('id')
                .eq('user_id', userId)
                .limit(1)
                .maybeSingle();

            if (subjectAssigned) {
                availableRoles.add('SUBJECT_TEACHER');
            }
        } else {
            // Admins and students
            availableRoles.add(currentRole);
        }

        return NextResponse.json({
            roles: Array.from(availableRoles)
        });

    } catch (error: any) {
        console.error('Error fetching available roles:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
