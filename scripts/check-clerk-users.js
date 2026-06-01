const apiKey = 'sk_test_OSqRXkW8LwPl6eXcG881AWDyQNk8CAimL3TytLz73V';

async function checkUsers() {
  const res = await fetch('https://api.clerk.com/v1/users?limit=5&order_by=-created_at', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  
  if (!res.ok) {
    console.error('Failed to fetch users:', await res.text());
    return;
  }
  
  const users = await res.json();
  console.log('Recent Users:');
  for (const u of users) {
    console.log(`\nUser: ${u.first_name} ${u.last_name} (${u.id})`);
    console.log(`Email addresses:`);
    u.email_addresses.forEach(e => {
      console.log(`  - ${e.email_address} (verified: ${e.verification?.status})`);
    });
    console.log(`Two factor enabled: ${u.two_factor_enabled}`);
    console.log(`Password enabled: ${u.password_enabled}`);
    console.log(`Created at: ${new Date(u.created_at).toISOString()}`);
  }
}

checkUsers();
