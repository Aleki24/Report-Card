import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, parseBody, route } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { revokeInviteCodes } from '@/lib/invite-codes';
import { archivesLearner, promotionPlanSchema, type PromotionOverview } from '@/lib/promotion';
import { assertAdmin, assertPlanCoversSchool, loadPromotionOverview, promotionDbError } from '@/lib/promotion-server';

/** Every grade's promotion step and learners, and this year's run if it happened. */
export const GET = route('promotion GET', {}, async ({ access }): Promise<PromotionOverview> => {
    assertAdmin(access);
    return loadPromotionOverview(createSupabaseAdmin(), access.schoolId);
});

/**
 * Applies the admin's plan for every enrolled learner in one transaction:
 * promoted learners move up a class, graduates and transfers are archived.
 */
export const POST = route('promotion POST', {}, async ({ access, request }): Promise<PromotionOverview> => {
    assertAdmin(access);
    const plan = await parseBody(request, promotionPlanSchema);
    const db = createSupabaseAdmin();

    const overview = await loadPromotionOverview(db, access.schoolId);
    if (!overview.academicYear) throw new HttpError(400, 'Add this academic year under Settings → Academic calendar first.');
    if (overview.academicYear.id !== plan.academic_year_id) {
        throw new HttpError(409, 'The academic year has changed since this page was opened. Reload and check the plan again.');
    }
    if (overview.run) throw new HttpError(409, `Learners have already been promoted for ${overview.academicYear.name}. Undo that promotion first to run it again.`);
    assertPlanCoversSchool(overview, plan.decisions);

    const { data: runId, error } = await db.rpc('run_student_promotion', {
        p_school_id: access.schoolId,
        p_academic_year_id: plan.academic_year_id,
        p_actor: access.userId,
        p_decisions: plan.decisions,
    });
    if (error) throw promotionDbError(error);

    // A learner who has left can no longer activate with a code sent while enrolled.
    const archived = plan.decisions.filter(d => archivesLearner(d.outcome)).map(d => d.student_id);
    const revoked = await Promise.allSettled(archived.map(id => revokeInviteCodes(db, id)));
    const failedRevokes = revoked.filter(r => r.status === 'rejected').length;
    if (failedRevokes > 0) console.error('[promotion] invite codes not revoked for', failedRevokes, 'learner(s)');

    await audit(access, 'update', 'student_promotion_runs', runId as string, {
        academic_year_id: plan.academic_year_id,
        learners: plan.decisions.length,
        archived: archived.length,
    });
    return loadPromotionOverview(db, access.schoolId);
});
