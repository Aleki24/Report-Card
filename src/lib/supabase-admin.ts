import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the SERVICE ROLE KEY.
 * This bypasses RLS and should ONLY be used in server-side API routes.
 * NEVER import this in client components.
 * 
 * Uses a cached singleton to avoid creating a new client on every call.
 */
let _cachedClient: SupabaseClient | null = null;

export function createSupabaseAdmin(): SupabaseClient {
    if (_cachedClient) return _cachedClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!url || !serviceKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
    }

    _cachedClient = createClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return _cachedClient;
}
