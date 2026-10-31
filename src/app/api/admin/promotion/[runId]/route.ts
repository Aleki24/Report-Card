import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, route } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import type { PromotionUndoResult } from '@/lib/promotion';
import { assertAdmin, promotionDbError } from '@/lib/promotion-server';

const undoRowSchema = z.object({ restored: z.number().int(), skipped: z.number().int() });

/**
 * Undoes a promotion: learners go back to the class and status they had.
 * Anyone changed by hand since is left as they are and counted as skipped.
 */
export const DELETE = route<{ runId: string }>('promotion DELETE', {}, async ({ access, params }): Promise<PromotionUndoResult> => {
    assertAdmin(access);
    if (!z.guid().safeParse(params.runId).success) throw new HttpError(400, 'Unknown promotion.');
    const db = createSupabaseAdmin();

    const { data, error } = await db.rpc('undo_student_promotion', {
        p_school_id: access.schoolId,
        p_run_id: params.runId,
        p_actor: access.userId,
    });
    if (error) throw promotionDbError(error);
    const result = undoRowSchema.parse(Array.isArray(data) ? data[0] : data);

    await audit(access, 'update', 'student_promotion_runs', params.runId, { undone: true, ...result });
    return result;
});
