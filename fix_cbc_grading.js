require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function uuid() { return crypto.randomUUID(); }

async function main() {
  // Find the CBC grading system
  const { data: gs } = await sb.from('grading_systems').select('*');
  console.log('Grading systems:', gs.map(g => g.name + ' (' + g.id + ')'));

  const cbcSystem = gs.find(g => g.name.includes('CBC'));
  if (!cbcSystem) { console.log('ERROR: No CBC grading system found'); return; }

  console.log('\nUsing CBC system:', cbcSystem.id);

  // Delete old CBC scales
  const { error: delErr } = await sb.from('grading_scales').delete().eq('grading_system_id', cbcSystem.id);
  if (delErr) { console.log('Delete error:', delErr.message); return; }
  console.log('Cleared old CBC scales');

  // Insert the full 8-level CBC system (matching original data)
  const cbcScales = [
    { symbol: 'EE1', label: 'Exceeding Expectations - Exceptional',        min: 90, max: 100, points: 8, order: 8 },
    { symbol: 'EE2', label: 'Exceeding Expectations - Very Good',          min: 75, max: 89,  points: 7, order: 7 },
    { symbol: 'ME1', label: 'Meeting Expectations - Good',                 min: 58, max: 74,  points: 6, order: 6 },
    { symbol: 'ME2', label: 'Meeting Expectations - Satisfactory',         min: 41, max: 57,  points: 5, order: 5 },
    { symbol: 'AE1', label: 'Approaching Expectations - Needs Improvement',min: 31, max: 40,  points: 4, order: 4 },
    { symbol: 'AE2', label: 'Approaching Expectations - Weak',             min: 21, max: 30,  points: 3, order: 3 },
    { symbol: 'BE1', label: 'Below Expectations - Very Weak',              min: 11, max: 20,  points: 2, order: 2 },
    { symbol: 'BE2', label: 'Below Expectations - Minimal',                min: 0,  max: 10,  points: 1, order: 1 },
  ];

  const rows = cbcScales.map(s => ({
    id: uuid(),
    grading_system_id: cbcSystem.id,
    min_percentage: s.min,
    max_percentage: s.max,
    symbol: s.symbol,
    label: s.label,
    points: s.points,
    order_index: s.order,
  }));

  const { error: insErr } = await sb.from('grading_scales').insert(rows);
  if (insErr) { console.log('Insert error:', insErr.message); return; }

  console.log('\nCBC Grading Scales (8 levels) restored:\n');
  cbcScales.forEach(s => {
    console.log(`  ${s.symbol.padEnd(4)} ${String(s.min).padStart(3)}–${String(s.max).padEnd(3)}%  ${s.label.padEnd(48)} (${s.points} pts)`);
  });

  // Verify total
  const { count } = await sb.from('grading_scales').select('*', { count: 'exact', head: true });
  console.log(`\nTotal grading scales in DB: ${count} (8 CBC + 12 KCSE = 20 expected)`);
}

main().catch(console.error);
