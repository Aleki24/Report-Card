require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get Religious Education subjects
  const { data: subjects, error: sErr } = await supabase
    .from('subjects')
    .select('id, name')
    .ilike('name', '%Religious%');
  
  if (sErr) console.error(sErr);
  console.log('Religious Education Subjects:', subjects);

  if (!subjects || subjects.length === 0) return;

  // Get Exams for these subjects
  const { data: exams, error: eErr } = await supabase
    .from('exams')
    .select('id, name, subject_id, grade_id, term_id')
    .in('subject_id', subjects.map(s => s.id));
  
  if (eErr) console.error(eErr);
  console.log('Exams for RE:', exams);
}

check();
