import React from 'react';
import { date, money, personName, today } from '@shared/ops/format';
import { BOOK_DEFAULTS, BOOK_FIELDS, LOAN_TONES, copiesOut, loanDefaults, loanFields, loanState, type Book, type Loan } from '@shared/ops/forms/operations';
import { StatGrid, StatTile } from '@/components/ui';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { ActionButton, StatusPill, toneColor } from '@/components/ops/bits';
import { useOpsList } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';

function Loans({ manage }: { manage: boolean }) {
    const books = useOpsList<Book>('books');
    return (
        <ResourceList<'loans', Loan>
            resource="loans"
            fields={loanFields(books.rows)}
            canCreate={manage}
            canEdit={manage}
            canDelete={manage}
            defaults={loanDefaults()}
            addLabel="Issue book"
            searchText={(l) => `${l.book?.title} ${personName(l.borrower)}`}
            header={(rows) => {
                const out = rows.filter((r) => !r.returned_on);
                const overdue = out.filter((r) => loanState(r) === 'OVERDUE').length;
                return (
                    <StatGrid>
                        <StatTile label="Out now" value={out.length} />
                        <StatTile label="Overdue" value={overdue} tone={toneColor(overdue > 0 ? 'bad' : 'good')} />
                    </StatGrid>
                );
            }}
            title={(l) => l.book?.title ?? 'Book'}
            subtitle={(l) => personName(l.borrower)}
            badge={(l) => <StatusPill status={loanState(l)} tones={LOAN_TONES} />}
            details={(l) => [
                ['Due', date(l.due_on)],
                ['Fine', Number(l.fine_amount) > 0 ? money(l.fine_amount) : '—'],
            ]}
            rowActions={(l, reload) => (manage && !l.returned_on ? (
                <ActionButton path={`/api/ops/loans/${l.id}`} method="PATCH" body={{ returned_on: today() }} success="Returned." onDone={reload} variant="secondary" label="Returned" />
            ) : null)}
        />
    );
}

export default function LibraryScreen() {
    const { can } = useCurrentUser();
    const manage = can('library.manage');
    const openLoans = useOpsList<Loan>('loans', { open: '1' }, { enabled: manage });
    const outByBook = copiesOut(openLoans.rows);

    return (
        <ModuleScreen
            screen="library"
            title="Library"
            description="The catalogue, what is out and who has it, and overdue books."
            tabs={[
                {
                    id: 'catalogue',
                    label: 'Catalogue',
                    render: () => (
                        <ResourceList<'books', Book>
                            resource="books"
                            fields={BOOK_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            canDelete={manage}
                            defaults={BOOK_DEFAULTS}
                            searchText={(b) => `${b.title} ${b.author ?? ''} ${b.isbn ?? ''} ${b.category ?? ''}`}
                            title={(b) => b.title}
                            subtitle={(b) => b.author}
                            details={(b) => [
                                ['Category', b.category ?? '—'],
                                ['Shelf', b.shelf ?? '—'],
                                ['Available', manage ? `${b.copies_total - (outByBook.get(b.id) ?? 0)} / ${b.copies_total}` : b.copies_total],
                            ]}
                        />
                    ),
                },
                { id: 'loans', label: 'Loans', visible: manage, render: () => <Loans manage={manage} /> },
            ]}
        />
    );
}
