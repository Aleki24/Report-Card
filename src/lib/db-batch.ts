import { createSupabaseAdmin } from '@/lib/supabase-admin';

/** Inserts rows in chunks; PostgREST bodies have a size limit. */
export async function insertChunked(table: string, rows: Record<string, unknown>[], size = 500): Promise<void> {
    for (let i = 0; i < rows.length; i += size) {
        const { error } = await createSupabaseAdmin().from(table).insert(rows.slice(i, i + size));
        if (error) throw error;
    }
}
