require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: assignments, error } = await supabase
    .from('subject_teacher_assignments')
    .select('subject_id, grade_id, grade_stream_id, subject_teachers(user_id, users(first_name, last_name)), subjects(name)');
    
  if (error) console.error(error);
  
  const reAssignments = (assignments || []).filter(a => a.subjects && a.subjects.name.includes('Religious'));
  console.log('Teachers assigned to Religious Education:');
  console.dir(reAssignments, { depth: null });
}

check();
