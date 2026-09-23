/**
 * Testimonials shown on the landing page.
 *
 * Only add quotes that a real person at a real school gave you, with their
 * permission to publish their name, role and school. The section stays hidden
 * while this list is empty, so nothing placeholder ever reaches production.
 *
 * The first entry is featured as the large quote, so put the strongest there.
 *
 * Example entry:
 *   {
 *     quote: 'We used to spend two weeks on report cards. Last term it took an afternoon.',
 *     name: 'Jane Wanjiru',
 *     role: 'Deputy Principal',
 *     school: 'Example Secondary School',
 *     location: 'Nakuru',
 *     curriculum: '8-4-4',
 *     result: 'Report cards in one afternoon',
 *     photo: '/images/testimonials/jane-wanjiru.jpg',
 *   },
 */
export type Curriculum = 'CBC' | '8-4-4' | 'CBC & 8-4-4';

export type Testimonial = {
  /** Their words, verbatim — lightly trimmed at most. */
  quote: string;
  name: string;
  /** e.g. Principal, Deputy Principal, Class Teacher, Parent. */
  role: string;
  school: string;
  /** Town or county, e.g. "Kisumu". */
  location?: string;
  curriculum?: Curriculum;
  /** A short, concrete outcome they reported, shown as a highlight chip. */
  result?: string;
  /** Path under /public. Initials are shown when omitted. */
  photo?: string;
};

export const TESTIMONIALS: Testimonial[] = [];
