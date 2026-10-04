/** Where the school is in its calendar, from its own terms. */
export type TermSummary =
  | { kind: 'in-term'; name: string; year: string | null; week: number; weeks: number; daysLeft: number; endDate: string }
  | { kind: 'break'; lastName: string | null; nextName: string | null; nextStart: string | null }
  | { kind: 'none' };

/** An exam sitting coming up: one class's round, rather than one row per paper. */
export interface UpcomingRound { key: string; label: string; className: string; firstDate: string; papers: number }

/** The colour family of a dashboard item; the same names as the web's `Hue` (components/ui/tones.ts). */
export type DashboardHue = 'sky' | 'blue' | 'violet' | 'emerald' | 'teal' | 'amber' | 'orange' | 'rose' | 'slate';

/** What a school has in place, for the setup checklist. */
export type SetupStatus = {
  hasCurrentTerm: boolean;
  /** Classes (grade streams), including one-class grades. */
  classes: number;
  subjectsOffered: number;
  classesWithoutClassTeacher: number;
  subjectTeacherAssignments: number;
  /** Active learners outside every class — invisible to marks and reports. */
  learnersWithoutClass: number;
};

export interface ClassPerformance {
  id: string;
  name: string;
  levelCode: string | null;
  students: number;
  markCount: number;
  mean: number | null;
  passRate: number | null;
}

export interface AttendanceToday { present: number; absent: number; late: number; excused: number }

/** GET /api/school/dashboard: the staff home, for the web and the app alike. */
export interface DashboardData {
  totalStudents: number;
  totalTeachers: number;
  totalUsers: number;
  totalClasses: number;
  totalReports: number;
  attendanceToday: AttendanceToday | null;
  upcomingExams: { id: string; name: string; exam_type: string; exam_date: string; subject_name: string; grade_name: string }[];
  recentActivities: { type: string; message: string; timestamp: string; href?: string }[];
  overdueFeesCount: number;
  announcementsLast7Days: number;
  recentEnrollmentsLast7: number;
  financeSummary: { totalCollected: number; unpaidBalance: number; overdueCount: number };
  academicSummary: { recentAvg: number | null; passRate: number | null; passMark: number; markCount: number };
  examsAwaitingMarks?: number;
  unmarkedByClass?: { label: string; levelCode: string | null; count: number }[];
  classPerformance?: ClassPerformance[];
  subjectsWithoutGradingSystem?: number;
  /**
   * Whether the school has ever recorded a fee or an attendance register.
   * Cards for unused features stay hidden rather than showing a row of zeros.
   */
  hasFeeData?: boolean;
  hasAttendanceData?: boolean;
  hasLogo: boolean;
  setup: SetupStatus | null;
  /** Where the school is in its own calendar. */
  term?: TermSummary;
  /** Upcoming exams grouped into each class's sitting. */
  upcomingRounds?: UpcomingRound[];
  /** Exams this term with marks entered but not yet released. */
  unreleasedResults?: number;
}

export function totalAttendanceCount(a: AttendanceToday): number {
  return a.present + a.absent + a.late + a.excused;
}

export type TodoKey = 'release' | 'marks' | 'grading' | 'attendance' | 'fees';

/** One thing only the school can move forward. `href` is the web route; the app maps it to its own. */
export interface DashboardTodo { key: TodoKey; hue: DashboardHue; title: string; detail: string; cta: string; href: string }

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** What needs doing, most urgent first; an empty list means all caught up. */
export function buildTodos(data: DashboardData | null, now: Date = new Date()): DashboardTodo[] {
  if (!data) return [];
  const todos: DashboardTodo[] = [];
  if ((data.unreleasedResults ?? 0) > 0) {
    todos.push({ key: 'release', hue: 'violet', title: `${plural(data.unreleasedResults ?? 0, 'exam')} ready to release`, detail: 'Marks are in, but report cards and parents can’t see them until released.', cta: 'Release results', href: '/dashboard/exams-marks?tab=publish' });
  }
  if ((data.examsAwaitingMarks ?? 0) > 0) {
    const worst = (data.unmarkedByClass ?? []).slice(0, 3).map(c => `${c.label} (${c.count})`).join(', ');
    todos.push({ key: 'marks', hue: 'amber', title: `${plural(data.examsAwaitingMarks ?? 0, 'paper')} still need marks`, detail: worst ? `Most behind: ${worst}.` : 'Exams sat but not yet marked.', cta: 'Enter marks', href: '/dashboard/exams-marks' });
  }
  if ((data.subjectsWithoutGradingSystem ?? 0) > 0) {
    todos.push({ key: 'grading', hue: 'rose', title: `${plural(data.subjectsWithoutGradingSystem ?? 0, 'subject')} without a grading scale`, detail: 'No grade can be printed on report cards for these.', cta: 'Set grading', href: '/dashboard/settings?tab=grading' });
  }
  const inTerm = data.term?.kind === 'in-term';
  const weekday = ![0, 6].includes(now.getDay());
  const marked = data.attendanceToday ? totalAttendanceCount(data.attendanceToday) : 0;
  const unmarked = Math.max(0, data.totalStudents - marked);
  if (data.hasAttendanceData && inTerm && weekday && unmarked > 0) {
    todos.push({ key: 'attendance', hue: 'emerald', title: `${plural(unmarked, 'learner')} not on today’s register`, detail: marked === 0 ? 'No register has been taken yet today.' : `${marked.toLocaleString()} marked so far.`, cta: 'Take attendance', href: '/dashboard/attendance' });
  }
  if (data.hasFeeData && data.overdueFeesCount > 0) {
    todos.push({ key: 'fees', hue: 'orange', title: `${plural(data.overdueFeesCount, 'fee record')} overdue`, detail: 'Past the due date with a balance still owing.', cta: 'Review fees', href: '/dashboard/fees' });
  }
  return todos;
}

export interface SetupStep { id: string; done: boolean; label: string; hint: string; href: string; cta: string }

/** A new school's setup, in the order each step depends on the last. */
export function buildSetupSteps({ hasLogo, totalTeachers, totalStudents, totalUsers, setup }: {
  hasLogo: boolean; totalTeachers: number; totalStudents: number; totalUsers: number; setup: SetupStatus | null;
}): SetupStep[] {
  const count = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
  return [
    { id: 'logo', done: hasLogo, label: 'Add your school logo', hint: 'It prints on every report card.', href: '/dashboard/settings', cta: 'Open settings' },
    ...(setup ? [
      { id: 'term', done: setup.hasCurrentTerm, label: 'Set the current term and its dates', hint: 'Exams, attendance and report cards are filed under a term.', href: '/dashboard/settings?tab=calendar', cta: 'Open calendar' },
      { id: 'classes', done: setup.classes > 0, label: 'Create your classes', hint: 'One class per grade, or several streams — learners and teachers belong to a class.', href: '/dashboard/classes', cta: 'Add classes' },
      { id: 'subjects', done: setup.subjectsOffered > 0, label: 'Choose the subjects you offer', hint: 'Exams and mark sheets are set per subject.', href: '/dashboard/subjects', cta: 'Choose subjects' },
    ] : []),
    { id: 'teachers', done: totalTeachers > 0, label: 'Add teachers', hint: 'They enter marks and take attendance.', href: '/dashboard/people?tab=teachers', cta: 'Add teachers' },
    ...(setup ? [
      {
        id: 'class-teachers', done: setup.classes > 0 && setup.classesWithoutClassTeacher === 0, label: 'Give every class a class teacher',
        hint: setup.classesWithoutClassTeacher > 0 ? `${count(setup.classesWithoutClassTeacher, 'class', 'classes')} without one. Class teachers write report-card remarks.` : 'Class teachers write report-card remarks.',
        href: '/dashboard/users', cta: 'Assign',
      },
      { id: 'subject-teachers', done: setup.subjectTeacherAssignments > 0, label: 'Assign subject teachers', hint: 'Per stream, or for the whole grade — each teacher then sees only their own learners.', href: '/dashboard/subjects?tab=teachers', cta: 'Assign' },
    ] : []),
    { id: 'students', done: totalStudents > 0, label: 'Enrol students', hint: 'Classes, marks and fees all hang off this.', href: '/dashboard/people', cta: 'Add students' },
    ...(setup && setup.learnersWithoutClass > 0 ? [{ id: 'unplaced', done: false, label: `Put ${count(setup.learnersWithoutClass, 'learner')} in a class`, hint: 'Learners without a class get no mark sheets or report cards.', href: '/dashboard/people', cta: 'Fix' }] : []),
    { id: 'users', done: totalUsers > totalTeachers + 1, label: 'Add support staff', hint: 'Bursars and administrators, if you have them.', href: '/dashboard/users', cta: 'Add users' },
  ];
}
