import fetch from 'node-fetch';

async function test() {
  const payload = {
    default_grade_stream_id: 'some-id',
    students: [
      {
        first_name: 'Amos',
        last_name: 'Kimemia',
        admission_number: '',
        gender: ''
      }
    ]
  };

  const res = await fetch('http://localhost:3000/api/admin/bulk-import-students', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // We need auth, this might be tricky if Clerk is enabled.
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text);
}

test();
