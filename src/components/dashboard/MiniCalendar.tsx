"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function MiniCalendar() {
  // Static month for mockup purposes (May 2026 as in the image)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 1)); 

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Days for May 2026: May 1 is Friday. So empty days before are Sun, Mon, Tue, Wed, Thu (5 days)
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Generate grid
  const days = [];
  
  // Previous month trailing days
  const prevDays = getDaysInMonth(year, month - 1);
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: prevDays - i, isCurrentMonth: false });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, isCurrentMonth: true });
  }
  
  // Next month leading days (to fill 42 slots - 6 rows)
  const totalSlots = 42;
  const remaining = totalSlots - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, isCurrentMonth: false });
  }

  return (
    <div className="rounded-2xl border border-black/10 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-gray-800 text-[15px]">
          {monthName} {year}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 rounded-md hover:bg-black/5 text-gray-500 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="p-1 rounded-md hover:bg-black/5 text-gray-500 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-x-2 gap-y-5 mb-4 mt-2">
        {daysOfWeek.map(d => (
          <div key={d} className="text-center text-[12px] font-medium text-gray-400">
            {d}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-x-2 gap-y-5">
        {days.map((d, i) => (
          <div 
            key={i} 
            className={`
              h-8 flex items-center justify-center text-xs rounded-full cursor-pointer transition-colors
              ${d.isCurrentMonth ? 'text-foreground hover:bg-primary/10 hover:text-primary font-medium' : 'text-muted-foreground/40 font-normal'}
              ${d.day === 17 && d.isCurrentMonth ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}
            `}
          >
            {d.day}
          </div>
        ))}
      </div>
    </div>
  );
}
