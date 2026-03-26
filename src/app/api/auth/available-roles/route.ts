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
        
        if (currentRole === 'CLASS_TEACHER' || currentRole === 'SUBJECT_TEACHER') {
            // Add current role
            availableRoles.add(currentRole);

            // Check if they are a class teacher
            const { data: classAssigned } = await supabase
                .from('class_teachers')
                .select('id')
                .eq('user_id', userId)
                .limit(1);

            if (classAssigned && classAssigned.length > 0) {
                availableRoles.add('CLASS_TEACHER');
            }

            // Check if they are a subject teacher
            const { data: subjectAssigned } = await supabase
                .from('subject_teachers')
                .select('id')
                .eq('user_id', userId)
                .limit(1);

            if (subjectAssigned && subjectAssigned.length > 0) {
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
