import { TONES, type Tone } from '@/components/ui/tones';

export { STEP_TONES, type Tone } from '@/components/ui/tones';

const tone = (hue: keyof typeof TONES): Tone => TONES[hue];

export { SUBJECT_CATEGORY_THEME, subjectCategory, type SubjectCategory } from '@/components/ui/subjectCategories';

/** The page's three tabs. */
export const TAB_TONES = {
  setup: tone('blue'),
  results: tone('amber'),
  publish: tone('emerald'),
} as const;

/** Ways to enter marks. */
export const MODE_TONES = {
  manual: tone('blue'),
  bulk: tone('emerald'),
  scan: tone('violet'),
} as const;
