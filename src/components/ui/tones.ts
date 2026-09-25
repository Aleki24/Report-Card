/**
 * The app's colour language, first used on the Users page: every kind of
 * thing gets one hue, shown as a tinted icon tile, a dot, and a tinted border
 * when chosen. Full class strings so Tailwind's scanner sees them.
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

export type Hue = 'sky' | 'blue' | 'violet' | 'emerald' | 'teal' | 'amber' | 'orange' | 'rose' | 'slate';

export const TONES = {
  sky: { tile: 'bg-sky-500/12 text-sky-600 dark:text-sky-400', dot: 'bg-sky-500', selected: 'border-sky-500/60 bg-sky-500/[0.08]', hover: 'hover:border-sky-500/40', solid: 'bg-sky-500 text-white' },
  blue: { tile: 'bg-blue-500/12 text-blue-600 dark:text-blue-400', dot: 'bg-blue-500', selected: 'border-blue-500/60 bg-blue-500/[0.08]', hover: 'hover:border-blue-500/40', solid: 'bg-blue-500 text-white' },
  violet: { tile: 'bg-violet-500/12 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500', selected: 'border-violet-500/60 bg-violet-500/[0.08]', hover: 'hover:border-violet-500/40', solid: 'bg-violet-500 text-white' },
  emerald: { tile: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', selected: 'border-emerald-500/60 bg-emerald-500/[0.08]', hover: 'hover:border-emerald-500/40', solid: 'bg-emerald-500 text-white' },
  teal: { tile: 'bg-teal-500/12 text-teal-600 dark:text-teal-400', dot: 'bg-teal-500', selected: 'border-teal-500/60 bg-teal-500/[0.08]', hover: 'hover:border-teal-500/40', solid: 'bg-teal-500 text-white' },
  amber: { tile: 'bg-amber-500/12 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', selected: 'border-amber-500/60 bg-amber-500/[0.08]', hover: 'hover:border-amber-500/40', solid: 'bg-amber-500 text-white' },
  orange: { tile: 'bg-orange-500/12 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', selected: 'border-orange-500/60 bg-orange-500/[0.08]', hover: 'hover:border-orange-500/40', solid: 'bg-orange-500 text-white' },
  rose: { tile: 'bg-rose-500/12 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500', selected: 'border-rose-500/60 bg-rose-500/[0.08]', hover: 'hover:border-rose-500/40', solid: 'bg-rose-500 text-white' },
  slate: { tile: 'bg-slate-500/12 text-slate-600 dark:text-slate-300', dot: 'bg-slate-500', selected: 'border-slate-500/60 bg-slate-500/[0.08]', hover: 'hover:border-slate-500/40', solid: 'bg-slate-500 text-white' },
} as const satisfies Record<Hue, Tone>;

/** One hue per numbered step, so steps read as a sequence at a glance. */
export const STEP_TONES: readonly Tone[] = [TONES.blue, TONES.violet, TONES.emerald, TONES.amber, TONES.rose];
