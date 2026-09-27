import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Columns in the operations modules that point at a users row. An account
 * created by an admin gets a placeholder id until the person activates it;
 * activation moves these references to the real login, as it already does
 * for teaching assignments, so a duty, parent link or driver link given
 * before activation is not lost.
 */
const USER_LINK_COLUMNS = [
    { table: 'user_duties', column: 'user_id' },
    { table: 'student_guardians', column: 'parent_user_id' },
    { table: 'transport_crew', column: 'user_id' },
    { table: 'dorms', column: 'patron_id' },
    { table: 'timetable_requirements', column: 'teacher_id' },
] as const;

const isMissingTable = (code?: string) => code === '42P01' || code === 'PGRST205';

/** Repoints every reference from one user id to another; returns the first real error. */
export async function moveUserLinks(fromUserId: string, toUserId: string): Promise<unknown> {
    const db = createSupabaseAdmin();
    for (const { table, column } of USER_LINK_COLUMNS) {
        const { error } = await db.from(table).update({ [column]: toUserId }).eq(column, fromUserId);
        if (error && !isMissingTable(error.code)) return error;
    }
    return null;
}
