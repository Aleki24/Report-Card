import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase URL or service role key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Drop NOT NULL constraint on admission_number using RPC if possible
    // (If no RPC, user must do it manually)
    
    // 1. Get schools
    const { data: schools, error: schoolErr } = await supabase.from('schools').select('id, name');
    console.log("Schools:", schools, schoolErr);
    
    // 2. Get academic levels
    const { data: levels, error: levelErr } = await supabase.from('academic_levels').select('*');
    console.log("Levels:", levels, levelErr);
}

main().catch(console.error);
