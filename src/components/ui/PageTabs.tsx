"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { TONES, type Hue } from './tones';
import { cn } from '@/lib/utils';

export interface PageTab<Id extends string> {
  id: Id;
  label: string;
  /** Shorter label for phones, where the full ones don't fit side by side. */
  shortLabel?: string;
  icon: LucideIcon;
  hue: Hue;
  /** A count shown beside the label. */
  badge?: number;
}

/**
 * The selected tab, kept in the URL (`?tab=`) so a refresh or shared link
 * opens the same one. An unknown or unavailable tab falls back to the first.
 */
export function useUrlTab<Id extends string>(tabs: readonly PageTab<Id>[], param = 'tab') {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get(param);
  const active = tabs.find(t => t.id === requested)?.id ?? tabs[0]?.id;

  const select = useCallback((id: Id) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(param, id);
    params.delete('search');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [param, pathname, router, searchParams]);

  return [active, select] as const;
}

interface PageTabsProps<Id extends string> {
  tabs: readonly PageTab<Id>[];
  active: Id | undefined;
  onSelect: (id: Id) => void;
  label: string;
  /** Prefix for tab and panel ids; the panel should use `${idPrefix}-panel`. */
  idPrefix: string;
  className?: string;
}

/**
 * A page's section tabs: coloured icons, arrow-key navigation, and a row
 * that scrolls sideways on phones instead of squeezing or wrapping labels.
 */
export function PageTabs<Id extends string>({ tabs, active, onSelect, label, idPrefix, className }: PageTabsProps<Id>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep the chosen tab in view when the row is scrolled.
  useEffect(() => {
    const i = tabs.findIndex(t => t.id === active);
    refs.current[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, tabs]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onSelect(tabs[next].id);
  };

  return (
    <div className={cn('-mx-4 mb-6 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden', className)}>
      <div role="tablist" aria-label={label} className="inline-flex min-w-max gap-1 rounded-2xl border border-border/70 bg-muted/40 p-1">
        {tabs.map((t, i) => {
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              ref={el => { refs.current[i] = el; }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(t.id)}
              onKeyDown={e => onKeyDown(e, i)}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4',
                selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
              )}
            >
              <span className={cn('flex size-6 items-center justify-center rounded-lg transition-colors', selected && TONES[t.hue].tile)} aria-hidden>
                <t.icon className="size-4" />
              </span>
              {t.shortLabel ? (
                <>
                  <span className="sm:hidden">{t.shortLabel}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </>
              ) : t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', selected ? TONES[t.hue].tile : 'bg-muted text-muted-foreground')}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
