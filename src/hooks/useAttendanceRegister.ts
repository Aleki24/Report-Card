"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiErrorMessage } from '@/lib/api-error-message';
import { localIsoDate } from '@/lib/dates';
import type { AttendanceRosterEntry, AttendanceStatus, AttendanceStream, NotifyResult } from '@/lib/attendance';

const LAST_STREAM_KEY = 'attendance:last-stream';

type Mark = Pick<AttendanceRosterEntry, 'status' | 'notes'>;

type StreamsState =
  | { state: 'loading' }
  | { state: 'ready'; streams: AttendanceStream[] }
  | { state: 'error'; message: string };

/** The last register response, tagged with the class and day it is for. */
type RosterResult =
  | { key: string; ok: true }
  | { key: string; ok: false; message: string };

function readLastStream(): string | null {
  try { return localStorage.getItem(LAST_STREAM_KEY); } catch { return null; }
}

function rememberStream(id: string): void {
  try { localStorage.setItem(LAST_STREAM_KEY, id); } catch { /* storage blocked: nothing to remember */ }
}

const sameMark = (a: Mark | undefined, b: Mark) => !!a && a.status === b.status && (a.notes ?? '') === (b.notes ?? '');

/**
 * State for the daily register: which class and day, the students on it, the
 * marks as saved and as edited, and saving / notifying.
 */
export function useAttendanceRegister() {
  const [streamsState, setStreamsState] = useState<StreamsState>({ state: 'loading' });
  const [streamId, setStreamIdState] = useState('');
  const [date, setDate] = useState(() => localIsoDate());
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<RosterResult | null>(null);
  const [entries, setEntries] = useState<AttendanceRosterEntry[]>([]);
  const [saved, setSaved] = useState<Map<string, Mark>>(new Map());
  const [saving, setSaving] = useState(false);

  const loadStreams = useCallback(async () => {
    setStreamsState({ state: 'loading' });
    try {
      const res = await fetch('/api/school/attendance/streams');
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load your classes.'));
      const streams = ((json as { data?: AttendanceStream[] } | null)?.data) ?? [];
      setStreamsState({ state: 'ready', streams });
      // One class (a class teacher's own) opens straight away; otherwise the
      // class used last time, if it is still on the list.
      const last = readLastStream();
      const initial = streams.length === 1 ? streams[0].id : streams.find(s => s.id === last)?.id;
      if (initial) setStreamIdState(prev => prev || initial);
    } catch (err) {
      setStreamsState({ state: 'error', message: err instanceof Error ? err.message : 'Could not load your classes.' });
    }
  }, []);

  useEffect(() => {
    void loadStreams();
  }, [loadStreams]);

  const key = streamId ? `${streamId}|${date}|${reloadToken}` : '';

  useEffect(() => {
    if (!streamId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ stream_id: streamId, date });
    fetch(`/api/school/attendance?${params.toString()}`, { signal: controller.signal })
      .then(async res => {
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load the register.'));
        const data = ((json as { data?: AttendanceRosterEntry[] } | null)?.data) ?? [];
        setEntries(data);
        setSaved(new Map(data.map(e => [e.id, { status: e.status, notes: e.notes }])));
        setResult({ key, ok: true });
      })
      .catch((err: unknown) => {
        // A newer class or day replaced this request; its own result will land.
        if (controller.signal.aborted) return;
        setResult({ key, ok: false, message: err instanceof Error ? err.message : 'Could not load the register.' });
      });
    return () => controller.abort();
  }, [key, streamId, date]);

  const loading = !!streamId && result?.key !== key;
  const loadError = !loading && result && !result.ok ? result.message : null;

  const setStreamId = useCallback((id: string) => {
    setStreamIdState(id);
    if (id) rememberStream(id);
  }, []);

  const reload = useCallback(() => setReloadToken(t => t + 1), []);

  const dirtyIds = useMemo(
    () => new Set(entries.filter(e => !sameMark(saved.get(e.id), e)).map(e => e.id)),
    [entries, saved],
  );
  const isDirty = dirtyIds.size > 0;

  const updateEntry = useCallback((id: string, patch: Partial<Mark>) => {
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const setStatus = useCallback((id: string, status: AttendanceStatus) => updateEntry(id, { status }), [updateEntry]);
  const setNote = useCallback((id: string, notes: string) => updateEntry(id, { notes }), [updateEntry]);

  const revert = useCallback((id: string) => {
    const mark = saved.get(id);
    if (mark) updateEntry(id, mark);
  }, [saved, updateEntry]);

  const revertAll = useCallback(() => {
    setEntries(prev => prev.map(e => ({ ...e, ...(saved.get(e.id) ?? {}) })));
  }, [saved]);

  /** Marks everyone not yet marked as present; never overwrites a mark already made. */
  const markUnmarkedPresent = useCallback(() => {
    setEntries(prev => prev.map(e => (e.status ? e : { ...e, status: 'present' })));
  }, []);

  /** Saves every changed, marked student. Resolves to how many were saved, or throws. */
  const save = useCallback(async (): Promise<number> => {
    const changed = entries.filter(e => dirtyIds.has(e.id) && e.status);
    if (changed.length === 0) return 0;
    setSaving(true);
    try {
      const res = await fetch('/api/school/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          stream_id: streamId,
          records: changed.map(e => ({ student_id: e.id, status: e.status, notes: e.notes?.trim() || null })),
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not save attendance.'));
      setSaved(prev => {
        const next = new Map(prev);
        for (const e of changed) next.set(e.id, { status: e.status, notes: e.notes?.trim() || null });
        return next;
      });
      // Show notes as stored (trimmed), so they no longer count as changed.
      setEntries(prev => prev.map(e => (dirtyIds.has(e.id) && e.status ? { ...e, notes: e.notes?.trim() || null } : e)));
      return changed.length;
    } finally {
      setSaving(false);
    }
  }, [entries, dirtyIds, date, streamId]);

  /** Texts guardians of the students saved as absent for this class and day. */
  const notifyGuardians = useCallback(async (): Promise<NotifyResult> => {
    const res = await fetch('/api/school/attendance/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, stream_id: streamId }),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not notify guardians.'));
    return json as NotifyResult;
  }, [date, streamId]);

  // Closing or reloading the tab with unsaved marks asks first.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const streams = streamsState.state === 'ready' ? streamsState.streams : [];

  return {
    streamsState, streams, streamId, setStreamId, date, setDate,
    entries, loading, loadError, reload,
    dirtyIds, isDirty, saving,
    setStatus, setNote, revert, revertAll, markUnmarkedPresent, save, notifyGuardians,
    loadStreams,
  };
}
