import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createClerkClient } from '@clerk/nextjs/server';
import { sendSchoolApprovedEmail, sendSchoolRejectedEmail } from '@/lib/email';

export const runtime = 'nodejs';

/**
 * The platform owner's approve / reject action on a school sign-up.
 *
 * Authenticated by the single-use token minted when the school was requested
 * and emailed only to the owner — so this works straight from their inbox with
 * no separate console login, and stops working the moment it is used. There is
 * deliberately no session check: the owner is not necessarily a user of any
 * school in the system.
 *
 * Approving is what promotes the requester to ADMIN. Until then their role
 * stays PENDING, which is what every other route already refuses.
 */
async function decide(schoolId: string, action: string | null, token: string | null, note: string | null) {
    if (action !== 'approve' && action !== 'reject') {
        return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }
    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data: school } = await supabase
        .from('schools')
        .select('id, name, approval_status, approval_token, requested_by')
        .eq('id', schoolId)
        .maybeSingle();

    if (!school) {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Already decided: the token is cleared on use, so a second click on an
    // emailed link lands here. Report the standing decision rather than erroring.
    if (school.approval_status !== 'PENDING_APPROVAL' || !school.approval_token) {
        return htmlResult(
            school.approval_status === 'APPROVED' ? 'Already approved' : 'Already decided',
            `"${school.name}" is ${String(school.approval_status).toLowerCase().replace(/_/g, ' ')}. No further action needed.`,
            school.approval_status === 'APPROVED'
        );
    }

    // Constant-time-ish comparison on equal-length secrets; both are app-minted
    // UUID strings so a length mismatch alone is already a reject.
    if (token.length !== school.approval_token.length || token !== school.approval_token) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const requester = school.requested_by
        ? (await supabase.from('users').select('id, email, first_name').eq('id', school.requested_by).maybeSingle()).data
        : null;

    if (action === 'reject') {
        await supabase.from('schools').update({
            approval_status: 'REJECTED',
            approval_decided_at: new Date().toISOString(),
            approval_token: null,
            approval_note: note,
        }).eq('id', schoolId);

        if (requester?.email) {
            sendSchoolRejectedEmail(requester.email, requester.first_name, school.name, note)
                .catch(err => console.error('[school-approval] rejection email failed:', err));
        }
        return htmlResult('Rejected', `"${school.name}" was rejected and stays locked out.`, false);
    }

    // ── Approve: this is the promotion to ADMIN ──
    await supabase.from('schools').update({
        approval_status: 'APPROVED',
        approval_decided_at: new Date().toISOString(),
        approval_token: null,
    }).eq('id', schoolId);

    if (school.requested_by) {
        await supabase.from('users')
            .update({ role: 'ADMIN', school_id: schoolId })
            .eq('id', school.requested_by);

        // Mirror onto the Clerk session claim the middleware reads. A failure
        // here is not fatal — the database role is authoritative and the app
        // re-reads it — so it is logged rather than surfaced as an error.
        try {
            const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
            await clerk.users.updateUser(school.requested_by, {
                publicMetadata: { role: 'ADMIN', school_id: schoolId },
            });
        } catch (err) {
            console.error('[school-approval] Clerk metadata update failed:', err);
        }
    }

    if (requester?.email) {
        sendSchoolApprovedEmail(requester.email, requester.first_name, school.name)
            .catch(err => console.error('[school-approval] approval email failed:', err));
    }

    return htmlResult('Approved', `"${school.name}" is now live and its administrator can sign in.`, true);
}

/** A plain confirmation page — the owner clicks these links from an email client. */
function htmlResult(title: string, message: string, good: boolean) {
    const accent = good ? '#059669' : '#dc2626';
    return new NextResponse(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
         <title>${title}</title></head>
         <body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f8fafc;">
           <div style="max-width:420px;padding:32px;text-align:center;background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
             <h1 style="color:${accent};font-size:20px;margin:0 0 8px;">${title}</h1>
             <p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">${message}</p>
           </div>
         </body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
}

/** GET so the owner can act by clicking a link in the notification email. */
export async function GET(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = await params;
    const { searchParams } = new URL(request.url);
    return decide(schoolId, searchParams.get('action'), searchParams.get('token'), searchParams.get('note'));
}

/** POST for a console or script, where a rejection note can be supplied. */
export async function POST(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = await params;
    const { searchParams } = new URL(request.url);
    let body: { action?: string; token?: string; note?: string } = {};
    try { body = await request.json(); } catch { /* fall back to query params */ }
    return decide(
        schoolId,
        body.action ?? searchParams.get('action'),
        body.token ?? searchParams.get('token'),
        body.note ?? searchParams.get('note')
    );
}
