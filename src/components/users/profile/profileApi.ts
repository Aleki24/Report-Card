import { apiErrorMessage } from '@/lib/api-error-message';
import type { StudentStatus } from '@/types';

/** The student fields the profile dialog can change, as `/api/admin/update-student` takes them. */
export interface StudentDetailsUpdate {
  admission_number: string;
  gender: string;
  date_of_birth: string;
  grade_stream_id: string;
  status: StudentStatus;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
}

async function send(url: string, init: RequestInit, fallback: string): Promise<unknown> {
  const res = await fetch(url, init);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiErrorMessage(body, fallback));
  return body;
}

const patchJson = (url: string, payload: object, fallback: string) =>
  send(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, fallback);

export async function updateStudentDetails(studentId: string, update: Partial<StudentDetailsUpdate> & { avatar_url?: string }): Promise<void> {
  await patchJson('/api/admin/update-student', { student_id: studentId, ...update }, 'Could not save the student');
}

/** Staff photos live on users.avatar_url, which the teacher endpoint writes for any account in the school. */
export async function updateStaffPhoto(userId: string, avatarUrl: string): Promise<void> {
  await patchJson('/api/admin/update-teacher', { teacher_id: userId, avatar_url: avatarUrl }, 'Could not save the photo');
}

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Uploads a photo to storage and returns its public URL. Mirrors the server's type and size limits so bad files fail fast. */
export async function uploadPhoto(file: File): Promise<string> {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) throw new Error('Use a JPEG, PNG, GIF or WebP image.');
  if (file.size > PHOTO_MAX_BYTES) throw new Error('That photo is over 2 MB. Choose a smaller one.');
  const form = new FormData();
  form.append('file', file);
  const body = await send('/api/admin/upload-photo', { method: 'POST', body: form }, 'Photo upload failed');
  const url = typeof body === 'object' && body !== null && 'url' in body && typeof body.url === 'string' ? body.url : null;
  if (!url) throw new Error('Photo upload failed');
  return url;
}
