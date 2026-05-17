"use client";

import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function QuickStatsChart() {
  const chartData = [
    { label: 'Mon', value: 40, color: 'bg-teal-700' },
    { label: 'Tue', value: 65, color: 'bg-indigo-400' },
    { label: 'Wed', value: 85, color: 'bg-indigo-500' },
    { label: 'Thu', value: 35, color: 'bg-teal-700' },
    { label: 'Fri', value: 50, color: 'bg-indigo-400' },
  ];

  return (
    <div className="rounded-2xl border border-black/10 p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-gray-800 text-[15px]">
          Quick Stats
        </h3>
        <button className="p-1 rounded-md text-gray-500 hover:bg-black/5 transition-colors">
          <ChevronDown size={16} />
        </button>
      </div>
      
      <div className="flex items-end justify-between h-24 gap-2 px-2">
        {chartData.map((data, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
            <div className="w-full relative h-full flex items-end justify-center rounded-sm bg-muted/20 hover:bg-muted/40 transition-colors">
              <div 
                className={`w-3 sm:w-4 rounded-full ${data.color} transition-all group-hover:opacity-80`}
                style={{ height: `${data.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
