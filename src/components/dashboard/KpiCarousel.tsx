"use client";

import React from 'react';

/** Horizontal stat-card rail: up to 3 cards visible, swipe/scroll for the rest. */
export default function KpiCarousel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {React.Children.map(children, child => (
        <div className="min-w-[72%] shrink-0 snap-start xs:min-w-[46%] md:min-w-[calc((100%-1.5rem)/3)]">{child}</div>
      ))}
    </div>
  );
}
