"use client";

import React from 'react';
import { BookOpen, BookUp, Library } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill, type PillTone } from '@/components/ops/StatusPill';
import { ActionButton } from '@/components/ops/ActionButton';
import type { FieldDef, FieldName } from '@/components/ops/fields';
import { useOpsList } from '@/hooks/useOpsList';
import { date, daysUntil, money, personName, today } from '@/lib/ops/format';
import type { PersonName } from '@/lib/ops/resource';

interface Book { id: string; title: string; author: string | null; isbn: string | null; category: string | null; shelf: string | null; copies_total: number }
interface Loan { id: string; book_id: string; issued_on: string; due_on: string; returned_on: string | null; fine_amount: number; book: { title: string; author: string | null } | null; borrower: PersonName | null }

type LoanState = 'OUT' | 'OVERDUE' | 'RETURNED';
const LOAN_TONES: Record<LoanState, PillTone> = { OUT: 'info', OVERDUE: 'bad', RETURNED: 'good' };
const loanState = (l: Loan): LoanState => (l.returned_on ? 'RETURNED' : (daysUntil(l.due_on) ?? 0) < 0 ? 'OVERDUE' : 'OUT');
const inTwoWeeks = () => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

const BOOK_FIELDS: readonly FieldDef<FieldName<'books'>>[] = [
    { name: 'title', label: 'Title', kind: 'text', required: true, span: 'full' },
    { name: 'author', label: 'Author', kind: 'text' },
    { name: 'isbn', label: 'ISBN', kind: 'text' },
    { name: 'category', label: 'Category', kind: 'text', hint: 'Class text, set book, reference, fiction…' },
    { name: 'shelf', label: 'Shelf', kind: 'text' },
    { name: 'copies_total', label: 'Copies', kind: 'number', required: true },
];

function LoansPanel({ manage }: { manage: boolean }) {
    const books = useOpsList<Book>('books');
    const fields: readonly FieldDef<FieldName<'loans'>>[] = [
        { name: 'book_id', label: 'Book', kind: 'options', options: books.rows.map(b => ({ id: b.id, label: b.title, hint: b.author ?? undefined })), required: true, span: 'full' },
        { name: 'borrower_id', label: 'Borrower', kind: 'lookup', lookup: 'people', required: true, span: 'full' },
        { name: 'issued_on', label: 'Issued', kind: 'date', required: true },
        { name: 'due_on', label: 'Due back', kind: 'date', required: true },
        { name: 'fine_amount', label: 'Fine (KES)', kind: 'number' },
    ];
    return (
        <ResourceManager<'loans', Loan>
            resource="loans"
            fields={fields}
            canCreate={manage}
            canEdit={manage}
            canDelete={manage}
            defaults={{ issued_on: today(), due_on: inTwoWeeks(), fine_amount: '0' }}
            addLabel="Issue book"
            searchText={l => `${l.book?.title} ${personName(l.borrower)}`}
            header={rows => {
                const out = rows.filter(r => !r.returned_on);
                const overdue = out.filter(r => loanState(r) === 'OVERDUE').length;
                return (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatTile icon={BookUp} label="Out now" value={out.length} hue="blue" />
                        <StatTile icon={BookOpen} label="Overdue" value={overdue} tone={overdue > 0 ? 'bad' : 'good'} />
                    </div>
                );
            }}
            rowActions={(l, reload) => (manage && !l.returned_on ? (
                <ActionButton url={`/api/ops/loans/${l.id}`} method="PATCH" body={{ returned_on: today() }} success="Returned." onDone={reload} variant="outline">Returned</ActionButton>
            ) : null)}
            columns={[
                { key: 'book', header: 'Book', render: l => <span className="font-medium">{l.book?.title}</span> },
                { key: 'who', header: 'Borrower', render: l => personName(l.borrower) },
                { key: 'due', header: 'Due', render: l => date(l.due_on) },
                { key: 'fine', header: 'Fine', hideOnMobile: true, numeric: true, render: l => (Number(l.fine_amount) > 0 ? money(l.fine_amount) : '—') },
                { key: 'state', header: 'Status', render: l => <StatusPill status={loanState(l)} tones={LOAN_TONES} /> },
            ]}
        />
    );
}

export default function LibraryPage() {
    const { can } = useAuth();
    const manage = can('library.manage');
    const openLoans = useOpsList<Loan>('loans', { open: '1' }, { enabled: manage });
    const outByBook = new Map<string, number>();
    openLoans.rows.forEach(l => outByBook.set(l.book_id, (outByBook.get(l.book_id) ?? 0) + 1));

    return (
        <ModulePage
            module="library"
            title="Library"
            eyebrow="Operations"
            description="The catalogue, what is out and who has it, and overdue books."
            icon={Library}
            hue="teal"
            tabs={[
                {
                    id: 'catalogue', label: 'Catalogue', icon: Library, hue: 'teal',
                    render: () => (
                        <ResourceManager<'books', Book>
                            resource="books"
                            fields={BOOK_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            canDelete={manage}
                            defaults={{ copies_total: '1' }}
                            searchText={b => `${b.title} ${b.author ?? ''} ${b.isbn ?? ''} ${b.category ?? ''}`}
                            columns={[
                                { key: 'title', header: 'Title', render: b => <span className="font-medium">{b.title}</span> },
                                { key: 'author', header: 'Author', hideOnMobile: true, render: b => b.author ?? '—' },
                                { key: 'cat', header: 'Category', hideOnMobile: true, render: b => b.category ?? '—' },
                                { key: 'avail', header: 'Available', numeric: true, render: b => (manage ? `${b.copies_total - (outByBook.get(b.id) ?? 0)} / ${b.copies_total}` : b.copies_total) },
                            ]}
                        />
                    ),
                },
                { id: 'loans', label: 'Loans', icon: BookUp, hue: 'blue', visible: manage, render: () => <LoansPanel manage={manage} /> },
            ]}
        />
    );
}
