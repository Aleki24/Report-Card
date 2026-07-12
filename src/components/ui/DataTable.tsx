"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Render the cell. Defaults to String(row[key]). */
  render?: (row: T) => React.ReactNode;
  /** Right-align (numbers). Also applies tabular figures. */
  numeric?: boolean;
  /** Hide this column below `md` in the card layout (secondary detail). */
  hideOnMobile?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Rendered at the end of each row (buttons/menu). */
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: React.ReactNode;
  /** Which column leads the mobile card (defaults to the first column). */
  mobileTitleKey?: string;
  className?: string;
}

/**
 * Responsive data table: a real <table> from `md` up, a stacked card list
 * below — tables must never force horizontal body scroll on phones.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowActions,
  onRowClick,
  loading = false,
  emptyState,
  mobileTitleKey,
  className,
}: DataTableProps<T>) {
  const titleCol = columns.find(c => c.key === mobileTitleKey) ?? columns[0];
  const detailCols = columns.filter(c => c.key !== titleCol.key && !c.hideOnMobile);

  const cell = (col: DataTableColumn<T>, row: T) =>
    col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '');

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-bone h-12 rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-border/60 bg-card/90 p-8 text-center text-sm text-muted-foreground', className)}>
        {emptyState ?? 'Nothing here yet.'}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'border-b border-border/60 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
                    col.numeric && 'text-right',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
              {rowActions && <th className="border-b border-border/60 px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('transition-colors', onRowClick && 'cursor-pointer', 'hover:bg-muted/40')}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={cn(
                      'border-b border-border/40 px-4 py-3 text-sm text-foreground last:border-b-0 [tr:last-child_&]:border-b-0',
                      col.numeric && 'text-right tabular-nums',
                      col.className
                    )}
                  >
                    {cell(col, row)}
                  </td>
                ))}
                {rowActions && (
                  <td className="border-b border-border/40 px-4 py-3 text-right [tr:last-child_&]:border-b-0" onClick={e => e.stopPropagation()}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {rows.map(row => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              'rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-sm',
              onRowClick && 'cursor-pointer active:bg-muted/40'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-sm font-semibold text-foreground">{cell(titleCol, row)}</div>
              {rowActions && <div onClick={e => e.stopPropagation()}>{rowActions(row)}</div>}
            </div>
            {detailCols.length > 0 && (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {detailCols.map(col => (
                  <div key={col.key} className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{col.header}</dt>
                    <dd className={cn('truncate text-[13px] text-foreground', col.numeric && 'tabular-nums')}>{cell(col, row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
