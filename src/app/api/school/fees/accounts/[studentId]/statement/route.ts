import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { canViewStudentFees } from '@/lib/auth-server';
import { getAccess } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadFeeAccount, payInstructions } from '@/lib/fee-account-server';
import { FEE_SCHOOL_COLUMNS, feeSchool } from '@/lib/pdf/fees/FeeDocParts';
import { generateFeeStatementPDF } from '@/lib/pdf/fees/feeDocsServer';

export const runtime = 'nodejs';

/** GET — a learner's fee statement as a PDF, for whoever may see their fees. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
    try {
        const caller = await getAccess();
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { studentId } = await params;
        if (!(await canViewStudentFees(caller, studentId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const supabase = createSupabaseAdmin();
        const [account, { data: school }] = await Promise.all([
            loadFeeAccount(supabase, caller.schoolId, studentId),
            supabase.from('schools').select(FEE_SCHOOL_COLUMNS).eq('id', caller.schoolId).maybeSingle(),
        ]);
        if (!account) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });

        const pdf = await generateFeeStatementPDF({
            school: feeSchool(school),
            account,
            generatedAt: new Date().toISOString(),
            payInstructions: await payInstructions(supabase, caller.schoolId, account.learner.admissionNumber),
        });
        const name = (account.learner.admissionNumber || account.learner.name).replace(/[^\w-]+/g, '-');
        return new NextResponse(new Uint8Array(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="fee-statement-${name}.pdf"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (err: unknown) {
        return internalError('fee statement', err);
    }
}
