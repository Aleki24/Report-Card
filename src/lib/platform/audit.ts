import { createSupabaseAdmin } from '@/lib/supabase-admin';
import type { Access } from './access';

export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'approve' | 'reject' | 'release' | 'download' | 'configure';

/**
 * Records who did what. Never throws: a failed audit write is logged, and the
 * action it describes has already happened, so failing the request would only
 * hide that from the user.
 */
export async function audit(
    access: Pick<Access, 'schoolId' | 'userId'>,
    action: AuditAction,
    entity: string,
    entityId: string | null,
    details: Record<string, unknown> = {},
): Promise<void> {
    const { error } = await createSupabaseAdmin().from('audit_log').insert({
        school_id: access.schoolId,
        actor_id: access.userId,
        action,
        entity,
        entity_id: entityId,
        details,
    });
    if (error) console.error('[audit]', action, entity, entityId, error);
}
