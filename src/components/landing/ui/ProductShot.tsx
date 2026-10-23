import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Real screens of the product, framed. The marketing site used to show
 * generic 3D renders (a neon "A+" grade report, a "weekly analytics" board
 * with revenue figures) that said nothing about a Kenyan school; these are
 * screenshots of the app itself, from the demo school in the user manual.
 */

interface BrowserShotProps {
  src: string;
  alt: string;
  /** The page's address, shown in the frame's bar (without the domain). */
  path: string;
  /** Load eagerly: for the first screen. */
  priority?: boolean;
  /** `sizes` for next/image. */
  sizes?: string;
  className?: string;
}

/**
 * A desktop screen in a browser window. The 16:10 screenshots are shown 4:3
 * from the right, so most of the sidebar falls away and the page itself is
 * large enough to read.
 */
export function BrowserShot({ src, alt, path, priority, sizes = '(max-width: 1024px) 100vw, 50vw', className }: BrowserShotProps) {
  return (
    <figure className={cn('overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/10 dark:shadow-black/50', className)}>
      <div className="flex items-center gap-3 border-b border-border/70 bg-muted/60 px-3.5 py-2.5" aria-hidden>
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-background/80 px-3 py-1 text-center text-[0.6875rem] text-muted-foreground">
          skulbase.com{path}
        </span>
      </div>
      <div className="relative aspect-[4/3] bg-background">
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover object-right-top" />
      </div>
    </figure>
  );
}

interface PhoneShotProps {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
}

/** A phone screen in a device frame. Screenshots are 780 × 1688. */
export function PhoneShot({ src, alt, sizes = '180px', className }: PhoneShotProps) {
  return (
    <figure className={cn('rounded-[1.75rem] border border-black/10 bg-neutral-900 p-1.5 shadow-2xl shadow-black/30 dark:border-white/10', className)}>
      <div className="relative aspect-[780/1688] overflow-hidden rounded-[1.4rem] bg-background">
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover object-top" />
      </div>
    </figure>
  );
}
