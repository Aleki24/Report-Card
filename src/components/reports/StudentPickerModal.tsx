"use client";

import React from 'react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { Search, X } from 'lucide-react';

interface StudentOption {
  id: string;
  admission_number: string;
  users: { first_name: string; last_name: string } | null;
}

interface StudentPickerModalProps {
  students: StudentOption[];
  filteredStudents: StudentOption[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function StudentPickerModal({ students, filteredStudents, loading, search, setSearch, onSelect, onClose }: StudentPickerModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-lg font-bold font-display">Select a Student</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground"><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-5">
          <div className="flex items-center input-field overflow-hidden px-0 mb-4">
            <span className="flex items-center justify-center pl-2.5 text-muted-foreground shrink-0">
              <Search size={16} />
            </span>
            <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-xs" placeholder="Search by name or admission number..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Loading students...</p>
          ) : filteredStudents.length > 0 ? (
            <div className="flex flex-col gap-1">
              {filteredStudents.map(s => (
                <button key={s.id} className="w-full text-left px-4 py-3 rounded-lg hover:bg-muted transition-colors cursor-pointer border-none bg-transparent text-inherit flex items-center gap-3" onClick={() => onSelect(s.id)}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {(s.users?.first_name?.[0] || '?').toUpperCase()}{(s.users?.last_name?.[0] || '').toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{s.users?.first_name || '—'} {s.users?.last_name || ''}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{s.admission_number}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-6 text-sm">
              {search ? 'No students match your search.' : 'No students found.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
