const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) process.env[key] = val.join('=').trim();
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: streams, error } = await supabase.from('grade_streams').select('id, full_name, school_id');
  console.log('Error?', error);
  console.log('Total streams in DB:', streams.length);
  const bySchool = {};
  for (const s of streams) {
      if (!bySchool[s.school_id]) bySchool[s.school_id] = [];
      bySchool[s.school_id].push(s.full_name);
  }
  console.log('Streams by school:', bySchool);
  
  const { data: users } = await supabase.from('users').select('email, school_id').in('role', ['ADMIN']);
  const admins = users.filter(u => bySchool[u.school_id]);
  console.log('Admins with streams:', admins.map(u => ({ email: u.email, streams: bySchool[u.school_id] })));
}

run();
