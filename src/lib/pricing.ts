/**
 * Skulbase pricing, in one place: the pricing page, the landing page, the FAQ,
 * the feature pages and school billing all read it.
 *
 * One price for every school, per term, the way schools collect fees, with
 * every module included. Paying the year (three terms) up front saves a share,
 * and a new school's first term is free, so it can run a real term before paying.
 */

export type BillingCycle = 'term' | 'year';

/** KES a term, for every school. */
export const PRICE_PER_TERM = 3_500;
/** Share saved by paying three terms at once. */
export const YEAR_DISCOUNT = 0.15;
export const TERMS_A_YEAR = 3;
export const FREE_TRIAL = 'First term free';
/** The plan name on invoices. */
export const PLAN_NAME = 'Skulbase';

/** "KES 3,500". */
export const formatKes = (amount: number): string => `KES ${Math.round(amount).toLocaleString('en-KE')}`;

/** What a school pays for the cycle chosen: one term, or three terms less the yearly saving. */
export function cyclePrice(cycle: BillingCycle): number {
  return cycle === 'term' ? PRICE_PER_TERM : Math.round(PRICE_PER_TERM * TERMS_A_YEAR * (1 - YEAR_DISCOUNT) / 100) * 100;
}

/** "KES 3,500 a term", as written everywhere on the site. */
export const TERM_PRICE = `${formatKes(PRICE_PER_TERM)} a term`;

/** The line under calls to action. */
export const PLAN_FOOTNOTE = `${FREE_TRIAL} · then ${TERM_PRICE} · every module included`;
