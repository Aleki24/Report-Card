import { phoneShot, shot } from './figures';
import type { ManualChapter, ManualSection } from './types';

/*
  Sections for the optional modules a school can switch on (Settings →
  Modules). Pages only appear when the school runs the module and the person
  has the role or duty that uses it, so every section says who sees it.
*/

export const moduleNote = 'You only see a page if your school has switched its module on and your role or duty uses it. If something here is missing from your menu, ask your administrator.';

// ── Everyday tools every staff member has ──────────────────────

export const calendarSection: ManualSection = {
    id: 'calendar',
    title: 'The school calendar',
    summary: 'Calendar lists what is coming up across the school: exam windows, marks deadlines, report-card release dates, meetings and holidays. Everyone can read it; the DOS, deputy and principal add events.',
    figure: shot('calendar', 'The school calendar with upcoming events by date', 'Calendar → Upcoming: each event shows its date, who it is for and its type.'),
    points: [
        'Events are marked by type (exam, deadline, report release, meeting, holiday) and by who they are for: everyone, staff, learners or parents.',
        'Parents and learners only see events meant for them.',
        'To add an event (if you are allowed), open “Manage events”, press Add, and fill in the title, type, dates, who sees it and any details. An event can be linked to an exam.',
    ],
};

export const timetableViewSection: ManualSection = {
    id: 'timetable-view',
    title: 'Your timetable',
    summary: 'Timetable shows the published timetable for the week: periods down the side, days across the top, each lesson with its class, teacher and room. On a phone it shows one day at a time.',
    figure: shot('timetable-view', 'A published weekly timetable grid', 'Timetable → My timetable. Breaks and lunch are shown between periods.'),
    points: [
        '“Show” switches between your own timetable and any class, teacher or room.',
        'When a colleague is away and you are asked to cover a lesson, it is arranged under “Lesson cover”; check the timetable at the start of each day.',
    ],
};

export const leaveSection: ManualSection = {
    id: 'leave',
    title: 'Apply for leave',
    summary: 'Staff Leave is where you ask for time off. The principal, deputy or HR officer approves it, and you can see the decision on the same page.',
    figure: shot('leave', 'The Staff leave page with leave requests and their status', 'Staff leave: your requests and their status. Approvers see Approve and Decline buttons.'),
    steps: [
        { title: 'Apply', body: 'Press “Apply for leave”. Choose the type (annual, sick, maternity, compassionate and so on), the first and last day, and the reason.' },
        { title: 'Arrange cover', body: 'Under “Lessons and duties to cover”, say who will take your classes or duties, so the timetabler can arrange cover.' },
        { title: 'Wait for a decision', body: 'The request shows Pending until it is approved or declined. You can edit or cancel it while it is pending.' },
    ],
};

export const requisitionSection: ManualSection = {
    id: 'requisitions',
    title: 'Ask the store for supplies',
    summary: 'Inventory & stores → Requisitions is how you ask for exercise books, chalk, chemicals or equipment. The storekeeper approves the request and issues the items, and the stock count goes down automatically.',
    figure: shot('inventory-requisitions', 'Store requisitions with their status', 'Requisitions: Pending until approved, then Issued when you collect them.'),
    steps: [
        { title: 'Request', body: 'Press “Request from store”, choose the item, the quantity and what it is for (for example “Grade 7 exam booklets”).' },
        { title: 'Collect', body: 'When the storekeeper approves and issues it, the status changes to Issued. Collect the items from the store.' },
    ],
};

export const expenseRequestSection: ManualSection = {
    id: 'expense-requests',
    title: 'Ask for money to be spent',
    summary: 'Expenses → My requests lets any staff member raise a payment voucher, for example to buy lab chemicals or pay for printing. The bursar or principal approves it before it is paid.',
    steps: [
        { title: 'Raise it', body: 'Press “Record expense”. Say what it is for, the amount, the date, the supplier and the vote head, and attach the invoice reference.' },
        { title: 'Follow it', body: 'It shows Pending, then Approved (waiting for payment) or Rejected, then Paid with the payment reference.' },
    ],
};

export const reportIncidentSection: ManualSection = {
    id: 'report-incident',
    title: 'Report a discipline incident',
    summary: 'Any teacher can report an incident on the Discipline page. You see the incidents you reported; the discipline master decides the action and tells the parent.',
    figure: shot('discipline', 'The Discipline page with incidents, severity and status', 'Discipline: each incident with its category, severity, action and status.'),
    steps: [
        { title: 'Report it', body: 'Press “Report incident”. Choose the learner, the date, the category (for example lateness or fighting), how serious it is (minor, major or critical) and describe what happened.' },
        { title: 'What happens next', body: 'The discipline master records the action taken (for example a warning, counselling or calling the parent in), marks it resolved, and can text the parent with “Tell parent”.' },
    ],
};

export const everydayToolsChapter = (intro: string): ManualChapter => ({
    id: 'everyday-tools',
    title: 'Calendar, leave and requests',
    intro: `${intro} ${moduleNote}`,
    sections: [calendarSection, timetableViewSection, leaveSection, requisitionSection, expenseRequestSection],
});

// ── Teaching records (teachers) ────────────────────────────────

export const uploadPaperSection: ManualSection = {
    id: 'upload-paper',
    title: 'Upload an exam paper for moderation',
    summary: 'The Exam paper bank keeps exam papers safe until the exam. You upload your paper, your head of department moderates it, the exams office prints it, and it is released after the exam.',
    figure: shot('exam-papers-mine', 'The Exam paper bank showing My papers with their status', 'Exam papers → My papers: every paper you set and where it is in moderation.'),
    steps: [
        { title: 'Upload', body: 'Press “Upload paper”. Give it a title (for example “End of Term 2 Mathematics”), choose the subject, class level and term, the paper label (P1, P2), how many copies are needed, and when it may be released after the exam. Attach the paper (PDF or Word) and, ideally, the marking scheme.' },
        { title: 'Submit it', body: 'Open the paper and submit it for moderation. Its status changes from Draft to Submitted.' },
        { title: 'Act on comments', body: 'If it comes back Returned, read the moderator’s comment in its History, replace the files and submit again. Once Approved it is locked for printing.' },
    ],
    points: [
        'Papers open stamped with the viewer’s name and the time, and every download is logged, so leaks can be traced.',
        'Past papers are available once released, for revision.',
    ],
};

export const schemesSection: ManualSection = {
    id: 'schemes',
    title: 'Schemes of work, lesson plans and records of work',
    summary: 'Professional Records keeps your schemes of work, lesson plans and records of work together, and works out how much of the syllabus each class has covered.',
    figure: shot('lesson-records', 'Professional records with schemes of work and their status', 'Professional records → Schemes of work.'),
    steps: [
        { title: 'Write a scheme of work', body: 'Press “Add scheme of work”, choose the class, subject and term, then fill in the weeks: each lesson with its topic or sub-strand and details. Set the number of teaching weeks and lessons a week.' },
        { title: 'Draft with AI (optional)', body: '“Draft with AI” fills the rows with a suggested scheme from the topics you list. It replaces the rows below, so check and edit every row before saving.' },
        { title: 'Submit for review', body: 'Save, then press “Submit for review”. Your head of department or the DOS approves it or returns it with a comment.' },
        { title: 'Plan lessons', body: 'Under Lesson plans, add a plan for a lesson: the date, topic, specific objectives, introduction, lesson development, conclusion, resources and your self-evaluation afterwards.' },
        { title: 'Record what you taught', body: 'Tick lessons as Taught inside the scheme, or add a record of work with the date, work covered and remarks. Both count towards syllabus coverage.' },
    ],
};

export const cbcSection: ManualSection = {
    id: 'cbc',
    title: 'CBC assessment',
    summary: 'CBC Assessment records each learner’s level for a strand and sub-strand: Exceeding (EE), Meeting (ME), Approaching (AE) or Below (BE) expectations.',
    figure: shot('cbc', 'The CBC assessment page with learners rated EE, ME, AE or BE', 'CBC assessment: pick the class, learning area, term and strand, then rate each learner.'),
    steps: [
        { title: 'Choose what you are assessing', body: 'Pick the class, the learning area, the term, and the strand (for example Numbers) and sub-strand (for example Fractions).' },
        { title: 'Open the class list', body: 'Press “Open class list”. Every learner in the class is listed.' },
        { title: 'Rate each learner', body: 'Tap EE, ME, AE or BE on each row and add a comment if you like. The totals at the top update as you go.' },
        { title: 'Save', body: 'Press Save. You can come back and change a rating later.' },
    ],
};

export const teachingRecordsChapter: ManualChapter = {
    id: 'teaching-records',
    title: 'Exam papers, schemes and CBC',
    intro: `Setting papers, keeping professional records and assessing CBC strands. ${moduleNote}`,
    sections: [uploadPaperSection, schemesSection, cbcSection, reportIncidentSection],
};

// ── Parent portal (admin side) ─────────────────────────────────

export const parentAccountsSection: ManualSection = {
    id: 'parent-accounts',
    title: 'Give parents their own login',
    summary: 'With the Parent Portal module on, parents can sign in to follow each of their children. You link a parent to a learner on the Parent accounts page, and the parent activates their account with the invite code.',
    figure: shot('parent-accounts', 'The Parent accounts page with a linked parent and the Link a parent form', 'Parent accounts: choose a learner, see who is linked, and link another parent.'),
    steps: [
        { title: 'Choose the learner', body: 'Pick the learner. Parents already linked to them are listed with their relationship, phone and whether their account is active.' },
        { title: 'Link a parent', body: 'Enter the parent’s first and last name, phone number and relationship (mother, father, guardian, sponsor), and press “Link parent”.' },
        { title: 'Give them the code', body: 'Skulbase shows an invite code. The parent activates their account with it on the activation page, exactly like a teacher or learner.' },
    ],
    points: [
        'A parent with several children at the school is matched by phone number, so they get one login that shows all their children.',
        'Unlinking a parent stops them seeing that child.',
    ],
};

export const parentPortalFigure = phoneShot('mobile-parent', 'The parent portal on a phone', 'The parent portal on a phone: one tab per child.');
