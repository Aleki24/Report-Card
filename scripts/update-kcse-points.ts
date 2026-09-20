import { createAdminClient } from './lib/admin-client';

// Credentials come from the environment. The service role key used to be a
// string literal here; it bypasses every row-level security policy, and it
// was committed.
const supabase = createAdminClient();

const KCSE_POINTS_MAP: Record<string, number> = {
  'A': 12,
  'A-': 11,
  'B+': 10,
  'B': 9,
  'B-': 8,
  'C+': 7,
  'C': 6,
  'C-': 5,
  'D+': 4,
  'D': 3,
  'D-': 2,
  'E': 1,
};

async function updateKCSEPoints() {
  console.log('Fetching KCSE grading systems...');
  
  // Get KCSE academic level
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

  // Get grading systems for KCSE
  console.log('Fetching KCSE grading systems...');
  const { data: gradingSystems, error: gsError } = await supabase
    .from('grading_systems')
    .select('id, academic_level_id')
    .in('academic_level_id', kcseLevelIds);

  if (gsError) {
    console.error('Error fetching grading systems:', gsError);
    return;
  }

  const kcseGsIds = gradingSystems?.map(gs => gs.id) || [];
  console.log('KCSE grading system IDs:', kcseGsIds);

  if (kcseGsIds.length === 0) {
    console.log('No KCSE grading systems found!');
    return;
  }

  // Update grading scales with correct KCSE points
  console.log('Updating KCSE grading scales with correct points...');
  
  let updated = 0;
  for (const [symbol, points] of Object.entries(KCSE_POINTS_MAP)) {
    const { error: updateError } = await supabase
      .from('grading_scales')
      .update({ points })
      .eq('grading_system_id', kcseGsIds[0])
      .eq('symbol', symbol);

    if (!updateError) {
      console.log(`Updated ${symbol} to ${points} points`);
      updated++;
    }
  }

  console.log(`Updated ${updated} grading scales!`);

  // Verify the changes
  console.log('\nVerifying updated scales...');
  const { data: scales, error: scalesError } = await supabase
    .from('grading_scales')
    .select('symbol, points, min_percentage, max_percentage')
    .eq('grading_system_id', kcseGsIds[0])
    .order('points', { ascending: false });

  if (scalesError) {
    console.error('Error fetching scales:', scalesError);
    return;
  }

  console.log('Current KCSE grading scales:');
  console.table(scales);
}

updateKCSEPoints().catch(console.error);
