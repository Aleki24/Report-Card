import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdublzpwgnuygjgyxpze.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkdWJsenB3Z251eWdqZ3l4cHplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjczNjU3MSwiZXhwIjoyMDg4MzEyNTcxfQ.PiK44wgTV2YGf6H6XYR8dF1ixC-j-bkkzu4BWGdt0lM';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const VALID_KCSE_GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'];
const CBC_GRADES = ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'];

async function fixKCSEGrades() {
  console.log('Fetching KCSE academic levels...');
  
  const { data: academicLevels, error: alError } = await supabase
    .from('academic_levels')
    .select('id')
    .eq('code', '844');

  if (alError) {
    console.error('Error fetching academic levels:', alError);
    return;
  }

  const kcseLevelIds = academicLevels?.map(al => al.id) || [];
  console.log('KCSE academic level IDs:', kcseLevelIds);

  if (kcseLevelIds.length === 0) {
    console.log('No KCSE academic levels found!');
    return;
  }

  // Get grades for KCSE
  console.log('Fetching KCSE grades...');
  const { data: grades, error: gradesError } = await supabase
    .from('grades')
    .select('id, academic_level_id')
    .in('academic_level_id', kcseLevelIds);

  if (gradesError) {
    console.error('Error fetching grades:', gradesError);
    return;
  }

  const kcseGradeIds = grades?.map(g => g.id) || [];
  console.log('KCSE grade IDs:', kcseGradeIds);

  // Get grade streams for KCSE grades
  console.log('Fetching KCSE grade streams...');
  const { data: gradeStreams, error: gsError } = await supabase
    .from('grade_streams')
    .select('id, grade_id')
    .in('grade_id', kcseGradeIds);

  if (gsError) {
    console.error('Error fetching grade streams:', gsError);
    return;
  }

  const kcseStreamIds = gradeStreams?.map(gs => gs.id) || [];
  console.log(`Found ${kcseStreamIds.length} KCSE grade streams`);

  if (kcseStreamIds.length === 0) {
    console.log('No KCSE grade streams found!');
    return;
  }

  // Get student IDs from KCSE streams
  console.log('Fetching KCSE students...');
  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('id, current_grade_stream_id')
    .in('current_grade_stream_id', kcseStreamIds);

  if (studentError) {
    console.error('Error fetching students:', studentError);
    return;
  }

  const kcseStudentIds = students?.map(s => s.id) || [];
  console.log(`Found ${kcseStudentIds.length} KCSE students`);

  if (kcseStudentIds.length === 0) {
    console.log('No KCSE students found!');
    return;
  }

  // Fetch KCSE grading scales
  console.log('Fetching KCSE grading scales...');
  const { data: gradingScales, error: scalesError } = await supabase
    .from('grading_scales')
    .select('*, grading_systems!inner(academic_level_id)')
    .order('min_percentage', { ascending: false });

  if (scalesError) {
    console.error('Error fetching grading scales:', scalesError);
    return;
  }

  const kcseScales = gradingScales?.filter((s: any) => 
    kcseLevelIds.includes(s.grading_systems?.academic_level_id)
  ) || [];

  console.log(`Found ${kcseScales.length} KCSE grading scales`);

  if (kcseScales.length === 0) {
    console.log('No KCSE grading scales found!');
    return;
  }

  // Fetch marks for KCSE students with CBC grades (these are wrong)
  console.log('Fetching KCSE marks with CBC grades...');
  const { data: marks, error: marksError } = await supabase
    .from('exam_marks')
    .select('id, grade_symbol, percentage, rubric')
    .in('student_id', kcseStudentIds)
    .in('grade_symbol', CBC_GRADES);

  if (marksError) {
    console.error('Error fetching marks:', marksError);
    return;
  }

  console.log(`Found ${marks?.length || 0} KCSE marks with CBC grades`);

  if (!marks || marks.length === 0) {
    console.log('No marks to fix!');
    return;
  }

  const updates: { id: string; grade_symbol: string; rubric: string | null }[] = [];

  for (const mark of marks) {
    const percentage = mark.percentage;
    if (percentage === null || percentage === undefined) continue;

    const rounded = Math.round(percentage);
    
    const matchingScale = kcseScales.find((s: any) => 
      rounded >= Number(s.min_percentage) && rounded <= Number(s.max_percentage)
    );

    if (matchingScale) {
      updates.push({
        id: mark.id,
        grade_symbol: matchingScale.symbol,
        rubric: null // Clear CBC rubric
      });
    }
  }

  console.log(`Updating ${updates.length} marks with correct KCSE grades...`);

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

fixKCSEGrades().catch(console.error);
