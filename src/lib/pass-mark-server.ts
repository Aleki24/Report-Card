import type { SupabaseClient } from '@supabase/supabase-js';
import { passMarkOrDefault } from './pass-mark';

/**
 * The school's pass mark, or the default when it has none or the read fails.
 * Kept apart from pass-mark.ts, which the phone app imports and which must
 * not depend on the web's packages.
 */
export async function getSchoolPassMark(supabase: SupabaseClient, schoolId: string): Promise<number> {
    const { data } = await supabase.from('schools').select('pass_mark').eq('id', schoolId).maybeSingle();
    return passMarkOrDefault(data?.pass_mark);
}
