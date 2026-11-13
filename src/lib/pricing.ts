/**
 * Skulbase pricing, in one place: the pricing page, the landing page, the FAQ
 * and the feature pages all read it.
 *
 * Every plan has every module; schools pay by size, per term, the way they
 * collect fees. A small school pays little, a big one pays more but far less
 * per learner. Paying the year (three terms) up front saves a share, and a
 * new school's first term is free, so it can run a real term before paying.
 */

export type BillingCycle = 'term' | 'year';

export interface Plan {
  id: 'small' | 'medium' | 'large';
  name: string;
  /** Learners the plan covers, inclusive. */
  upTo: number;
  /** KES a term. */
  perTerm: number;
  tagline: string;
}

export const PLANS: readonly Plan[] = [
  { id: 'small', name: 'Small school', upTo: 300, perTerm: 7_500, tagline: 'Up to 300 learners' },
  { id: 'medium', name: 'Growing school', upTo: 800, perTerm: 15_000, tagline: '301 to 800 learners' },
  { id: 'large', name: 'Large school', upTo: 1_500, perTerm: 25_000, tagline: '801 to 1,500 learners' },
];

/** Past the largest plan: a price per learner a term. */
export const PER_LEARNER_ABOVE = 18;
/** Share saved by paying three terms at once. */
export const YEAR_DISCOUNT = 0.15;
export const TERMS_A_YEAR = 3;
export const FREE_TRIAL = 'First term free';

/** "KES 15,000". */
export const formatKes = (amount: number): string => `KES ${Math.round(amount).toLocaleString('en-KE')}`;

/** The plan for a school of this size, or null past the largest (priced per learner). */
export const planFor = (learners: number): Plan | null => PLANS.find(p => learners <= p.upTo) ?? null;

/** What a school of this size pays a term, before any yearly saving. */
export function termPrice(learners: number): number {
  const plan = planFor(Math.max(1, learners));
  return plan ? plan.perTerm : Math.round(learners * PER_LEARNER_ABOVE);
}

/** What it pays for the cycle chosen: one term, or three terms less the yearly saving. */
export function cyclePrice(learners: number, cycle: BillingCycle): number {
  const term = termPrice(learners);
  return cycle === 'term' ? term : Math.round(term * TERMS_A_YEAR * (1 - YEAR_DISCOUNT) / 100) * 100;
}

/** The cheapest plan, as the "from" price everywhere else on the site. */
export const STARTING_PRICE = `${formatKes(PLANS[0].perTerm)} a term`;

/** The line under calls to action. */
export const PLAN_FOOTNOTE = `${FREE_TRIAL} · then from ${STARTING_PRICE} · every module included`;
