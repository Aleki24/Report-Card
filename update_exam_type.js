require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runSQL(sql) {
  const pgUrl = SUPABASE_URL.replace('.supabase.co', '.supabase.co');
  const sqlEndpoint = `${pgUrl}/pg/query`;
  
  const res = await fetch(sqlEndpoint, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'x-connection-encrypted': 'true',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (res.ok) {
    console.log('Success for:', sql);
  } else {
    const text = await res.text();
    console.log('Failed:', sql);
    console.log('Error:', text);
  }
}

async function main() {
  const types = ['CAT', 'TOPICAL', 'ZONE', 'SUB_COUNTY', 'COUNTY', 'REGIONAL', 'PRE_MOCK', 'MOCK', 'POST_MOCK'];
  for (const t of types) {
    await runSQL(`ALTER TYPE exam_type ADD VALUE IF NOT EXISTS '${t}'`);
  }
  console.log("Done adding new types.");
}

main().catch(console.error);
