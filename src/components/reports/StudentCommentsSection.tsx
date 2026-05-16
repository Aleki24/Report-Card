"use client";

import React from 'react';

interface StudentComment {
  student_id: string;
  admission_number: string;
  student_name: string;
  comments_class_teacher: string;
  comments_principal: string;
}

interface StudentCommentsSectionProps {
  isConfigured: boolean;
  showComments: boolean;
  setShowComments: (v: boolean) => void;
  loadingComments: boolean;
  studentComments: StudentComment[];
  filteredComments: StudentComment[];
  commentSearch: string;
  setCommentSearch: (v: string) => void;
  savingCommentId: string | null;
  onSaveComment: (sc: StudentComment) => void;
  onSaveAllComments: () => void;
  onUpdateComment: (studentId: string, field: 'comments_class_teacher' | 'comments_principal', value: string) => void;
}

export function StudentCommentsSection({
  isConfigured, showComments, setShowComments, loadingComments,
  studentComments, filteredComments, commentSearch, setCommentSearch,
  savingCommentId, onSaveComment, onSaveAllComments, onUpdateComment,
}: StudentCommentsSectionProps) {
  if (!isConfigured) return null;

  return (
    <div className="card mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold font-[family-name:var(--font-display)]">📝 Student Comments</h3>
          <p className="text-sm text-muted-foreground mt-1">Add class teacher and principal comments for each student. These appear on PDF report cards.</p>
        </div>
        <button className="btn-secondary text-sm" onClick={() => setShowComments(!showComments)}>
          {showComments ? 'Hide Comments ▲' : 'Show Comments ▼'}
        </button>
      </div>

      {showComments && (
        <>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4">
            <input className="input-field flex-1" placeholder="Search students by name or admission number..." value={commentSearch} onChange={e => setCommentSearch(e.target.value)} />
            <button className="btn-primary text-sm whitespace-nowrap disabled:opacity-50" onClick={onSaveAllComments} disabled={savingCommentId === 'all' || studentComments.length === 0}>
              {savingCommentId === 'all' ? 'Saving All…' : `💾 Save All (${studentComments.length})`}
            </button>
          </div>

          {loadingComments ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 rounded-full border-3 border-border border-t-blue-600 animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading students…</p>
            </div>
          ) : filteredComments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              {commentSearch ? 'No students match your search.' : 'No students found in this class.'}
            </p>
          ) : (
            <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1">
              {filteredComments.map(sc => (
                <div key={sc.student_id} className="p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-semibold text-sm">{sc.student_name}</span>
                      <span className="text-xs text-muted-foreground ml-2 font-mono">{sc.admission_number}</span>
                    </div>
                    <button className="btn-secondary text-xs py-1 px-3 disabled:opacity-50" onClick={() => onSaveComment(sc)} disabled={savingCommentId === sc.student_id}>
                      {savingCommentId === sc.student_id ? 'Saving…' : '💾 Save'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Class Teacher&apos;s Comment</label>
                      <textarea className="input-field w-full text-sm" rows={2} placeholder="e.g. Excellent progress this term..." value={sc.comments_class_teacher} onChange={e => onUpdateComment(sc.student_id, 'comments_class_teacher', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Principal&apos;s Comment</label>
                      <textarea className="input-field w-full text-sm" rows={2} placeholder="e.g. Keep up the good work..." value={sc.comments_principal} onChange={e => onUpdateComment(sc.student_id, 'comments_principal', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
