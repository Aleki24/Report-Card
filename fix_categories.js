require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// KCSE subject category mapping
const CAT = {
  'ENG':   'LANGUAGE',
  'ENG8':  'LANGUAGE',
  'KISW':  'LANGUAGE',
  'KISW8': 'LANGUAGE',
  'FRE':   'LANGUAGE',
  'MATH':  'MATHEMATICS',
  'MATH8': 'MATHEMATICS',
  'SCI':   'SCIENCE',
  'SCIE':  'SCIENCE',
  'HIST':  'HUMANITY',
  'HIST8': 'HUMANITY',
  'GEO':   'HUMANITY',
  'GEO8':  'HUMANITY',
  'CRE':   'HUMANITY',
  'CRE8':  'HUMANITY',
  'AGRI':  'TECHNICAL',
  'AGRI8': 'TECHNICAL',
  'BUS':   'TECHNICAL',
  'BUS8':  'TECHNICAL',
  'COMP':  'TECHNICAL',
  'MUSIC': 'TECHNICAL',
  'PE':    'TECHNICAL',
};

(async () => {
  const { data: subjects } = await sb.from('subjects').select('id, code, name');
  console.log('Updating ' + subjects.length + ' subjects with KCSE categories...\n');

  let ok = 0;
  for (const s of subjects) {
    const cat = CAT[s.code] || 'TECHNICAL';
    const { error } = await sb.from('subjects').update({ category: cat }).eq('id', s.id);
    if (error) {
      console.log('  FAIL ' + s.code + ': ' + error.message);
    } else {
      console.log('  ' + s.code.padEnd(8) + s.name.padEnd(32) + '-> ' + cat);
      ok++;
    }
  }
  console.log('\nDone: ' + ok + '/' + subjects.length + ' updated');
})();
