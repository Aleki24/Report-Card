const { Client } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!dbUrl) {
  console.error("No DATABASE_URL or SUPABASE_DATABASE_URL found in .env.local");
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
});

async function run() {
  try {
    await client.connect();
    const sql = fs.readFileSync('add-invite-codes.sql', 'utf8');
    await client.query(sql);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
