import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEATURE_MODULES, NAV_ITEMS } from './navConfig';

type MobileNavMenuProps = {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  featuresOpen: boolean;
  onToggleFeatures: () => void;
  cta: { href: string; label: string };
};

const ROW = 'flex min-h-11 w-full items-center rounded-lg px-4 text-[0.9375rem] font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none';

export function MobileNavMenu({ id, isOpen, onClose, featuresOpen, onToggleFeatures, cta }: MobileNavMenuProps) {
  if (!isOpen) return null;

  return (
    <div id={id} className="mt-4 flex max-h-[70vh] flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-card p-3 lg:hidden">
      {NAV_ITEMS.map((item) =>
        item.kind === 'link' ? (
          <Link key={item.label} href={item.href} onClick={onClose} className={ROW}>
            {item.label}
          </Link>
        ) : (
          <div key={item.label}>
            <button
              type="button"
              onClick={onToggleFeatures}
              aria-expanded={featuresOpen}
              className={cn(ROW, 'justify-between text-left', featuresOpen && 'bg-muted text-foreground')}
            >
              {item.label}
              <ChevronDown className={cn('size-4 transition-transform duration-200', featuresOpen && 'rotate-180')} aria-hidden />
            </button>

            {featuresOpen && (
              <ul className="flex flex-col gap-0.5 pt-1 pl-2">
                {FEATURE_MODULES.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <li key={mod.slug}>
                      <Link href={mod.featureHref} onClick={onClose} className={cn(ROW, 'gap-3 px-3 text-[0.8125rem]')}>
                        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                        {mod.title}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link href="/features" onClick={onClose} className={cn(ROW, 'gap-2 px-3 text-[0.8125rem] font-semibold text-primary hover:text-primary')}>
                    View all features
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Link>
                </li>
              </ul>
            )}
          </div>
        ),
      )}

      <hr className="my-1 border-border/60" />

      <Link href="/login" onClick={onClose} className={ROW}>
        Sign In
      </Link>
      <Link href="/activate" onClick={onClose} className={ROW}>
        Activate with Invite Code
      </Link>
      <Link
        href={cta.href}
        onClick={onClose}
        className="mt-1 flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-[0.9375rem] font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {cta.label}
      </Link>
    </div>
  );
}
