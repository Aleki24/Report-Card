const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const query = `
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS grading_system_id UUID REFERENCES grading_systems(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_subjects_grading_system ON subjects(grading_system_id);
  `;
  
  const { error } = await supabase.rpc('exec_sql', { query });
  if (error) {
    console.error("exec_sql RPC failed:", error.message);
  } else {
    console.log("Migration executed successfully via exec_sql!");
  }
}

run();
