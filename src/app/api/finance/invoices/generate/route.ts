import { z } from 'zod';
import { route, parseBody, HttpError, assertInSchool } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { computeFeeStatus } from '@/lib/fees';
import { pickStructure, termShare, type Residence, type StructureResidence } from '@/lib/finance/billing';
import { insertChunked } from '@/lib/db-batch';

export const maxDuration = 60;

const bodySchema = z.object({
    term_id: z.string().uuid(),
    grade_stream_id: z.string().uuid().optional(),
    /** Preview totals without writing anything. */
    dry_run: z.boolean().default(false),
});

interface StructureRow {
    id: string; name: string; academic_year_id: string; grade_id: string | null; residence: StructureResidence; term_split: number[];
    items: { vote_head_id: string; annual_amount: number; vote_head: { name: string; priority: number } | { name: string; priority: number }[] | null }[];
}
interface StudentRow {
    id: string; residence: Residence | null; current_grade_stream_id: string;
    stream: { grade_id: string } | { grade_id: string }[] | null;
}
interface Line { vote_head_id: string | null; description: string; amount: number }

/**
 * Bills a term: each active learner gets an invoice from the most specific
 * fee structure (grade and day/boarder), the term's share of each vote head,
 * plus their transport route's termly fee. The learner's fee record is set to
 * the invoice less bursaries and waivers, so payments, receipts and M-Pesa
 * keep working as before. Re-running replaces a learner's invoice for the term.
 */
export const POST = route('billing generate', { module: 'fee_structures', permission: 'billing.manage' }, async ({ access, request }) => {
    const body = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();

    const { data: term, error: termError } = await db.from('terms').select('id, academic_year_id').eq('id', body.term_id).eq('school_id', access.schoolId).maybeSingle();
    if (termError) throw termError;
    if (!term) throw new HttpError(400, 'Unknown term.');
    if (body.grade_stream_id) await assertInSchool('grade_streams', [body.grade_stream_id], access.schoolId);

    const [termsRes, structuresRes, awardsRes, feesRes, studentsRes, transportRes] = await Promise.all([
        db.from('terms').select('id').eq('academic_year_id', term.academic_year_id).eq('school_id', access.schoolId).order('start_date'),
        db.from('fee_structures')
            .select('id, name, academic_year_id, grade_id, residence, term_split, items:fee_structure_items(vote_head_id, annual_amount, vote_head:vote_heads(name, priority))')
            .eq('school_id', access.schoolId).eq('academic_year_id', term.academic_year_id),
        db.from('fee_awards').select('student_id, amount').eq('school_id', access.schoolId).eq('term_id', term.id),
        fetchAllRows<{ student_id: string; paid_amount: number }>(() => db.from('student_fees').select('student_id, paid_amount').eq('school_id', access.schoolId).eq('term_id', term.id).order('id')),
        fetchAllRows<StudentRow>(() => {
            let q = db.from('students').select('id, residence, current_grade_stream_id, stream:grade_streams(grade_id)').eq('school_id', access.schoolId).eq('status', 'ACTIVE');
            if (body.grade_stream_id) q = q.eq('current_grade_stream_id', body.grade_stream_id);
            return q.order('id');
        }),
        access.hasModule('transport')
            ? db.from('student_transport').select('student_id, route:transport_routes(name, fee_per_term)').eq('school_id', access.schoolId)
            : Promise.resolve({ data: [], error: null }),
    ]);
    for (const r of [termsRes, structuresRes, awardsRes, transportRes]) if (r.error) throw r.error;
    if (feesRes.error) throw feesRes.error;
    if (studentsRes.error) throw studentsRes.error;

    const termIndex = (termsRes.data ?? []).findIndex(t => t.id === term.id);
    const structures = (structuresRes.data ?? []) as unknown as StructureRow[];
    const awards = new Map<string, number>();
    (awardsRes.data ?? []).forEach(a => awards.set(a.student_id as string, (awards.get(a.student_id as string) ?? 0) + Number(a.amount)));
    const paid = new Map(feesRes.rows.map(f => [f.student_id, Number(f.paid_amount)]));
    const rides = new Map((transportRes.data ?? []).map(t => {
        const route = embedOne<{ name: string; fee_per_term: number }>(t.route);
        return [t.student_id as string, route] as const;
    }));

    const invoices: { student_id: string; structure_id: string | null; total: number; lines: Line[] }[] = [];
    let unbilled = 0;
    for (const s of studentsRes.rows) {
        const structure = pickStructure(structures, {
            academicYearId: term.academic_year_id as string,
            gradeId: embedOne(s.stream)?.grade_id ?? null,
            residence: s.residence ?? 'DAY',
        });
        const lines: Line[] = (structure?.items ?? [])
            .map(i => ({ vote_head_id: i.vote_head_id, description: embedOne(i.vote_head)?.name ?? 'Fees', amount: termShare(Number(i.annual_amount), structure!.term_split.map(Number), termIndex) }))
            .filter(l => l.amount > 0);
        const ride = rides.get(s.id);
        if (ride && Number(ride.fee_per_term) > 0) lines.push({ vote_head_id: null, description: `Transport — ${ride.name}`, amount: Number(ride.fee_per_term) });
        if (lines.length === 0) { unbilled++; continue; }
        invoices.push({ student_id: s.id, structure_id: structure?.id ?? null, total: lines.reduce((n, l) => n + l.amount, 0), lines });
    }

    const summary = {
        learners: invoices.length,
        unbilled,
        billed: invoices.reduce((n, i) => n + i.total, 0),
        awards: invoices.reduce((n, i) => n + (awards.get(i.student_id) ?? 0), 0),
    };
    if (body.dry_run || invoices.length === 0) return { ...summary, dry_run: true };

    const { data: saved, error: invError } = await db.from('invoices').upsert(
        invoices.map(i => ({ school_id: access.schoolId, student_id: i.student_id, term_id: term.id, structure_id: i.structure_id, total: i.total, created_by: access.userId })),
        { onConflict: 'student_id,term_id' },
    ).select('id, student_id');
    if (invError) throw invError;
    const invoiceId = new Map((saved ?? []).map(r => [r.student_id as string, r.id as string]));
    const ids = [...invoiceId.values()];
    for (let i = 0; i < ids.length; i += 500) {
        const { error } = await db.from('invoice_lines').delete().in('invoice_id', ids.slice(i, i + 500));
        if (error) throw error;
    }
    await insertChunked('invoice_lines', invoices.flatMap(i => i.lines.map(l => ({ ...l, school_id: access.schoolId, invoice_id: invoiceId.get(i.student_id) }))));

    const { error: feeError } = await db.from('student_fees').upsert(
        invoices.map(i => {
            const total = Math.max(0, i.total - (awards.get(i.student_id) ?? 0));
            return {
                school_id: access.schoolId, student_id: i.student_id, term_id: term.id, total_fee: total,
                status: computeFeeStatus(total, paid.get(i.student_id) ?? 0), updated_at: new Date().toISOString(),
            };
        }),
        { onConflict: 'student_id,term_id' },
    );
    if (feeError) throw feeError;
    await audit(access, 'create', 'invoices', term.id as string, summary);
    return { ...summary, dry_run: false };
});
