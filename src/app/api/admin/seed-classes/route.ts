import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Supabase admin client
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const schoolId = session.user.schoolId;
        if (!schoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }


        // 2. Fetch academic levels to map appropriately
        // Often 'Primary', 'Secondary', etc. Let's just fetch them or insert them.
        const { data: levels, error: lvlErr } = await supabase.from('academic_levels').select('*');
        if (lvlErr) throw lvlErr;

        let primaryLevel = levels.find(l => l.name.toLowerCase().includes('primary') || l.name.toLowerCase().includes('basic'));
        let secondaryLevel = levels.find(l => l.name.toLowerCase().includes('secondary') || l.name.toLowerCase().includes('high'));

        // If not found, use the first available level or insert them
        if (!primaryLevel || !secondaryLevel) {
            if (levels.length > 0) {
                primaryLevel = levels[0];
                secondaryLevel = levels[0];
            } else {
                return NextResponse.json({ success: false, error: 'No academic levels found' }, { status: 400 });
            }
        }

        const gradesToSeed = [
            { code: 'G1', name_display: 'Grade 1', numeric_order: 1, level: primaryLevel },
            { code: 'G2', name_display: 'Grade 2', numeric_order: 2, level: primaryLevel },
            { code: 'G3', name_display: 'Grade 3', numeric_order: 3, level: primaryLevel },
            { code: 'G4', name_display: 'Grade 4', numeric_order: 4, level: primaryLevel },
            { code: 'G5', name_display: 'Grade 5', numeric_order: 5, level: primaryLevel },
            { code: 'G6', name_display: 'Grade 6', numeric_order: 6, level: primaryLevel },
            { code: 'G7', name_display: 'Grade 7', numeric_order: 7, level: primaryLevel },
            { code: 'G8', name_display: 'Grade 8', numeric_order: 8, level: primaryLevel },
            { code: 'G9', name_display: 'Grade 9', numeric_order: 9, level: primaryLevel },
            { code: 'G10', name_display: 'Grade 10', numeric_order: 10, level: secondaryLevel },
            { code: 'G11', name_display: 'Grade 11', numeric_order: 11, level: secondaryLevel },
            { code: 'G12', name_display: 'Grade 12', numeric_order: 12, level: secondaryLevel },
            { code: 'F3', name_display: 'Form 3', numeric_order: 13, level: secondaryLevel },
            { code: 'F4', name_display: 'Form 4', numeric_order: 14, level: secondaryLevel },
        ];

        let results = [];

        for (const g of gradesToSeed) {
            // Upsert Grade
            const { data: grade, error: gradeErr } = await supabase
                .from('grades')
                .select('*')
                .eq('code', g.code)
                .maybeSingle();

            let gradeId;
            if (!grade) {
                const { data: newGrade, error: insertGradeErr } = await supabase
                    .from('grades')
                    .insert({
                        code: g.code,
                        name_display: g.name_display,
                        academic_level_id: g.level.id,
                        numeric_order: g.numeric_order
                    })
                    .select()
                    .single();
                if (insertGradeErr) throw insertGradeErr;
                gradeId = newGrade.id;
                results.push(`Created grade ${g.name_display}`);
            } else {
                gradeId = grade.id;
            }

            // We no longer auto-create 'General' streams for every grade.
            // Users will explicitly add the classes they need in the Classes tab.
        }

        return NextResponse.json({ success: true, message: 'Seeding completed successfully', actions: results });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
