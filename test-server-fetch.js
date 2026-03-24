require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const schoolId = 'fbb9dfd4-174f-4d71-83c3-996b564cd019';
  const streamId = 'bb363bd1-e5e2-426f-bfcc-87f75fb9e14b';
  const gradeId = 'ab195522-1608-4d0a-be3a-0e175acec47f';

  let query = supabase
    .from('exams')
    .select(`
      id, name, exam_type, max_score, grade_stream_id, grade_id, subject_id,
      subjects:subject_id ( name ),
      grades:grade_id ( name_display )
    `)
    .eq('school_id', schoolId)
    .order('exam_date', { ascending: false });

  if (streamId && gradeId) {
    query = query.or(
      `grade_stream_id.eq.${streamId},and(grade_id.eq.${gradeId},grade_stream_id.is.null)`
    );
  } else if (streamId) {
    query = query.eq('grade_stream_id', streamId);
  }

  const { data, error } = await query;
  console.log('Result:', JSON.stringify({ data, error }, null, 2));
}

test();
