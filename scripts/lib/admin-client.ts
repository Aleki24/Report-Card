/**
 * The Supabase admin client for one-off maintenance scripts.
 *
 * Three scripts in this directory each hard-coded the production service role
 * key as a string literal. That key bypasses every row-level security policy
 * on the database, it was committed, and it is therefore in the repository's
 * history for as long as the history exists — which is why the real remedy was
 * rotating it, not deleting the lines.
 *
 * This exists so there is one obvious way to get a client and no reason for
 * the next script to paste a key in again.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createAdminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        console.error(
            'Missing credentials.\n\n' +
            '  export NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"\n' +
            '  export SUPABASE_SERVICE_ROLE_KEY="<service role key>"\n\n' +
            'The service role key bypasses row-level security. Never commit it, ' +
            'and never paste it into a script.',
        );
        process.exit(1);
    }

    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
