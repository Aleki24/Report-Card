require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('id, name, code, academic_level_id')
    .ilike('name', '%Religious%');
    
  console.dir(subjects, { depth: null });
}

check();
