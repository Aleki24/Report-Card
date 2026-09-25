/**
 * A fictional school shown to someone whose own school is waiting for
 * approval, so they can see what Skulbase does instead of a waiting screen.
 * Every name here is invented. Client-only.
 */

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays: number) => iso(offsetDays).slice(0, 10);

const FIRST = ['Amani', 'Wanjiku', 'Kevin', 'Faith', 'Esther', 'Brian', 'Grace', 'Peter', 'Mercy', 'Joseph', 'Achieng', 'Dennis', 'Lilian', 'Victor', 'Sharon', 'Collins', 'Ivy', 'Moses', 'Janet', 'Felix', 'Ruth', 'Samuel', 'Naliaka', 'Tom'];
const LAST = ['Otieno', 'Kamau', 'Ouma', 'Chebet', 'Nyambura', 'Mwangi', 'Achieng', 'Njoroge', 'Wambui', 'Kiprono', 'Atieno', 'Odhiambo'];

const LEVELS = [{ id: 'demo-cbc', code: 'CBC', name: 'CBC' }];
const GRADES = [7, 8, 9].map(n => ({ id: `demo-g${n}`, code: `G${n}`, name_display: `Grade ${n}`, numeric_order: n, academic_level_id: 'demo-cbc' }));
const STREAMS = [
  { id: 'demo-7e', name: 'East', full_name: 'Grade 7 East', grade_id: 'demo-g7' },
  { id: 'demo-7w', name: 'West', full_name: 'Grade 7 West', grade_id: 'demo-g7' },
  { id: 'demo-8e', name: 'East', full_name: 'Grade 8 East', grade_id: 'demo-g8' },
  { id: 'demo-9e', name: 'Grade 9', full_name: 'Grade 9', grade_id: 'demo-g9' },
];
const TEACHER_NAMES = [['Mary', 'Wambui', 'ADMIN'], ['Peter', 'Njoroge', 'CLASS_TEACHER'], ['Faith', 'Chebet', 'CLASS_TEACHER'], ['Joseph', 'Kiprono', 'SUBJECT_TEACHER'], ['Grace', 'Achieng', 'SUBJECT_TEACHER'], ['Tom', 'Mboya', 'STAFF']] as const;

const SUBJECTS = [
  ['English', 'ENG_JS', 'LANGUAGE'], ['Kiswahili', 'KISW_JS', 'LANGUAGE'], ['Mathematics', 'MATH_JS', 'MATHEMATICS'],
  ['Integrated Science', 'ISC_JS', 'SCIENCE'], ['Social Studies', 'SST_JS', 'HUMANITY'], ['Pre-Technical Studies', 'PTS_JS', 'TECHNICAL'],
  ['Creative Arts & Sports', 'CAS_JS', 'CREATIVE'],
].map(([name, code, category], i) => ({ id: `demo-sub${i}`, name, code, category, academic_level_id: 'demo-cbc', subject_type: 'CORE', grading_system_id: 'demo-gs' }));

/** CBC Junior School performance levels. */
const SCALES = [
  { grading_system_id: 'demo-gs', symbol: 'EE', label: 'Exceeding expectations', min_percentage: 75, max_percentage: 100, order_index: 1 },
  { grading_system_id: 'demo-gs', symbol: 'ME', label: 'Meeting expectations', min_percentage: 50, max_percentage: 74.99, order_index: 2 },
  { grading_system_id: 'demo-gs', symbol: 'AE', label: 'Approaching expectations', min_percentage: 25, max_percentage: 49.99, order_index: 3 },
  { grading_system_id: 'demo-gs', symbol: 'BE', label: 'Below expectations', min_percentage: 0, max_percentage: 24.99, order_index: 4 },
];
const symbolFor = (pct: number) => SCALES.find(g => pct >= g.min_percentage)?.symbol ?? 'BE';

/** A stable pseudo-random 0–1 per key, so the demo shows the same marks every visit. */
function seeded(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

const STUDENTS = FIRST.map((first, i) => {
  const stream = STREAMS[i % STREAMS.length];
  const last = LAST[i % LAST.length];
  return {
    id: `demo-s${i}`,
    admission_number: String(2400 + i),
    current_grade_stream_id: stream.id,
    status: i === 5 ? 'TRANSFERRED' : 'ACTIVE',
    gender: i % 2 ? 'FEMALE' : 'MALE',
    date_of_birth: '2012-03-04',
    academic_level_id: 'demo-cbc',
    users: { first_name: first, last_name: last, email: null, phone: null },
    guardian_name: `${['Mr', 'Mrs'][i % 2]} ${last}`,
    guardian_phone: i % 6 === 0 ? null : `0722 ${String(100000 + i * 731).slice(0, 3)} ${String(400 + i)}`,
    guardian_email: null,
    avatar_url: null,
    grade_streams: stream,
    pathway: null, track: null, subject_combination_id: null, subject_combinations: null,
  };
});

const TEACHERS = TEACHER_NAMES.map(([first, last, role], i) => ({
  id: `demo-t${i}`,
  profile: { first_name: first, last_name: last, email: `${first.toLowerCase()}@demo.school`, phone: `0711 000 ${100 + i}`, avatar_url: null, is_active: true, role, job_title: role === 'STAFF' ? 'Bursar' : null },
  subjects: role.includes('TEACHER') ? SUBJECTS.slice(i, i + 2).map(s => s.name).join(', ') : '',
  classes: role === 'CLASS_TEACHER' ? STREAMS[i - 1]?.full_name ?? '' : '',
}));

const PARENTS = STUDENTS.filter(s => s.guardian_phone).slice(0, 12).map(s => ({
  id: `demo-p${s.id}`,
  name: s.guardian_name,
  phone: s.guardian_phone ?? '',
  email: '',
  students: [{ id: s.id, admission_number: s.admission_number, first_name: s.users.first_name, last_name: s.users.last_name, status: s.status, grade_stream: { full_name: s.grade_streams.full_name } }],
}));

const USERS = [
  ...STUDENTS.slice(0, 16).map((s, i) => ({ id: s.id, first_name: s.users.first_name, last_name: s.users.last_name, email: null, username: `${s.users.first_name}.${s.users.last_name}`.toLowerCase(), phone: null, role: 'STUDENT', is_active: i % 5 !== 0, created_at: iso(-30 - i), admission_number: s.admission_number, avatar_url: null, class_name: s.grade_streams.full_name })),
  ...TEACHERS.map((t, i) => ({ id: t.id, first_name: t.profile.first_name, last_name: t.profile.last_name, email: t.profile.email, username: t.profile.first_name.toLowerCase(), phone: t.profile.phone, role: t.profile.role, is_active: true, created_at: iso(-90 - i), job_title: t.profile.job_title, avatar_url: null })),
];

const YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = [{ id: 'demo-y', name: String(YEAR), start_date: `${YEAR}-01-06`, end_date: `${YEAR}-11-20`, is_current: true }];
const TERMS = [
  { id: 'demo-t1', name: 'Term 1', academic_year_id: 'demo-y', academic_year_name: String(YEAR), start_date: `${YEAR}-01-06`, end_date: `${YEAR}-04-04`, is_current: false },
  { id: 'demo-t2', name: 'Term 2', academic_year_id: 'demo-y', academic_year_name: String(YEAR), start_date: `${YEAR}-04-28`, end_date: `${YEAR}-08-01`, is_current: false },
  { id: 'demo-t3', name: 'Term 3', academic_year_id: 'demo-y', academic_year_name: String(YEAR), start_date: `${YEAR}-08-25`, end_date: `${YEAR}-10-31`, is_current: true },
];

const FEES = STUDENTS.slice(0, 18).map((s, i) => {
  const paid = [45000, 20000, 0, 45000, 30000, 12000][i % 6];
  return {
    id: `demo-f${i}`, totalFee: 45000, paidAmount: paid, balance: 45000 - paid, dueDate: date(10),
    status: paid >= 45000 ? 'PAID' : paid === 0 ? 'PENDING' : 'PARTIAL', notes: '',
    termId: 'demo-t3', termName: 'Term 3', studentName: `${s.users.first_name} ${s.users.last_name}`,
    admissionNumber: s.admission_number, createdAt: iso(-20), updatedAt: iso(-i),
  };
});

const CLASS_MEANS = [48, 61, 72, 66];

const EXAM_TYPES = [
  { code: 'MIDTERM', label: 'Midterm', status: 'APPROVED' },
  { code: 'ENDTERM', label: 'Endterm', status: 'DRAFT' },
] as const;

/** This term's exams: a released midterm and an endterm still being marked, per subject and grade. */
const EXAMS = GRADES.flatMap(g => SUBJECTS.flatMap(sub => EXAM_TYPES.map(t => ({
  id: `demo-x-${g.id}-${sub.id}-${t.code}`,
  name: `${sub.name} ${t.label}`,
  exam_type: t.code,
  max_score: 100,
  subject_id: sub.id,
  subject_name: sub.name,
  subject_code: sub.code,
  subject_category: sub.category,
  grade_name: g.name_display,
  grade_stream_id: null,
  grade_stream_name: null,
  grade_id: g.id,
  term_id: 'demo-t3',
  term_name: 'Term 3',
  status: t.status,
  published_by: t.status === 'APPROVED' ? 'demo-t0' : null,
  published_by_name: t.status === 'APPROVED' ? 'Mary Wambui' : null,
  published_at: t.status === 'APPROVED' ? iso(-12) : null,
  approved_by: null,
  created_by_teacher_id: null,
}))));

/** Marks for one exam: every learner in the grade for the midterm, most of them for the endterm. */
function examMarks(examId: string) {
  const exam = EXAMS.find(e => e.id === examId);
  if (!exam) return [];
  const streamIds = new Set(STREAMS.filter(st => st.grade_id === exam.grade_id).map(st => st.id));
  return STUDENTS
    .filter(st => st.status === 'ACTIVE' && streamIds.has(st.current_grade_stream_id))
    .filter(st => exam.exam_type === 'MIDTERM' || seeded(`${examId}:${st.id}:todo`) > 0.3)
    .map(st => {
      const score = Math.round(28 + seeded(`${examId}:${st.id}`) * 68);
      return {
        id: `demo-m-${examId}-${st.id}`,
        student_id: st.id,
        student_name: `${st.users.first_name} ${st.users.last_name}`,
        admission_number: st.admission_number,
        raw_score: score,
        percentage: score,
        grade_symbol: symbolFor(score),
        rubric: null,
        remarks: null,
      };
    });
}

/** `/api/school/exams`, narrowed by term, class and exam type as the real route does. */
function examsFor(url: URL) {
  const term = url.searchParams.get('term_id');
  const stream = url.searchParams.get('grade_stream_id') ?? url.searchParams.get('stream_id');
  const type = url.searchParams.get('exam_type');
  const gradeOfStream = STREAMS.find(st => st.id === stream)?.grade_id;
  return EXAMS.filter(e =>
    (!term || e.term_id === term)
    && (!stream || e.grade_id === gradeOfStream)
    && (!type || e.exam_type === type));
}

const DASHBOARD = {
  totalStudents: STUDENTS.filter(s => s.status === 'ACTIVE').length,
  totalTeachers: TEACHERS.filter(t => t.profile.role.includes('TEACHER')).length,
  totalUsers: USERS.length,
  totalClasses: STREAMS.length,
  totalReports: 46,
  attendanceToday: { present: 21, absent: 1, late: 1, excused: 0 },
  upcomingExams: [
    { id: 'demo-x1', name: 'Mathematics Endterm', exam_type: 'ENDTERM', exam_date: date(6), subject_name: 'Mathematics', grade_name: 'Grade 8' },
    { id: 'demo-x2', name: 'English Endterm', exam_type: 'ENDTERM', exam_date: date(7), subject_name: 'English', grade_name: 'Grade 8' },
  ],
  recentActivities: [
    { type: 'marks', message: 'Grade 7 East Mathematics marks entered', timestamp: iso(-0.1), href: '/dashboard/exams-marks' },
    { type: 'fees', message: 'Fee payment of KES 20,000 recorded for Wanjiku Kamau', timestamp: iso(-0.4), href: '/dashboard/fees' },
    { type: 'attendance', message: "Today's register taken for Grade 9", timestamp: iso(-0.2), href: '/dashboard/attendance' },
  ],
  overdueFeesCount: 4,
  announcementsLast7Days: 2,
  recentEnrollmentsLast7: 3,
  financeSummary: { totalCollected: FEES.reduce((n, f) => n + f.paidAmount, 0), unpaidBalance: FEES.reduce((n, f) => n + f.balance, 0), overdueCount: 4 },
  academicSummary: { recentAvg: 62, passRate: 71, passMark: 50, markCount: 640 },
  examsAwaitingMarks: 3,
  unmarkedByClass: [{ label: 'Grade 8 East', levelCode: 'CBC', count: 2 }, { label: 'Grade 9', levelCode: 'CBC', count: 1 }],
  classPerformance: STREAMS.map((s, i) => ({ id: s.id, name: s.full_name, levelCode: 'CBC', students: 6, markCount: 160, mean: CLASS_MEANS[i], passRate: CLASS_MEANS[i] + 8 })).sort((a, b) => (a.passRate ?? 0) - (b.passRate ?? 0)),
  subjectsWithoutGradingSystem: 0,
  hasFeeData: true,
  hasAttendanceData: true,
  hasLogo: false,
  setup: { hasCurrentTerm: true, classes: STREAMS.length, subjectsOffered: SUBJECTS.length, classesWithoutClassTeacher: 1, subjectTeacherAssignments: 12, learnersWithoutClass: 0 },
};

const ANALYTICS_OVERVIEW = {
  scope: { academic_year_id: 'demo-y', academic_year: String(YEAR), term_id: null, term_name: null },
  academic_year: String(YEAR),
  classes: STREAMS.map((s, i) => ({ id: s.id, name: s.full_name, level_code: 'CBC', students: 6, mark_count: 160, mean: CLASS_MEANS[i], pass_rate: CLASS_MEANS[i] + 8, unmarked: i === 2 ? 2 : 0 })),
  summary: { classes_with_marks: STREAMS.length, classes_total: STREAMS.length, learners: STUDENTS.length, mark_count: 640, exams_awaiting_marks: 3 },
};

const CLASSES_OVERVIEW = {
  curricula: LEVELS,
  grades: GRADES,
  classes: STREAMS.map((s, i) => ({
    id: s.id, grade_id: s.grade_id, name: s.name, full_name: s.full_name,
    class_teachers: i < 3 ? [`${TEACHER_NAMES[i + 1]?.[0] ?? 'Mary'} ${TEACHER_NAMES[i + 1]?.[1] ?? 'Wambui'}`] : [],
    usage: { students: 6, activeStudents: 6, exams: 14, reportCards: 6 },
  })),
};

const ACADEMIC_STRUCTURE = {
  academic_years: ACADEMIC_YEARS,
  terms: TERMS,
  grades: GRADES,
  grade_streams: STREAMS,
  subjects: SUBJECTS,
  academic_levels: LEVELS,
  grading_systems: [{ id: 'demo-gs', name: 'CBC 4-point', academic_level_id: 'demo-cbc' }],
  grading_scales: SCALES,
  subject_combinations: [],
};

const SCHOOL_PROFILE = { id: 'demo-school', name: 'Demo Academy', email: 'office@demo.school', phone: '0700 000 000', address: 'Nairobi', motto: 'Learning for life', logo_url: null, min_combination_group_size: 15 };

const ANNOUNCEMENTS = [
  { id: 'demo-a1', title: 'Half-term break', content: 'School closes on Friday for the half-term break and reopens the following Tuesday.', audience: 'ALL', created_at: iso(-2), posted_by_name: 'Mary Wambui' },
  { id: 'demo-a2', title: 'Parents meeting', content: 'Grade 9 parents are invited to a meeting on Saturday at 10am.', audience: 'PARENTS', created_at: iso(-5), posted_by_name: 'Mary Wambui' },
];

/** `/api/school/data?type=…` answers. */
const DATA_BY_TYPE: Record<string, unknown> = {
  students: STUDENTS,
  teachers: TEACHERS,
  parents: PARENTS,
  users: USERS,
  grade_streams: STREAMS,
  subjects: SUBJECTS,
  subject_combinations: [],
  terms: TERMS,
  academic_years: ACADEMIC_YEARS,
  school_profile: SCHOOL_PROFILE,
  my_subjects: SUBJECTS,
  class_teacher_assignments: [{ user_id: 'demo-t1', current_grade_stream_id: 'demo-7e' }, { user_id: 'demo-t2', current_grade_stream_id: 'demo-7w' }],
};

/**
 * The demo answer to a GET, by path (and `type` for the data endpoint).
 * Anything not listed answers with an empty list, which every page shows as
 * its own empty state.
 */
export function demoResponse(url: URL): unknown {
  const path = url.pathname;
  if (path === '/api/school/data') return { data: DATA_BY_TYPE[url.searchParams.get('type') ?? ''] ?? [] };
  switch (path) {
    case '/api/school/dashboard': return DASHBOARD;
    case '/api/school/exams': return { data: examsFor(url) };
    case '/api/school/exam-marks': return { data: examMarks(url.searchParams.get('exam_id') ?? ''), scheme: null };
    case '/api/admin/classes': return CLASSES_OVERVIEW;
    case '/api/admin/academic-structure': return ACADEMIC_STRUCTURE;
    case '/api/school/analytics/overview': return ANALYTICS_OVERVIEW;
    case '/api/school/fees': return { data: FEES };
    case '/api/school/announcements': return { data: ANNOUNCEMENTS };
    case '/api/school/managed-streams': return { data: STREAMS.map(s => ({ id: s.id, full_name: s.full_name, grade_id: s.grade_id })) };
    case '/api/admin/school': return { data: SCHOOL_PROFILE, school: SCHOOL_PROFILE };
    default: return { data: [] };
  }
}

export const DEMO_SCHOOL_NAME = SCHOOL_PROFILE.name;
