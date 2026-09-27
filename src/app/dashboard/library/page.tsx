"use client";

import React from 'react';
import { BookOpen, BookUp, Library } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill } from '@/components/ops/StatusPill';
import { ActionButton } from '@/components/ops/ActionButton';
import { useOpsList } from '@/hooks/useOpsList';
import { date, money, personName, today } from '@/lib/ops/format';
import { BOOK_DEFAULTS, BOOK_FIELDS, LOAN_TONES, copiesOut, loanDefaults, loanFields, loanState, type Book, type Loan } from '@/lib/ops/forms/operations';

function LoansPanel({ manage }: { manage: boolean }) {
    const books = useOpsList<Book>('books');
    const fields = loanFields(books.rows);
    return (
        <ResourceManager<'loans', Loan>
            resource="loans"
            fields={fields}
            canCreate={manage}
            canEdit={manage}
            canDelete={manage}
            defaults={loanDefaults()}
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
    const outByBook = copiesOut(openLoans.rows);

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
                            defaults={BOOK_DEFAULTS}
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
