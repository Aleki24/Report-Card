import { route, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { allocateByPriority } from '@/lib/finance/billing';

export interface VoteHeadLine { voteHeadId: string | null; name: string; billed: number; collected: number; outstanding: number; spent: number }

interface InvoiceRow {
    student_id: string;
    lines: { vote_head_id: string | null; description: string; amount: number; vote_head: { name: string; priority: number } | { name: string; priority: number }[] | null }[];
}

/**
 * A term's vote-head statement: what was billed to each vote head, how much
 * of the money received it has absorbed (payments fill vote heads in
 * priority order), what is still owed, and approved spending against it.
 */
export const GET = route('billing vote head report', { module: 'fee_structures', permission: 'billing.view' }, async ({ access, request }) => {
    const termId = request.nextUrl.searchParams.get('term_id');
    if (!termId) throw new HttpError(400, 'Choose a term.');
    const db = createSupabaseAdmin();
    const { data: term, error: termError } = await db.from('terms').select('id, start_date, end_date').eq('id', termId).eq('school_id', access.schoolId).maybeSingle();
    if (termError) throw termError;
    if (!term) throw new HttpError(400, 'Unknown term.');

    const [invoices, fees, expenses] = await Promise.all([
        fetchAllRows<InvoiceRow>(() => db.from('invoices')
            .select('student_id, lines:invoice_lines(vote_head_id, description, amount, vote_head:vote_heads(name, priority))')
            .eq('school_id', access.schoolId).eq('term_id', termId).order('id')),
        fetchAllRows<{ student_id: string; paid_amount: number }>(() => db.from('student_fees').select('student_id, paid_amount').eq('school_id', access.schoolId).eq('term_id', termId).order('id')),
        access.hasModule('expenses')
            ? db.from('expenses').select('vote_head_id, amount').eq('school_id', access.schoolId).in('status', ['APPROVED', 'PAID'])
                .gte('expense_date', term.start_date as string).lte('expense_date', term.end_date as string)
            : Promise.resolve({ data: [] as { vote_head_id: string | null; amount: number }[], error: null }),
    ]);
    if (invoices.error || fees.error || expenses.error) throw invoices.error ?? fees.error ?? expenses.error;

    const paid = new Map(fees.rows.map(f => [f.student_id, Number(f.paid_amount)]));
    const totals = new Map<string, VoteHeadLine>();
    const bucket = (id: string | null, name: string) => {
        const key = id ?? `other:${name.startsWith('Transport') ? 'Transport' : name}`;
        let line = totals.get(key);
        if (!line) { line = { voteHeadId: id, name: id ? name : name.startsWith('Transport') ? 'Transport' : name, billed: 0, collected: 0, outstanding: 0, spent: 0 }; totals.set(key, line); }
        return line;
    };
    let overpaid = 0;
    for (const inv of invoices.rows) {
        const lines = inv.lines.map(l => {
            const vh = embedOne(l.vote_head);
            bucket(l.vote_head_id, vh?.name ?? l.description).billed += Number(l.amount);
            return { voteHeadId: l.vote_head_id, amount: Number(l.amount), priority: vh?.priority ?? 10_000, name: vh?.name ?? l.description };
        });
        const { allocated, overpaid: extra } = allocateByPriority(lines, paid.get(inv.student_id) ?? 0);
        overpaid += extra;
        for (const l of lines) {
            const got = allocated.get(l.voteHeadId) ?? 0;
            // Lines sharing a vote head were summed by the allocator; credit it once.
            if (got > 0) { bucket(l.voteHeadId, l.name).collected += got; allocated.set(l.voteHeadId, 0); }
        }
    }
    for (const e of expenses.data ?? []) {
        const line = [...totals.values()].find(t => t.voteHeadId === e.vote_head_id);
        if (line) line.spent += Number(e.amount);
        else if (e.vote_head_id === null) bucket(null, 'Unallocated spending').spent += Number(e.amount);
    }
    const lines = [...totals.values()].map(l => ({ ...l, outstanding: Math.max(0, l.billed - l.collected) }));
    return { lines, overpaid };
});
