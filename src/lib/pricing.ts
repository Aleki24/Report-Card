/** The one Skulbase plan. Shown on the pricing page, the landing page and the FAQ. */
export const SCHOOL_PLAN = {
  name: 'School plan',
  price: 'KES 5,000',
  period: 'per term',
  summary: 'Everything your school needs to run marks, report cards, attendance, fees and parent communication.',
} as const;

export const PLAN_FOOTNOTE = `${SCHOOL_PLAN.price} ${SCHOOL_PLAN.period} · every module included`;
