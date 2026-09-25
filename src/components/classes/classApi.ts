import { apiErrorMessage } from '@/lib/api-error-message';
import { classNames } from '@/lib/classes';

const STRUCTURE_URL = '/api/admin/academic-structure';

async function send(method: 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const json: unknown = await res.json().catch(() => null);
    throw new Error(apiErrorMessage(json, 'Something went wrong. Please try again.'));
  }
}

/**
 * Adds classes to a grade, one per stream name; no names adds the grade's
 * single class, named after the grade. Resolves to how many were made and
 * why any were refused.
 */
export async function createClasses(gradeId: string, gradeName: string, streamNames: readonly string[]): Promise<{ created: number; errors: string[] }> {
  const wanted = streamNames.length > 0 ? streamNames.map(s => classNames(gradeName, s)) : [classNames(gradeName)];
  let created = 0;
  const errors: string[] = [];
  // One at a time, so a clash on one name doesn't stop the rest.
  for (const c of wanted) {
    try {
      await send('POST', STRUCTURE_URL, { type: 'stream', grade_id: gradeId, name: c.name, full_name: c.full_name });
      created++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Could not add ${c.full_name}.`);
    }
  }
  return { created, errors };
}

export const renameClass = (id: string, name: string, fullName: string) =>
  send('PATCH', STRUCTURE_URL, { type: 'stream', id, name, full_name: fullName });

export const deleteClass = (id: string) =>
  send('DELETE', `${STRUCTURE_URL}?type=stream&id=${encodeURIComponent(id)}`);
