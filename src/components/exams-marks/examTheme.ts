import {
  BookOpen, Calculator, FlaskConical, Landmark, Languages, Palette, Wrench, type LucideIcon,
} from 'lucide-react';

import { TONES, type Tone } from '@/components/ui/tones';

export { STEP_TONES, type Tone } from '@/components/ui/tones';

const tone = (hue: keyof typeof TONES): Tone => TONES[hue];

export type SubjectCategory = 'LANGUAGE' | 'MATHEMATICS' | 'SCIENCE' | 'HUMANITY' | 'TECHNICAL' | 'CREATIVE' | 'OTHER';

export const SUBJECT_CATEGORY_THEME: Readonly<Record<SubjectCategory, { label: string; icon: LucideIcon; tone: Tone; order: number }>> = {
  LANGUAGE: { label: 'Languages', icon: Languages, tone: tone('sky'), order: 1 },
  MATHEMATICS: { label: 'Mathematics', icon: Calculator, tone: tone('violet'), order: 2 },
  SCIENCE: { label: 'Sciences', icon: FlaskConical, tone: tone('emerald'), order: 3 },
  HUMANITY: { label: 'Humanities', icon: Landmark, tone: tone('amber'), order: 4 },
  TECHNICAL: { label: 'Technical & Applied', icon: Wrench, tone: tone('orange'), order: 5 },
  CREATIVE: { label: 'Creative Arts & Sports', icon: Palette, tone: tone('rose'), order: 6 },
  OTHER: { label: 'Other subjects', icon: BookOpen, tone: tone('slate'), order: 99 },
};

/** A subject's category as stored (any case, possibly missing), mapped to a known one. */
export function subjectCategory(raw: string | null | undefined): SubjectCategory {
  const key = (raw || '').toUpperCase();
  return key in SUBJECT_CATEGORY_THEME ? (key as SubjectCategory) : 'OTHER';
}

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
