import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPages = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        padding: '12px 20px',
        borderTop: '1px solid var(--color-border-subtle)',
        fontSize: '0.6875rem',
        color: 'var(--color-text-muted)',
      }}
    >
      <span>Showing {start} to {end} of {totalItems}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 1 ? 0.4 : 1,
            transition: 'all 0.15s',
          }}
        >
          <ChevronLeft style={{ width: '14px', height: '14px' }} />
        </button>

        {getPages().map((page, i) =>
          page === '...' ? (
            <span key={`e-${i}`} style={{ padding: '0 4px' }}>…</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              style={{
                minWidth: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                border: currentPage === page ? 'none' : '1px solid var(--color-border)',
                background: currentPage === page ? 'var(--color-accent)' : 'var(--color-surface)',
                color: currentPage === page ? '#fff' : 'var(--color-text-secondary)',
                fontSize: '0.6875rem',
                fontWeight: currentPage === page ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage === totalPages ? 0.4 : 1,
            transition: 'all 0.15s',
          }}
        >
          <ChevronRight style={{ width: '14px', height: '14px' }} />
        </button>
      </div>
    </div>
  );
}
