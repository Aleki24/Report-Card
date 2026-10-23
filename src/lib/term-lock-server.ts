import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { embedOne } from './postgrest';
import type { TermLock } from './exam-windows';

/**
 * A term whose marks are locked (see migration 20261023130000_term_mark_lock).
 * The database refuses the write anyway; these let the app say why first.
 * Before the migration the columns are missing and every term reads open.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export const TERM_LOCKED_MESSAGE = 'Marks for this term are locked. Ask the admin or DOS to unlock the term first.';

/** 423 Locked, with the message the sheet shows. */
export const termLockedResponse = () => NextResponse.json({ error: TERM_LOCKED_MESSAGE, code: 'term_locked' }, { status: 423 });

interface LockRow { marks_locked_at: string | null; marks_locked_by: string | null }

/** The term's lock, with who locked it by name. */
export async function readTermLock(supabase: Db, schoolId: string, termId: string): Promise<TermLock | null> {
    const { data, error } = await supabase
        .from('terms')
        .select('marks_locked_at, marks_locked_by')
        .eq('school_id', schoolId)
        .eq('id', termId)
        .maybeSingle<LockRow>();
    if (error || !data?.marks_locked_at) return null;
    let lockedBy: string | null = null;
    if (data.marks_locked_by) {
        const { data: user } = await supabase.from('users').select('first_name, last_name').eq('id', data.marks_locked_by).maybeSingle();
        lockedBy = user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || null : null;
    }
    return { lockedAt: data.marks_locked_at, lockedBy };
}

/** Whether the term an exam belongs to has its marks locked. */
export async function isExamTermLocked(supabase: Db, examId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('exams')
        .select('term_id, terms:term_id ( marks_locked_at )')
        .eq('id', examId)
        .maybeSingle<{ term_id: string; terms: { marks_locked_at: string | null } | { marks_locked_at: string | null }[] | null }>();
    if (error || !data) return false;
    return !!embedOne(data.terms)?.marks_locked_at;
}

/** The database refused a write because the term is locked (a race with locking). */
export const isTermLockedError = (error: { hint?: string | null } | null | undefined): boolean => error?.hint === 'term_locked';
