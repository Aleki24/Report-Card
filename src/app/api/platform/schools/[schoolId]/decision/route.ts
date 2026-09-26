import { NextResponse, after } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createClerkClient } from '@clerk/nextjs/server';
import { sendSchoolRejectedEmail } from '@/lib/email';
import { notifyRequesterOfApproval } from '@/lib/school-approval';
import { verifyWebhookToken } from '@/lib/crypto';
import { escapeHtml } from '@/lib/html';

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
type Decision = 'approve' | 'reject';

interface PendingSchool {
    id: string;
    name: string;
    approval_status: string;
    approval_token: string | null;
    requested_by: string | null;
}

/**
 * Load the school and check the request against it. Returns the school when
 * the token is good and the decision is still open, otherwise the response
 * to send. Shared by the read-only confirmation page and the decision itself.
 */
async function loadPendingSchool(
    schoolId: string,
    action: string | null,
    token: string | null,
): Promise<{ ok: true; school: PendingSchool; action: Decision; token: string } | { ok: false; response: NextResponse }> {
    if (action !== 'approve' && action !== 'reject') {
        return { ok: false, response: NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 }) };
    }
    if (!token) {
        return { ok: false, response: NextResponse.json({ error: 'Missing token' }, { status: 401 }) };
    }

    const supabase = createSupabaseAdmin();
    const { data: school } = await supabase
        .from('schools')
        .select('id, name, approval_status, approval_token, requested_by')
        .eq('id', schoolId)
        .maybeSingle<PendingSchool>();

    if (!school) {
        return { ok: false, response: NextResponse.json({ error: 'School not found' }, { status: 404 }) };
    }

    // Already decided: the token is cleared on use, so a second click on an
    // emailed link lands here. Report the standing decision rather than erroring.
    if (school.approval_status !== 'PENDING_APPROVAL' || !school.approval_token) {
        return {
            ok: false,
            response: htmlResult(
                school.approval_status === 'APPROVED' ? 'Already approved' : 'Already decided',
                `"${school.name}" is ${String(school.approval_status).toLowerCase().replace(/_/g, ' ')}. No further action needed.`,
                school.approval_status === 'APPROVED'
            ),
        };
    }

    // Constant-time comparison (the old `!==` short-circuited on the first
    // differing character).
    if (!verifyWebhookToken(token, school.approval_token)) {
        return { ok: false, response: NextResponse.json({ error: 'Invalid token' }, { status: 403 }) };
    }

    return { ok: true, school, action, token };
}

async function decide(schoolId: string, rawAction: string | null, rawToken: string | null, note: string | null) {
    const loaded = await loadPendingSchool(schoolId, rawAction, rawToken);
    if (!loaded.ok) return loaded.response;
    const { school, action, token } = loaded;

    const supabase = createSupabaseAdmin();

    const requester = school.requested_by
        ? (await supabase.from('users').select('id, email, first_name, phone').eq('id', school.requested_by).maybeSingle()).data
        : null;

    // Each write is conditional on the token still being the one we checked,
    // so two clicks racing each other (approve and reject, or a double
    // submit) cannot both land: the loser changes nothing.
    const claimDecision = async (fields: Record<string, string | null>) => {
        const { data } = await supabase
            .from('schools')
            .update({ ...fields, approval_decided_at: new Date().toISOString(), approval_token: null })
            .eq('id', schoolId)
            .eq('approval_status', 'PENDING_APPROVAL')
            .eq('approval_token', token)
            .select('id');
        return Boolean(data && data.length > 0);
    };
    const alreadyDecided = () =>
        htmlResult('Already decided', `"${school.name}" was decided by another request. No further action needed.`, false);

    if (action === 'reject') {
        if (!(await claimDecision({ approval_status: 'REJECTED', approval_note: note }))) return alreadyDecided();

        const rejectedEmail = requester?.email;
        if (rejectedEmail) {
            after(() => sendSchoolRejectedEmail(rejectedEmail, requester?.first_name ?? null, school.name, note)
                .then(() => undefined, err => console.error('[school-approval] rejection email failed:', err)));
        }
        return htmlResult('Rejected', `"${school.name}" was rejected and stays locked out.`, false);
    }

    // ── Approve: this is the promotion to ADMIN ──
    if (!(await claimDecision({ approval_status: 'APPROVED' }))) return alreadyDecided();

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

    // Email, SMS and WhatsApp to the requester and the school's own number,
    // after the response so the owner's page isn't held up by them.
    const { data: schoolContact } = await supabase.from('schools').select('phone').eq('id', schoolId).maybeSingle();
    after(() => notifyRequesterOfApproval({
        schoolName: school.name,
        firstName: requester?.first_name ?? null,
        email: requester?.email ?? null,
        phones: [requester?.phone, schoolContact?.phone],
    }));

    return htmlResult('Approved', `"${school.name}" is now live and its administrator can sign in.`, true);
}

/**
 * A plain page for the owner, who arrives from an email client. `message` is
 * plain text: the school name in it is whatever the requester typed at
 * sign-up, and it used to be written into this page raw — a school named
 * `<script>…` ran in the owner's browser on the app's origin.
 */
function htmlPage(title: string, bodyHtml: string, accent: string) {
    return new NextResponse(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
         <meta name="robots" content="noindex">
         <title>${escapeHtml(title)}</title></head>
         <body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;box-sizing:border-box;background:#f8fafc;">
           <div style="width:100%;max-width:420px;padding:32px;text-align:center;background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.1);box-sizing:border-box;">
             <h1 style="color:${accent};font-size:20px;margin:0 0 8px;">${escapeHtml(title)}</h1>
             ${bodyHtml}
           </div>
         </body></html>`,
        {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
                'Referrer-Policy': 'no-referrer',
            },
        }
    );
}

function htmlResult(title: string, message: string, good: boolean) {
    return htmlPage(
        title,
        `<p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(message)}</p>`,
        good ? '#059669' : '#dc2626',
    );
}

/** The confirm step: a form that POSTs the decision back to this route. */
function confirmPage(schoolId: string, school: PendingSchool, action: Decision, token: string) {
    const approving = action === 'approve';
    const accent = approving ? '#059669' : '#dc2626';
    const verb = approving ? 'Approve' : 'Reject';
    const noteField = approving
        ? ''
        : `<textarea name="note" rows="3" placeholder="Reason (optional, sent to the requester)"
             style="width:100%;box-sizing:border-box;margin:16px 0 0;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:14px;"></textarea>`;
    return htmlPage(
        `${verb} this school?`,
        `<p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(`"${school.name}" is waiting for a decision.`)}</p>
         <form method="post" action="/api/platform/schools/${encodeURIComponent(schoolId)}/decision">
           <input type="hidden" name="action" value="${escapeHtml(action)}">
           <input type="hidden" name="token" value="${escapeHtml(token)}">
           ${noteField}
           <button type="submit"
             style="margin-top:16px;width:100%;padding:12px 24px;border:0;border-radius:8px;background:${accent};color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer;">
             ${verb}
           </button>
         </form>`,
        accent,
    );
}

/**
 * The emailed link lands here, and only shows a confirmation. It used to
 * decide on the spot, but mail security scanners (Outlook Safe Links,
 * Gmail's link checker) fetch every link in a message — and the approve and
 * reject links share one token, so whichever the scanner opened first
 * decided the school before the owner saw the email.
 */
export async function GET(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = await params;
    const { searchParams } = new URL(request.url);
    const loaded = await loadPendingSchool(schoolId, searchParams.get('action'), searchParams.get('token'));
    if (!loaded.ok) return loaded.response;
    return confirmPage(schoolId, loaded.school, loaded.action, loaded.token);
}

/** The decision itself: the confirmation form, or a console or script sending JSON. */
export async function POST(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = await params;
    const { searchParams } = new URL(request.url);
    const body: { action?: string; token?: string; note?: string } = {};
    const contentType = request.headers.get('content-type') || '';
    try {
        if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            for (const key of ['action', 'token', 'note'] as const) {
                const value = form.get(key);
                if (typeof value === 'string') body[key] = value;
            }
        } else {
            Object.assign(body, await request.json());
        }
    } catch { /* fall back to query params */ }
    return decide(
        schoolId,
        body.action ?? searchParams.get('action'),
        body.token ?? searchParams.get('token'),
        body.note?.trim() || searchParams.get('note')
    );
}
