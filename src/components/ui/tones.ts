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
  /** Coloured text (eyebrows, figures). */
  text: string;
  /** Gradient fill with a soft matching shadow, for a page's header tile. */
  gradient: string;
}

export type Hue = 'sky' | 'blue' | 'violet' | 'emerald' | 'teal' | 'amber' | 'orange' | 'rose' | 'slate';

export const TONES = {
  sky: { tile: 'bg-sky-500/12 text-sky-600 dark:text-sky-400', dot: 'bg-sky-500', selected: 'border-sky-500/60 bg-sky-500/[0.08]', hover: 'hover:border-sky-500/40', solid: 'bg-sky-500 text-white', text: 'text-sky-600 dark:text-sky-400', gradient: 'from-sky-500 to-blue-500 shadow-sky-500/25' },
  blue: { tile: 'bg-blue-500/12 text-blue-600 dark:text-blue-400', dot: 'bg-blue-500', selected: 'border-blue-500/60 bg-blue-500/[0.08]', hover: 'hover:border-blue-500/40', solid: 'bg-blue-500 text-white', text: 'text-blue-600 dark:text-blue-400', gradient: 'from-blue-500 to-violet-500 shadow-blue-500/25' },
  violet: { tile: 'bg-violet-500/12 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500', selected: 'border-violet-500/60 bg-violet-500/[0.08]', hover: 'hover:border-violet-500/40', solid: 'bg-violet-500 text-white', text: 'text-violet-600 dark:text-violet-400', gradient: 'from-violet-500 to-fuchsia-500 shadow-violet-500/25' },
  emerald: { tile: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', selected: 'border-emerald-500/60 bg-emerald-500/[0.08]', hover: 'hover:border-emerald-500/40', solid: 'bg-emerald-500 text-white', text: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500 to-teal-400 shadow-emerald-500/25' },
  teal: { tile: 'bg-teal-500/12 text-teal-600 dark:text-teal-400', dot: 'bg-teal-500', selected: 'border-teal-500/60 bg-teal-500/[0.08]', hover: 'hover:border-teal-500/40', solid: 'bg-teal-500 text-white', text: 'text-teal-600 dark:text-teal-400', gradient: 'from-teal-500 to-cyan-500 shadow-teal-500/25' },
  amber: { tile: 'bg-amber-500/12 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', selected: 'border-amber-500/60 bg-amber-500/[0.08]', hover: 'hover:border-amber-500/40', solid: 'bg-amber-500 text-white', text: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500 to-orange-400 shadow-amber-500/25' },
  orange: { tile: 'bg-orange-500/12 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', selected: 'border-orange-500/60 bg-orange-500/[0.08]', hover: 'hover:border-orange-500/40', solid: 'bg-orange-500 text-white', text: 'text-orange-600 dark:text-orange-400', gradient: 'from-orange-500 to-rose-400 shadow-orange-500/25' },
  rose: { tile: 'bg-rose-500/12 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500', selected: 'border-rose-500/60 bg-rose-500/[0.08]', hover: 'hover:border-rose-500/40', solid: 'bg-rose-500 text-white', text: 'text-rose-600 dark:text-rose-400', gradient: 'from-rose-500 to-pink-500 shadow-rose-500/25' },
  slate: { tile: 'bg-slate-500/12 text-slate-600 dark:text-slate-300', dot: 'bg-slate-500', selected: 'border-slate-500/60 bg-slate-500/[0.08]', hover: 'hover:border-slate-500/40', solid: 'bg-slate-500 text-white', text: 'text-slate-600 dark:text-slate-300', gradient: 'from-slate-600 to-slate-400 shadow-slate-500/25' },
} as const satisfies Record<Hue, Tone>;

/** One hue per numbered step, so steps read as a sequence at a glance. */
export const STEP_TONES: readonly Tone[] = [TONES.blue, TONES.violet, TONES.emerald, TONES.amber, TONES.rose];
