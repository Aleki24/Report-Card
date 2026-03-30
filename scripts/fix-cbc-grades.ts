import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdublzpwgnuygjgyxpze.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkdWJsenB3Z251eWdqZ3l4cHplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjczNjU3MSwiZXhwIjoyMDg4MzEyNTcxfQ.PiK44wgTV2YGf6H6XYR8dF1ixC-j-bkkzu4BWGdt0lM';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const VALID_CBC_GRADES = ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'];

async function fixCbcGrades() {
  console.log('Fetching CBC academic levels...');
  
  const { data: academicLevels, error: alError } = await supabase
    .from('academic_levels')
    .select('id')
    .eq('code', 'CBC');

  if (alError) {
    console.error('Error fetching academic levels:', alError);
    return;
  }

  const cbcLevelIds = academicLevels?.map(al => al.id) || [];
  console.log('CBC academic level IDs:', cbcLevelIds);

  if (cbcLevelIds.length === 0) {
    console.log('No CBC academic levels found!');
    return;
  }

  console.log('Fetching grading scales...');
  
  const { data: gradingScales, error: scalesError } = await supabase
    .from('grading_scales')
    .select('*, grading_systems!inner(academic_level_id)')
    .order('min_percentage', { ascending: false });

  if (scalesError) {
    console.error('Error fetching grading scales:', scalesError);
    return;
  }

  const cbcScales = gradingScales?.filter((s: any) => 
    cbcLevelIds.includes(s.grading_systems?.academic_level_id)
  ) || [];

  console.log(`Found ${cbcScales.length} CBC grading scales`);

  if (cbcScales.length === 0) {
    console.log('No CBC grading scales found!');
    return;
  }

  // Get grades for CBC
  console.log('Fetching CBC grades...');
  const { data: grades, error: gradesError } = await supabase
    .from('grades')
    .select('id, academic_level_id')
    .in('academic_level_id', cbcLevelIds);

  if (gradesError) {
    console.error('Error fetching grades:', gradesError);
    return;
  }

  const cbcGradeIds = grades?.map(g => g.id) || [];
  console.log('CBC grade IDs:', cbcGradeIds);

  // Get grade streams for CBC grades
  console.log('Fetching CBC grade streams...');
  const { data: gradeStreams, error: gsError } = await supabase
    .from('grade_streams')
    .select('id, grade_id')
    .in('grade_id', cbcGradeIds);

  if (gsError) {
    console.error('Error fetching grade streams:', gsError);
    return;
  }

  const cbcStreamIds = gradeStreams?.map(gs => gs.id) || [];
  console.log(`Found ${cbcStreamIds.length} CBC grade streams`);

  // Get student IDs from students table that are in CBC streams
  console.log('Fetching CBC students...');
  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('id, current_grade_stream_id')
    .in('current_grade_stream_id', cbcStreamIds);

  if (studentError) {
    console.error('Error fetching students:', studentError);
    return;
  }

  const cbcStudentIds = students?.map(s => s.id) || [];
  console.log(`Found ${cbcStudentIds.length} CBC students`);

  if (cbcStudentIds.length === 0) {
    console.log('No CBC students found!');
    return;
  }

  console.log('Fetching marks for CBC students with invalid grades...');
  const { data: marks, error: marksError } = await supabase
    .from('exam_marks')
    .select('id, grade_symbol, percentage, rubric')
    .in('student_id', cbcStudentIds)
    .not('grade_symbol', 'in', `(${VALID_CBC_GRADES.map(g => `"${g}"`).join(',')})`)
    .not('grade_symbol', 'is', 'null');

  if (marksError) {
    console.error('Error fetching marks:', marksError);
    return;
  }

  console.log(`Found ${marks?.length || 0} CBC marks with invalid grades`);

  if (!marks || marks.length === 0) {
    console.log('No marks to fix!');
    return;
  }

  const invalidGrades = [...new Set(marks.map(m => m.grade_symbol))];
  console.log('Invalid grades found:', invalidGrades);

  const updates: { id: string; grade_symbol: string; rubric: string | null }[] = [];

  for (const mark of marks) {
    const percentage = mark.percentage;
    if (percentage === null || percentage === undefined) continue;

    const rounded = Math.round(percentage);
    
    const matchingScale = cbcScales.find((s: any) => 
      rounded >= Number(s.min_percentage) && rounded <= Number(s.max_percentage)
    );

    if (matchingScale) {
      updates.push({
        id: mark.id,
        grade_symbol: matchingScale.symbol,
        rubric: matchingScale.symbol
      });
    }
  }

  console.log(`Updating ${updates.length} marks with correct CBC grades...`);

  let updated = 0;
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('exam_marks')
      .update({ 
        grade_symbol: update.grade_symbol, 
        rubric: update.rubric 
      })
      .eq('id', update.id);

    if (!updateError) updated++;
  }

  console.log(`Updated ${updated} marks!`);
  
  const changes = updates.reduce((acc, u) => {
    acc[u.grade_symbol] = (acc[u.grade_symbol] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('Summary:', changes);
}

fixCbcGrades().catch(console.error);
