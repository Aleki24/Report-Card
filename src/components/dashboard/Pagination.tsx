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
    <div className="flex items-center justify-between flex-wrap gap-2.5 px-5 py-3 border-t border-border text-[11px] text-muted-foreground">
      <span>Showing {start} to {end} of {totalItems}</span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-7 h-7 rounded-sm border border-border bg-card text-muted-foreground flex items-center justify-center cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {getPages().map((page, i) =>
          page === '...' ? (
            <span key={`e-${i}`} className="px-1">…</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-7 h-7 rounded-sm text-[11px] flex items-center justify-center cursor-pointer transition-all ${
                currentPage === page
                  ? 'bg-primary text-primary-foreground border-none font-bold'
                  : 'border border-border bg-card text-muted-foreground font-medium hover:bg-muted'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-7 h-7 rounded-sm border border-border bg-card text-muted-foreground flex items-center justify-center cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
