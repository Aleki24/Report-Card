import React from 'react';
import { Users } from 'lucide-react';
import { TONES, type Hue } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Colour of the icon tile; the page's colour reads best. */
  hue?: Hue;
}

export default function EmptyState({ icon, title, description, action, hue = 'blue' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className={cn('mb-4 flex size-14 items-center justify-center rounded-2xl', TONES[hue].tile)} aria-hidden>
        {icon || <Users className="size-6" />}
      </div>
      <h3 className="mb-1.5 font-sans text-[15px] font-bold text-foreground">{title}</h3>
      <p className={cn('max-w-xs text-sm leading-relaxed text-muted-foreground', action && 'mb-4')}>{description}</p>
      {action}
    </div>
  );
}
