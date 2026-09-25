import {
  BookOpen, Calculator, FlaskConical, Landmark, Languages, Palette, Wrench, type LucideIcon,
} from 'lucide-react';

/**
 * The Exams & Marks colour language, matching the Users page: every kind of
 * thing gets one hue, shown as a tinted icon tile, a dot, and a tinted
 * border when chosen. Full class strings so Tailwind's scanner sees them.
 */
export interface Tone {
  /** Icon tile: soft background + strong foreground. */
  tile: string;
  /** Small solid marker. */
  dot: string;
  /** Border and wash when the item is selected. */
  selected: string;
  /** Border on hover when not selected. */
  hover: string;
  /** Solid fill (step numbers once done). */
  solid: string;
}

const tone = (hue: 'sky' | 'violet' | 'emerald' | 'amber' | 'orange' | 'rose' | 'slate' | 'blue' | 'teal'): Tone => TONES[hue];

const TONES = {
  sky: { tile: 'bg-sky-500/12 text-sky-600 dark:text-sky-400', dot: 'bg-sky-500', selected: 'border-sky-500/60 bg-sky-500/[0.08]', hover: 'hover:border-sky-500/40', solid: 'bg-sky-500 text-white' },
  blue: { tile: 'bg-blue-500/12 text-blue-600 dark:text-blue-400', dot: 'bg-blue-500', selected: 'border-blue-500/60 bg-blue-500/[0.08]', hover: 'hover:border-blue-500/40', solid: 'bg-blue-500 text-white' },
  violet: { tile: 'bg-violet-500/12 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500', selected: 'border-violet-500/60 bg-violet-500/[0.08]', hover: 'hover:border-violet-500/40', solid: 'bg-violet-500 text-white' },
  emerald: { tile: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', selected: 'border-emerald-500/60 bg-emerald-500/[0.08]', hover: 'hover:border-emerald-500/40', solid: 'bg-emerald-500 text-white' },
  teal: { tile: 'bg-teal-500/12 text-teal-600 dark:text-teal-400', dot: 'bg-teal-500', selected: 'border-teal-500/60 bg-teal-500/[0.08]', hover: 'hover:border-teal-500/40', solid: 'bg-teal-500 text-white' },
  amber: { tile: 'bg-amber-500/12 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', selected: 'border-amber-500/60 bg-amber-500/[0.08]', hover: 'hover:border-amber-500/40', solid: 'bg-amber-500 text-white' },
  orange: { tile: 'bg-orange-500/12 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', selected: 'border-orange-500/60 bg-orange-500/[0.08]', hover: 'hover:border-orange-500/40', solid: 'bg-orange-500 text-white' },
  rose: { tile: 'bg-rose-500/12 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500', selected: 'border-rose-500/60 bg-rose-500/[0.08]', hover: 'hover:border-rose-500/40', solid: 'bg-rose-500 text-white' },
  slate: { tile: 'bg-slate-500/12 text-slate-600 dark:text-slate-300', dot: 'bg-slate-500', selected: 'border-slate-500/60 bg-slate-500/[0.08]', hover: 'hover:border-slate-500/40', solid: 'bg-slate-500 text-white' },
} as const satisfies Record<string, Tone>;

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

/** One hue per picker step, so the steps read as a sequence at a glance. */
export const STEP_TONES: readonly Tone[] = [tone('blue'), tone('violet'), tone('emerald'), tone('amber'), tone('rose')];

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
