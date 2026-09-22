import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FEATURE_MODULES } from './navConfig';

type FeaturesDropdownProps = {
  id: string;
  isOpen: boolean;
  onClose: () => void;
};

export function FeaturesDropdown({ id, isOpen, onClose }: FeaturesDropdownProps) {
  if (!isOpen) return null;

  return (
    <div
      id={id}
      className="absolute top-[calc(100%+8px)] left-1/2 z-100 w-95 -translate-x-1/2 rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-black/20"
    >
      <p className="mb-1 border-b border-border/60 px-3 pt-2 pb-3 text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase">
        Platform modules
      </p>

      <ul className="max-h-[60vh] overflow-y-auto">
        {FEATURE_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <li key={mod.slug}>
              <Link
                href={mod.featureHref}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-foreground transition-colors duration-150 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.8125rem] leading-snug font-semibold">{mod.title}</span>
                  <span className="mt-px block truncate text-[0.6875rem] leading-snug text-muted-foreground">{mod.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-1 border-t border-border/60 pt-1">
        <Link
          href="/features"
          onClick={onClose}
          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-[0.8125rem] font-semibold text-primary transition-colors duration-150 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
        >
          View all features
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
