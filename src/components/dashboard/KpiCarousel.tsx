"use client";

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Horizontal stat-card rail: up to 3 cards visible, ‹ › arrows scroll the rest. */
export default function KpiCarousel({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update]);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: 'smooth' });

  const arrowCls = 'absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-md transition-all hover:border-primary/50 hover:text-primary';

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {React.Children.map(children, child => (
          <div className="min-w-[72%] shrink-0 snap-start xs:min-w-[46%] md:min-w-[calc((100%-1.5rem)/3)]">{child}</div>
        ))}
      </div>
      {canLeft && (
        <button onClick={() => scroll(-1)} aria-label="Scroll stats left" className={`${arrowCls} left-1`}>
          <ChevronLeft size={18} />
        </button>
      )}
      {canRight && (
        <button onClick={() => scroll(1)} aria-label="Scroll stats right" className={`${arrowCls} right-1`}>
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}
