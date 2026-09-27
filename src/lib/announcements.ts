import { z } from 'zod';

/** Client-safe rules and shapes shared by the Announcements page and its API. */

export const ANNOUNCEMENT_TITLE_MAX = 200;
export const ANNOUNCEMENT_CONTENT_MAX = 5000;
/** Characters of "Title: content" that go out by SMS. */
export const ANNOUNCEMENT_SMS_CHARS = 300;
/** Announcements per page of the list. */
export const ANNOUNCEMENTS_PAGE_SIZE = 20;

export const announcementSchema = z.object({
    title: z.string().trim().min(1, 'Give the announcement a title.').max(ANNOUNCEMENT_TITLE_MAX, `Keep the title under ${ANNOUNCEMENT_TITLE_MAX} characters.`),
    content: z.string().trim().min(1, 'Write the announcement.').max(ANNOUNCEMENT_CONTENT_MAX, `Keep the announcement under ${ANNOUNCEMENT_CONTENT_MAX} characters.`),
    is_important: z.boolean().default(false),
});

export const announcementCreateSchema = announcementSchema.extend({
    /** Text every guardian on file. Admin only. */
    send_sms: z.boolean().default(false),
});

export const announcementUpdateSchema = announcementSchema.partial();

export type AnnouncementFilter = 'all' | 'important' | 'mine';

export interface Announcement {
    id: string;
    title: string;
    content: string;
    isImportant: boolean;
    createdAt: string;
    postedBy: string;
    postedById: string | null;
}

export interface AnnouncementCounts { all: number; important: number; mine: number }

export interface AnnouncementsResponse {
    data: Announcement[];
    /** Pass as `before` for the next, older page; null when there is none. */
    nextCursor: string | null;
    /** Only on the first page. */
    counts?: AnnouncementCounts;
}

export interface AnnouncementSmsResult { sent: number; failed: number; total: number }

/** The text an SMS carries for an announcement, as the guardian receives it. */
export const announcementSmsText = (title: string, content: string) =>
    `${title.trim()}: ${content.trim()}`.slice(0, ANNOUNCEMENT_SMS_CHARS);
