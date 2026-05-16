// seed_recovery.js — Restore sample data into Matokeo
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Current DB IDs (from inventory)
const SCHOOL_ID    = 'b9e20066-0fd3-48ec-b731-56f14bb4413e';
const ADMIN_ID     = '74da1b9d-e3c9-4c81-ad12-dafb10cff3f8';
const CBC_LEVEL    = '727fffac-6290-431e-86be-7b96585568cc';
const LEVEL_844    = '6ca061dd-553c-46ef-8c34-630265873073';
const YEAR_2026    = 'f597c1b8-3801-43cc-a764-26ed71ce8ca1';
const TERM_1       = 'f86afe07-6c4f-4b31-88b0-167ad455579d';

// Simple password hash (bcrypt from recovery.sql admin)
const DEFAULT_HASH = '$2b$12$rAfE.a.1eJ74e//DU0b.pe2l1ODUKa4LcmspK/baZVSUB29Gg7sTu'; // Alexot12..

function uuid() { return crypto.randomUUID(); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const TEACHER_DATA = [
  { first: 'Jane',   last: 'Muthoni',  email: 'jane.muthoni@school.ke',   username: 'jane.m',   role: 'CLASS_TEACHER' },
  { first: 'Peter',  last: 'Ochieng',  email: 'peter.ochieng@school.ke',  username: 'peter.o',  role: 'CLASS_TEACHER' },
  { first: 'Grace',  last: 'Wanjiku',  email: 'grace.wanjiku@school.ke',  username: 'grace.w',  role: 'CLASS_TEACHER' },
  { first: 'David',  last: 'Kimani',   email: 'david.kimani@school.ke',   username: 'david.k',  role: 'SUBJECT_TEACHER' },
  { first: 'Mary',   last: 'Akinyi',   email: 'mary.akinyi@school.ke',    username: 'mary.a',   role: 'SUBJECT_TEACHER' },
  { first: 'James',  last: 'Kiplagat', email: 'james.kiplagat@school.ke', username: 'james.k',  role: 'SUBJECT_TEACHER' },
  { first: 'Sarah',  last: 'Njeri',    email: 'sarah.njeri@school.ke',    username: 'sarah.n',  role: 'SUBJECT_TEACHER' },
  { first: 'John',   last: 'Otieno',   email: 'john.otieno@school.ke',    username: 'john.o',   role: 'SUBJECT_TEACHER' },
];

const STUDENT_NAMES = [
  'Brian Kiprop', 'Faith Chebet', 'Kevin Mwangi', 'Anne Wambui', 'Victor Odhiambo',
  'Mercy Njoki', 'Dennis Korir', 'Esther Atieno', 'Patrick Kamau', 'Joyce Wanjiru',
  'Samuel Kibet', 'Lilian Achieng', 'George Mutua', 'Purity Mwende', 'Collins Ouma',
  'Nancy Waceke', 'Martin Rotich', 'Elizabeth Nyambura', 'Joseph Kariuki', 'Ruth Moraa',
  'Michael Sang', 'Catherine Kerubo', 'Robert Ngugi', 'Gladys Jepkosgei', 'Edwin Musyoka',
  'Diana Nafula', 'Simon Barasa', 'Lucy Mutheu', 'Anthony Wekesa', 'Stella Chepkemoi',
];

async function main() {
  console.log('🔧 Starting partial data recovery...\n');

  // 1. Clean up duplicate schools
  console.log('1️⃣  Cleaning duplicate schools...');
  const { data: schools } = await sb.from('schools').select('id');
  for (const s of schools) {
    if (s.id !== SCHOOL_ID) {
      await sb.from('schools').delete().eq('id', s.id);
      console.log(`   Removed school ${s.id}`);
    }
  }
  // Update school name
  await sb.from('schools').update({
    name: 'Sathya Sai School Kisaju',
    address: 'Kisaju, Kajiado County, Kenya',
    phone: '+254700123456',
    email: 'info@sathyasaischool.ac.ke'
  }).eq('id', SCHOOL_ID);
  console.log('   ✅ School cleaned & updated\n');

  // 2. Get grade streams
  const { data: streams } = await sb.from('grade_streams').select('*').eq('school_id', SCHOOL_ID);
  console.log(`2️⃣  Found ${streams.length} grade streams`);
  streams.forEach(s => console.log(`   ${s.full_name} (${s.id})`));

  // 3. Create grading systems & scales
  console.log('\n3️⃣  Creating grading systems...');
  const cbcGradingId = uuid();
  const gs844Id = uuid();
  await sb.from('grading_systems').insert([
    { id: cbcGradingId, academic_level_id: CBC_LEVEL, name: 'CBC Standard Grading', description: 'Competency-Based Curriculum grading' },
    { id: gs844Id, academic_level_id: LEVEL_844, name: '8-4-4 Standard Grading', description: 'Kenya 8-4-4 system grading' },
  ]);

  // CBC grading scales
  const cbcScales = [
    { symbol: 'EE', label: 'Exceeding Expectations', min: 80, max: 100, points: 5, order: 5 },
    { symbol: 'ME', label: 'Meeting Expectations', min: 60, max: 79, points: 4, order: 4 },
    { symbol: 'AE', label: 'Approaching Expectations', min: 40, max: 59, points: 3, order: 3 },
    { symbol: 'BE', label: 'Below Expectations', min: 20, max: 39, points: 2, order: 2 },
    { symbol: 'BL', label: 'Below Level', min: 0, max: 19, points: 1, order: 1 },
  ];
  // 844 grading scales
  const scales844 = [
    { symbol: 'A',  label: 'Excellent',    min: 80, max: 100, points: 12, order: 12 },
    { symbol: 'A-', label: 'Very Good',    min: 75, max: 79,  points: 11, order: 11 },
    { symbol: 'B+', label: 'Good',         min: 70, max: 74,  points: 10, order: 10 },
    { symbol: 'B',  label: 'Fairly Good',  min: 65, max: 69,  points: 9,  order: 9 },
    { symbol: 'B-', label: 'Average Plus', min: 60, max: 64,  points: 8,  order: 8 },
    { symbol: 'C+', label: 'Average',      min: 55, max: 59,  points: 7,  order: 7 },
    { symbol: 'C',  label: 'Fair',         min: 50, max: 54,  points: 6,  order: 6 },
    { symbol: 'C-', label: 'Below Average',min: 45, max: 49,  points: 5,  order: 5 },
    { symbol: 'D+', label: 'Below Fair',   min: 40, max: 44,  points: 4,  order: 4 },
    { symbol: 'D',  label: 'Weak',         min: 35, max: 39,  points: 3,  order: 3 },
    { symbol: 'D-', label: 'Very Weak',    min: 30, max: 34,  points: 2,  order: 2 },
    { symbol: 'E',  label: 'Fail',         min: 0,  max: 29,  points: 1,  order: 1 },
  ];

  await sb.from('grading_scales').insert([
    ...cbcScales.map(s => ({
      id: uuid(), grading_system_id: cbcGradingId,
      min_percentage: s.min, max_percentage: s.max,
      symbol: s.symbol, label: s.label, points: s.points, order_index: s.order
    })),
    ...scales844.map(s => ({
      id: uuid(), grading_system_id: gs844Id,
      min_percentage: s.min, max_percentage: s.max,
      symbol: s.symbol, label: s.label, points: s.points, order_index: s.order
    })),
  ]);

  // Link grading systems to school
  await sb.from('schools').update({
    grading_system_cbc_id: cbcGradingId,
    grading_system_844_id: gs844Id,
  }).eq('id', SCHOOL_ID);
  console.log('   ✅ Created CBC (5 levels) + 844 (12 grades) grading scales\n');

  // 4. Create teachers
  console.log('4️⃣  Creating teachers...');
  const teacherIds = [];
  for (const t of TEACHER_DATA) {
    const id = uuid();
    teacherIds.push({ id, ...t });
    const { error } = await sb.from('users').insert({
      id, first_name: t.first, last_name: t.last, email: t.email,
      role: t.role, is_active: true, school_id: SCHOOL_ID,
      username: t.username, password_hash: DEFAULT_HASH
    });
    if (error) console.log(`   ⚠️  ${t.email}: ${error.message}`);
    else console.log(`   ✅ ${t.first} ${t.last} (${t.role})`);
  }

  // 5. Create class_teachers (first 3 teachers → first 3 streams)
  console.log('\n5️⃣  Assigning class teachers...');
  const classTeachers = teacherIds.filter(t => t.role === 'CLASS_TEACHER');
  for (let i = 0; i < Math.min(classTeachers.length, streams.length); i++) {
    const { error } = await sb.from('class_teachers').insert({
      id: uuid(), user_id: classTeachers[i].id,
      current_grade_stream_id: streams[i].id,
      academic_year_id: YEAR_2026,
    });
    if (error) console.log(`   ⚠️  ${error.message}`);
    else console.log(`   ✅ ${classTeachers[i].first} → ${streams[i].full_name}`);
  }

  // 6. Create subject_teachers + assignments
  console.log('\n6️⃣  Assigning subject teachers...');
  const subjectTeachers = teacherIds.filter(t => t.role === 'SUBJECT_TEACHER');
  const { data: cbcSubjects } = await sb.from('subjects').select('*').eq('academic_level_id', CBC_LEVEL).order('display_order');
  const cbcStreams = streams.filter(s => s.full_name.startsWith('Grade'));

  for (const st of subjectTeachers) {
    const stId = uuid();
    await sb.from('subject_teachers').insert({ id: stId, user_id: st.id });

    // Assign 2-3 subjects each
    const assignCount = Math.min(3, cbcSubjects.length);
    const startIdx = subjectTeachers.indexOf(st) * 2;
    for (let j = 0; j < assignCount && (startIdx + j) < cbcSubjects.length; j++) {
      const subj = cbcSubjects[startIdx + j];
      if (!subj) break;
      const gradeId = cbcStreams.length > 0 ? cbcStreams[0].grade_id : streams[0].grade_id;
      await sb.from('subject_teacher_assignments').insert({
        id: uuid(), subject_teacher_id: stId,
        subject_id: subj.id, grade_id: gradeId,
        academic_year_id: YEAR_2026,
      });
    }
    console.log(`   ✅ ${st.first} ${st.last} assigned subjects`);
  }

  // 7. Create students
  console.log('\n7️⃣  Creating students...');
  const studentIds = [];
  for (let i = 0; i < STUDENT_NAMES.length; i++) {
    const [first, last] = STUDENT_NAMES[i].split(' ');
    const id = uuid();
    const streamIdx = i % streams.length;
    const stream = streams[streamIdx];
    const admNo = `SSK-${String(2026)}-${String(i + 1).padStart(3, '0')}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@student.sss.ke`;

    // Determine academic level from grade
    const { data: gradeData } = await sb.from('grades').select('academic_level_id').eq('id', stream.grade_id).single();
    const academicLevelId = gradeData?.academic_level_id || CBC_LEVEL;

    const { error: userErr } = await sb.from('users').insert({
      id, first_name: first, last_name: last, email,
      role: 'STUDENT', is_active: true, school_id: SCHOOL_ID,
      username: `student.${i + 1}`, password_hash: DEFAULT_HASH,
    });
    if (userErr) { console.log(`   ⚠️  ${first}: ${userErr.message}`); continue; }

    const gender = i % 2 === 0 ? 'Male' : 'Female';
    const { error: stuErr } = await sb.from('students').insert({
      id, admission_number: admNo,
      current_grade_stream_id: stream.id,
      academic_level_id: academicLevelId,
      date_of_birth: `${2026 - rand(12, 17)}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
      gender,
      guardian_name: `${['Mr.', 'Mrs.'][i % 2]} ${last}`,
      guardian_phone: `+2547${String(rand(10000000, 99999999))}`,
      status: 'ACTIVE',
    });
    if (stuErr) { console.log(`   ⚠️  Student ${first}: ${stuErr.message}`); continue; }

    studentIds.push({ id, stream, first, last, academicLevelId });
    console.log(`   ✅ ${first} ${last} → ${stream.full_name} (${admNo})`);
  }

  // 8. Create exams for Term 1 (End Term exams for core CBC subjects)
  console.log('\n8️⃣  Creating exams...');
  const coreSubjects = cbcSubjects.filter(s => s.is_compulsory).slice(0, 6); // ENG, KISW, MATH, SCI, HIST, GEO
  const examIds = [];
  const uniqueGradeStreams = [...new Map(streams.map(s => [s.grade_id, s])).values()];

  for (const subj of coreSubjects) {
    for (const stream of uniqueGradeStreams.slice(0, 4)) { // First 4 unique grades
      const examId = uuid();
      const { error } = await sb.from('exams').insert({
        id: examId, name: `End Term 1 ${subj.name}`,
        exam_type: 'ENDTERM',
        academic_year_id: YEAR_2026, term_id: TERM_1,
        subject_id: subj.id, grade_id: stream.grade_id,
        grade_stream_id: null, // All streams in grade
        created_by_teacher_id: ADMIN_ID,
        school_id: SCHOOL_ID,
        max_score: 100,
        exam_date: '2026-04-05',
      });
      if (error) { console.log(`   ⚠️  Exam ${subj.name}: ${error.message}`); continue; }
      examIds.push({ id: examId, subjectId: subj.id, gradeId: stream.grade_id });
      console.log(`   ✅ ${subj.name} — ${stream.full_name} grade`);
    }
  }

  // 9. Create exam marks
  console.log('\n9️⃣  Creating exam marks...');
  let markCount = 0;
  const marksBatch = [];

  for (const exam of examIds) {
    const studentsInGrade = studentIds.filter(s => {
      return streams.find(st => st.id === s.stream.id && st.grade_id === exam.gradeId);
    });

    for (const student of studentsInGrade) {
      const rawScore = rand(25, 98);
      marksBatch.push({
        id: uuid(), exam_id: exam.id, student_id: student.id,
        raw_score: rawScore, percentage: rawScore,
        grade_symbol: null, // Let trigger calculate
        remarks: rawScore >= 80 ? 'Excellent' : rawScore >= 60 ? 'Good' : rawScore >= 40 ? 'Average' : 'Needs improvement',
      });
      markCount++;
    }
  }

  // Insert in batches of 50
  for (let i = 0; i < marksBatch.length; i += 50) {
    const batch = marksBatch.slice(i, i + 50);
    const { error } = await sb.from('exam_marks').insert(batch);
    if (error) console.log(`   ⚠️  Batch ${Math.floor(i / 50) + 1}: ${error.message}`);
  }
  console.log(`   ✅ Created ${markCount} exam marks\n`);

  // 10. Summary
  console.log('═'.repeat(50));
  console.log('  RECOVERY COMPLETE');
  console.log('═'.repeat(50));
  console.log(`  School:     Sathya Sai School Kisaju`);
  console.log(`  Teachers:   ${teacherIds.length} created`);
  console.log(`  Students:   ${studentIds.length} enrolled`);
  console.log(`  Exams:      ${examIds.length} created`);
  console.log(`  Marks:      ${markCount} entered`);
  console.log(`  Grading:    CBC (5 levels) + 844 (12 grades)`);
  console.log('═'.repeat(50));
  console.log('\n  Login: sathya@gmail.com / Alexot12..');
  console.log('  All teachers/students password: Alexot12..\n');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
