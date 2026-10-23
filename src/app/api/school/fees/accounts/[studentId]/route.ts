import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { canViewStudentFees } from '@/lib/auth-server';
import { getAccess } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadFeeAccount } from '@/lib/fee-account-server';

/**
 * GET — a learner's fee account: every term billed, every payment, the
 * running balance across terms, and their guardians. For finance staff, the
 * learner, and their linked parents.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
    try {
        const caller = await getAccess();
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { studentId } = await params;
        if (!(await canViewStudentFees(caller, studentId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const account = await loadFeeAccount(createSupabaseAdmin(), caller.schoolId, studentId);
        if (!account) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
        return NextResponse.json(account);
    } catch (err: unknown) {
        return internalError('fee account', err);
    }
}
