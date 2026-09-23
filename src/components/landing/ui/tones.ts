/**
 * Accent tones for landing cards. Each entry spells out full class names so
 * Tailwind's scanner can see them — never build these strings dynamically.
 */
export type Tone = 'primary' | 'positive' | 'caution' | 'violet';

type ToneClasses = {
  /** Foreground colour for icons, check marks and links. */
  text: string;
  /** Tinted icon tile: soft fill + hairline border. */
  tile: string;
  /** Solid-to-transparent gradient start, for accent bars. */
  bar: string;
  /** Blurred glow behind imagery. */
  glow: string;
  /** Card border on hover. */
  hoverBorder: string;
  /** Outlined button in this tone. */
  outline: string;
};

export const TONES = {
  primary: {
    text: 'text-primary',
    tile: 'bg-primary/10 border-primary/20',
    bar: 'from-primary',
    glow: 'bg-primary',
    hoverBorder: 'hover:border-primary/60',
    outline: 'border-primary/30 text-primary hover:bg-primary/10',
  },
  positive: {
    text: 'text-positive',
    tile: 'bg-positive/10 border-positive/20',
    bar: 'from-positive',
    glow: 'bg-positive',
    hoverBorder: 'hover:border-positive/60',
    outline: 'border-positive/30 text-positive hover:bg-positive/10',
  },
  caution: {
    text: 'text-caution',
    tile: 'bg-caution/10 border-caution/20',
    bar: 'from-caution',
    glow: 'bg-caution',
    hoverBorder: 'hover:border-caution/60',
    outline: 'border-caution/30 text-caution hover:bg-caution/10',
  },
  violet: {
    text: 'text-violet-500',
    tile: 'bg-violet-500/10 border-violet-500/20',
    bar: 'from-violet-500',
    glow: 'bg-violet-500',
    hoverBorder: 'hover:border-violet-500/60',
    outline: 'border-violet-500/30 text-violet-500 hover:bg-violet-500/10',
  },
} as const satisfies Record<Tone, ToneClasses>;
