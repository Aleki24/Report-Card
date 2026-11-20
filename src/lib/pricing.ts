/**
 * Skulbase pricing, in one place: the pricing page, the landing page, the FAQ,
 * the feature pages and school billing all read it.
 *
 * One price for every school, per term, the way schools collect fees, with
 * every module included.
 */

/** KES a term, for every school. */
export const PRICE_PER_TERM = 3_500;
/** The plan name on invoices. */
export const PLAN_NAME = 'Skulbase';

/** "KES 3,500". */
export const formatKes = (amount: number): string => `KES ${Math.round(amount).toLocaleString('en-KE')}`;

/** "KES 3,500 a term", as written everywhere on the site. */
export const TERM_PRICE = `${formatKes(PRICE_PER_TERM)} a term`;

/** The line under calls to action. */
export const PLAN_FOOTNOTE = `${TERM_PRICE} · every module included`;
