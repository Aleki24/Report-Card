import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { route } from '@/lib/platform/access';
import { loadFeesOverview } from '@/lib/fee-overview-server';
import type { FeesOverview } from '@/lib/fee-overview';

/** GET: this term against last term, what is owed by class, and the fees health check. */
export const GET = route('fees overview', { module: 'fees', permission: 'fees.view' }, async ({ access }): Promise<FeesOverview> =>
    loadFeesOverview(createSupabaseAdmin(), access.schoolId));
