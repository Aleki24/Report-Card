"use client";

import { useEffect, useState } from 'react';
import { findActiveTermId } from '@/lib/term-calendar';

export interface AcademicYearOption { id: string; name: string; start_date: string }
export interface TermOption { id: string; name: string; academic_year_id: string; start_date: string; is_current: boolean }

export interface AnalyticsPeriods {
  status: 'loading' | 'ready' | 'error';
  /** Newest first. */
  years: AcademicYearOption[];
  /** In calendar order. */
  terms: TermOption[];
}

async function getList<T>(type: string, signal: AbortSignal): Promise<T[]> {
  const res = await fetch(`/api/school/data?type=${type}`, { cache: 'no-store', signal });
  const body: unknown = await res.json();
  if (!res.ok || typeof body !== 'object' || body === null || !('data' in body) || !Array.isArray(body.data)) {
    throw new Error(`Could not load ${type}`);
  }
  return body.data as T[];
}

/** The school's academic years and terms, for the Analytics period picker. */
export function useAnalyticsPeriods(): AnalyticsPeriods {
  const [state, setState] = useState<AnalyticsPeriods>({ status: 'loading', years: [], terms: [] });

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getList<AcademicYearOption>('academic_years', controller.signal),
      getList<TermOption>('terms', controller.signal),
    ])
      .then(([years, terms]) => setState({ status: 'ready', years, terms }))
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error', years: [], terms: [] }); });
    return () => controller.abort();
  }, []);

  return state;
}

export const termsOfYear = (terms: TermOption[], yearId: string | null): TermOption[] =>
  terms.filter(t => t.academic_year_id === yearId);

/**
 * The term a class view should open on for a year: today's term if it is in
 * that year (the same pick as every other page), else the latest term that has
 * started, else the first.
 */
export function defaultTermFor(terms: TermOption[], yearId: string | null): string | null {
  const inYear = termsOfYear(terms, yearId);
  const active = findActiveTermId(terms);
  const today = new Date().toISOString().slice(0, 10);
  return inYear.find(t => t.id === active)?.id
    ?? [...inYear].reverse().find(t => t.start_date <= today)?.id
    ?? inYear[0]?.id
    ?? null;
}

/** The year the page opens on: today's term's year, else the newest. */
export function defaultYear(periods: AnalyticsPeriods): string | null {
  const active = findActiveTermId(periods.terms);
  return periods.terms.find(t => t.id === active)?.academic_year_id ?? periods.years[0]?.id ?? null;
}
