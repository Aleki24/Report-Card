import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data, error } = await supabase.from('users').select('*').limit(1);
    console.log('Test result:', error ? error.message : 'Success!');
  } catch (e) {
    console.log('Connection failed:', e.message);
  }
}
test();
