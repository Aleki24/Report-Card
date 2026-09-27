import { HttpError, assertInSchool, type Access } from '@/lib/platform/access';

/**
 * Patrons scoped to particular dorms work only in those; matrons and anyone
 * managing boarding work in every dorm.
 */
export async function assertDormAccess(access: Access, dormId: string): Promise<void> {
    await assertInSchool('dorms', [dormId], access.schoolId);
    if (access.can('boarding.manage')) return;
    const scoped = access.scopeIds('PATRON');
    if (scoped.length > 0 && !scoped.includes(dormId)) throw new HttpError(403, 'That dorm is not one of yours.');
}
