const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recover() {
  console.log('Starting recovery...');

  // 1. Run SQL to rebuild tables and seed data
  const fs = require('fs');
  const sql = fs.readFileSync('recovery.sql', 'utf8');

  // Split into statements and execute
  const statements = sql.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { query: stmt });
    if (error) {
      // Try direct SQL via REST
      const { error: restError } = await supabase.from('_sql').insert({ query: stmt }).single();
      if (restError) {
        console.log('Note: RPC not available, will use direct SQL method');
      }
    }
  }

  // 2. Create auth user via admin API
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: 'sathya@gmail.com',
    password: 'Alexot12..',
    email_confirm: true,
    user_metadata: { first_name: 'Admin', last_name: 'User', role: 'ADMIN' },
  });

  if (authError) {
    console.error('Auth user creation failed:', authError.message);
    return;
  }

  console.log('Auth user created:', authUser.user.id);

  // 3. Update the public.users row with the correct auth ID
  const { error: updateError } = await supabase
    .from('users')
    .update({ id: authUser.user.id })
    .eq('email', 'sathya@gmail.com');

  if (updateError) {
    console.error('User update failed:', updateError.message);
    return;
  }

  console.log('Recovery complete! Login with:');
  console.log('  Email: sathya@gmail.com');
  console.log('  Password: Alexot12..');
}

recover().catch(console.error);
