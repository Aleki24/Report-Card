import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import {
    generateInviteCodesPDF,
    type InviteCategory,
    type InviteCodeRow,
    type InviteCodeStatus,
} from '@/lib/pdf/inviteCodesPdf';

/**
 * GET /api/admin/invite-codes/pdf
 *
 * Produces a printable directory of user invitation codes grouped by
 * category so an admin can hand each person their code in person.
 *
 * Query params:
 *   category  all | admin | teacher | student   (default: all)
 *   status    active | all                       (default: active — only codes
 *                                                 that can still be activated)
 *   format    pdf | zip                          (default: pdf; zip returns one
 *                                                 PDF per category)
 */

// Order + labels for the category grouping.
const CATEGORY_DEFS: { key: 'admin' | 'teacher' | 'student'; label: string; roles: string[] }[] = [
    { key: 'admin', label: 'Administrators', roles: ['ADMIN'] },
    { key: 'teacher', label: 'Teachers', roles: ['CLASS_TEACHER', 'SUBJECT_TEACHER'] },
    { key: 'student', label: 'Students', roles: ['STUDENT'] },
];

function resolveStatus(row: { is_used: boolean | null; expires_at: string | null }): InviteCodeStatus {
    if (row.is_used) return 'Used';
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return 'Expired';
    return 'Active';
}

function safeName(s: string): string {
    return (s || 'school').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'school';
}

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: profile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!profile?.school_id) {
            return NextResponse.json({ error: 'No school associated with your account' }, { status: 403 });
        }
        // Only admins can print the whole-school code directory.
        if (profile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only admins can print invite codes.' }, { status: 403 });
        }

        const schoolId = profile.school_id as string;
        const { searchParams } = new URL(request.url);
        const categoryParam = (searchParams.get('category') || 'all').toLowerCase();
        const statusParam = (searchParams.get('status') || 'active').toLowerCase();
        const format = (searchParams.get('format') || 'pdf').toLowerCase();
        const activeOnly = statusParam !== 'all';

        // School header info
        const { data: school } = await supabase
            .from('schools')
            .select('name, logo_url')
            .eq('id', schoolId)
            .maybeSingle();
        const schoolName = school?.name || 'School';

        // All invite codes for this school, newest first, with the owning user.
        const { data: codes, error } = await supabase
            .from('invite_codes')
            .select(`
                code, role, is_used, expires_at, created_at,
                users ( first_name, last_name, username, phone )
            `)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        // Map every code into a display row + keep its role for grouping.
        type RawCode = {
            code: string;
            role: string;
            is_used: boolean | null;
            expires_at: string | null;
            users: { first_name?: string; last_name?: string; username?: string; phone?: string } | null;
        };
        const enriched = ((codes || []) as unknown as RawCode[]).map((c) => {
            const u = c.users || {};
            const row: InviteCodeRow = {
                name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—',
                username: u.username || '—',
                phone: u.phone || '',
                code: c.code,
                status: resolveStatus(c),
                expiresAt: c.expires_at || undefined,
            };
            return { role: c.role as string, status: row.status, row };
        });

        const wantedDefs = categoryParam === 'all'
            ? CATEGORY_DEFS
            : CATEGORY_DEFS.filter(d => d.key === categoryParam);

        if (wantedDefs.length === 0) {
            return NextResponse.json({ error: `Invalid category: ${categoryParam}` }, { status: 400 });
        }

        const buildCategory = (def: typeof CATEGORY_DEFS[number]): InviteCategory => {
            const rows = enriched
                .filter(e => def.roles.includes(e.role))
                .filter(e => !activeOnly || e.status === 'Active')
                .map(e => e.row)
                .sort((a, b) => a.name.localeCompare(b.name));
            return { label: def.label, rows };
        };

        const generatedAt = new Date().toLocaleString('en-KE', {
            dateStyle: 'medium', timeStyle: 'short',
        });

        // ── ZIP: one PDF per category ────────────────────────
        if (format === 'zip') {
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            let anyRows = false;

            for (const def of wantedDefs) {
                const category = buildCategory(def);
                if (category.rows.length === 0) continue;
                anyRows = true;
                const buffer = await generateInviteCodesPDF({
                    schoolName,
                    schoolLogoUrl: school?.logo_url || undefined,
                    generatedAt,
                    categories: [category],
                });
                zip.file(`${safeName(schoolName)}_${def.key}_invite_codes.pdf`, buffer);
            }

            if (!anyRows) {
                return NextResponse.json({ error: 'No invite codes to print for the selected filters.' }, { status: 404 });
            }

            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
            return new NextResponse(new Uint8Array(zipBuffer), {
                status: 200,
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${safeName(schoolName)}_invite_codes.zip"`,
                },
            });
        }

        // ── Single combined / single-category PDF ────────────
        const categories = wantedDefs.map(buildCategory);
        const total = categories.reduce((n, c) => n + c.rows.length, 0);
        if (total === 0) {
            return NextResponse.json({ error: 'No invite codes to print for the selected filters.' }, { status: 404 });
        }

        const pdfBuffer = await generateInviteCodesPDF({
            schoolName,
            schoolLogoUrl: school?.logo_url || undefined,
            generatedAt,
            categories,
        });

        const filename = categoryParam === 'all'
            ? `${safeName(schoolName)}_invite_codes.pdf`
            : `${safeName(schoolName)}_${categoryParam}_invite_codes.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (err: unknown) {
        console.error('invite-codes pdf error:', err);
        const message = err instanceof Error ? err.message : 'Failed to generate invite codes PDF';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
