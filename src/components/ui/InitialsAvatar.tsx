import React from 'react';
import { cn } from '@/lib/utils';

/* Same gradients as the Users page role avatars, so people look alike across pages. */
const GRADIENTS = [
  'from-rose-500 to-orange-400',
  'from-blue-500 to-cyan-400',
  'from-violet-500 to-fuchsia-400',
  'from-sky-500 to-teal-400',
  'from-emerald-500 to-lime-400',
  'from-amber-500 to-yellow-400',
] as const;

/** A stable pick from the palette, so a person keeps their colour on every visit. */
function gradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

interface InitialsAvatarProps {
  name: string;
  /** What keeps the colour stable; defaults to the name. */
  seed?: string;
  className?: string;
}

/** Decorative initials in a coloured circle; the name beside it is what screen readers use. */
export function InitialsAvatar({ name, seed, className }: InitialsAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn('flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white', gradientFor(seed ?? name), className)}
    >
      {initialsOf(name)}
    </span>
  );
}
