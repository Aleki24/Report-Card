"use client";

import React from 'react';
import { Button, Card, CardContent } from '@/components/ui';
import { MessageSquareText, ChevronDown, ChevronUp, Search, Save, Loader2 } from 'lucide-react';

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
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-primary" />
            <h3 className="text-[15px] font-semibold font-display">Student Comments</h3>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowComments(!showComments)}>
            {showComments ? <><ChevronUp className="w-3.5 h-3.5" /> Hide</> : <><ChevronDown className="w-3.5 h-3.5" /> Show</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Add class teacher and principal comments for each student. These appear on PDF report cards.</p>

        {showComments && (
          <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
              <div className="flex items-center input-field overflow-hidden px-0 flex-1">
                <span className="flex items-center justify-center pl-2.5 text-muted-foreground shrink-0">
                  <Search size={16} />
                </span>
                <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-xs" placeholder="Search students by name or admission number..." value={commentSearch} onChange={e => setCommentSearch(e.target.value)} />
              </div>
              <Button variant="primary" size="sm" onClick={onSaveAllComments} disabled={savingCommentId === 'all' || studentComments.length === 0} className="whitespace-nowrap">
                {savingCommentId === 'all' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving All...</> : <><Save className="w-3.5 h-3.5" /> Save All ({studentComments.length})</>}
              </Button>
            </div>

            {loadingComments ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Loading students...</p>
              </div>
            ) : filteredComments.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                {commentSearch ? 'No students match your search.' : 'No students found in this class.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredComments.map(sc => (
                  <div key={sc.student_id} className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                          {(sc.student_name?.[0] || '?').toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-sm">{sc.student_name}</span>
                          <span className="text-[11px] text-muted-foreground ml-2 font-mono">{sc.admission_number}</span>
                        </div>
                      </div>
                      <Button variant="secondary" size="xs" onClick={() => onSaveComment(sc)} disabled={savingCommentId === sc.student_id}>
                        {savingCommentId === sc.student_id ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><Save className="w-3 h-3" /> Save</>}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Class Teacher&apos;s Comment</label>
                        <textarea className="input-field w-full text-sm" rows={2} placeholder="e.g. Excellent progress this term..." value={sc.comments_class_teacher} onChange={e => onUpdateComment(sc.student_id, 'comments_class_teacher', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Principal&apos;s Comment</label>
                        <textarea className="input-field w-full text-sm" rows={2} placeholder="e.g. Keep up the good work..." value={sc.comments_principal} onChange={e => onUpdateComment(sc.student_id, 'comments_principal', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
