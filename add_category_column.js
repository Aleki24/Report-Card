require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runSQL(sql) {
  // Use Supabase's pg-meta REST endpoint to execute raw SQL
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return res;
}

async function main() {
  // Add column via direct pg endpoint
  const url = `${SUPABASE_URL}/rest/v1/`;
  
  // Try adding column using Supabase Management API  
  const pgUrl = SUPABASE_URL.replace('.supabase.co', '.supabase.co');
  const sqlEndpoint = `${pgUrl}/pg/query`;
  
  console.log('Adding category column to subjects table...');
  
  const res = await fetch(sqlEndpoint, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'x-connection-encrypted': 'true',
    },
    body: JSON.stringify({
      query: "ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'OTHER'"
    }),
  });
  
  if (res.ok) {
    console.log('Column added successfully!');
  } else {
    const text = await res.text();
    console.log('Direct SQL failed (status ' + res.status + '): ' + text);
    console.log('\n--- MANUAL STEP REQUIRED ---');
    console.log('Go to your Supabase Dashboard -> SQL Editor and run:');
    console.log("ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'OTHER';");
    console.log('\nThen re-run: node fix_categories.js');
  }
}

main().catch(console.error);
