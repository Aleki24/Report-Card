"use client";

import React from 'react';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="card w-full max-w-lg" style={{ animation: 'fadeIn .2s ease', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-4">Select a Student</h2>
        <input className="input-field w-full mb-4" placeholder="Search by name or admission number..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        <div className="overflow-y-auto flex-1" style={{ maxHeight: '50vh' }}>
          {loading ? (
            <p className="text-center text-[var(--color-text-muted)] py-6 text-sm">Loading students...</p>
          ) : filteredStudents.length > 0 ? (
            <div className="flex flex-col gap-1">
              {filteredStudents.map(s => (
                <button key={s.id} className="w-full text-left px-4 py-3 rounded-md hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer" style={{ border: 'none', background: 'transparent', color: 'inherit' }} onClick={() => onSelect(s.id)}>
                  <div className="font-medium text-sm">{s.users?.first_name || '—'} {s.users?.last_name || ''}</div>
                  <div className="text-xs text-[var(--color-text-muted)] font-mono">{s.admission_number}</div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-[var(--color-text-muted)] py-6 text-sm">
              {search ? 'No searches matched.' : 'No students found.'}
            </p>
          )}
        </div>
        <div className="flex justify-end mt-4 pt-4 border-t border-[var(--color-border)]">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
