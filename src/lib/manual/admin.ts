import { shot } from './figures';
import {
    activateSection, announcementsSection, assignmentsSection, attendanceSection, helpChapter,
    marksChapter, navigationSection, phoneSection, signInSection,
} from './shared';
import type { Manual } from './types';

export const adminManual: Manual = {
    slug: 'admin',
    title: 'Administrator guide',
    audience: 'Principals, deputy principals, directors of studies and school administrators',
    summary: 'Everything needed to set a school up on Skulbase and run it through the term: the school’s calendar and grading, classes and subjects, staff and learner accounts, marks and report cards, attendance, fees, and messages to parents.',
    chapters: [
        {
            id: 'start',
            title: 'Getting started',
            intro: 'A school is set up once, by its administrator. After that, you add the people and everyone signs in with their own account.',
            sections: [
                {
                    id: 'register-school',
                    title: 'Register your school',
                    summary: 'The first administrator creates a Skulbase account and registers the school. Skulbase then checks and approves the school before it goes live.',
                    figure: shot('onboarding-choose', 'The welcome screen with Register a School, Join as Teacher and Join as Student', 'After creating your account, choose “Register a School”.'),
                    steps: [
                        { title: 'Create your account', body: 'Go to skulbase.com and choose Get Started. Enter your name, email address and a password, or continue with Google.' },
                        { title: 'Choose “Register a School”', body: 'The welcome screen asks how you will use Skulbase. Teachers and learners join with an invite code instead; you are setting up a new school.' },
                        { title: 'School information', body: 'Enter the school’s name, email, phone number and postal address. These print on report cards and receipts, and you can change them later in Settings.' },
                        { title: 'Academic calendar', body: 'Enter the current academic year (for example 2026) and the current term.' },
                        { title: 'Curriculum', body: 'Tick every curriculum and grade your school teaches: CBC, 8-4-4, or both if you still have 8-4-4 classes. Only these appear when marks are entered.' },
                        { title: 'Wait for approval', body: 'Submit the request. While Skulbase approves it you can “Explore while you wait” on a demo school to see how everything works. You are told as soon as your school is approved.' },
                    ],
                },
                activateSection,
                signInSection,
                navigationSection,
            ],
        },
        {
            id: 'dashboard',
            title: 'Your dashboard',
            intro: 'The dashboard is the school at a glance: where you are in the term, what needs doing, and the numbers that matter.',
            sections: [
                {
                    id: 'dashboard-overview',
                    title: 'Reading the dashboard',
                    summary: 'The top of the dashboard says where the school is in its own calendar, then lists anything waiting for you, then the key figures and shortcuts to every common task.',
                    figure: shot('admin-dashboard', 'The administrator dashboard with term progress, attention items, figures and quick actions', 'The administrator dashboard.'),
                    points: [
                        'The term line shows the current term, the week you are in, how many days are left, and a progress bar. During holidays it shows when the next term opens.',
                        '“Needs your attention” lists what only the school can move forward: exams ready to release, papers still missing marks, subjects with no grading scale, learners not on today’s register, and overdue fees. Each item has a button that takes you straight there. When there is nothing, it says “All caught up”.',
                        'The coloured figures are learners, teachers, classes, pass rate, present today and fees collected. Tap any figure to open its page.',
                        'Quick actions give every common task the same weight: enter marks, report cards, attendance, add a learner or staff member, post an announcement, set an assignment, record a payment.',
                        'Further down: each class’s latest results, how classes compare, exams coming up in the next three weeks, attendance and fee summaries, and recent activity.',
                        'The search box finds a learner by name or admission number.',
                    ],
                },
                {
                    id: 'setup-checklist',
                    title: 'The setup checklist',
                    summary: 'Until the school is fully set up, a checklist sits at the top of the dashboard. Work through it from top to bottom; each item has a button that opens the right page.',
                    figure: shot('admin-setup-checklist', 'The Finish setting up checklist with ticked and unticked items', 'The setup checklist. Ticked items are done.'),
                    points: [
                        'Add your school logo; set the current term and its dates; create your classes; choose the subjects you offer; add teachers; give every class a class teacher; assign subject teachers; enrol students; add support staff.',
                        'Close the checklist with the × once you no longer need it.',
                    ],
                },
            ],
        },
        {
            id: 'set-up',
            title: 'Setting up the school',
            intro: 'Do these once at the start, and revisit them at the start of each year. The order matters: classes need grades, subjects need classes, and learners need classes.',
            sections: [
                {
                    id: 'school-profile',
                    title: 'School profile and report card details',
                    summary: 'Settings → School profile holds everything a report card prints about the school.',
                    figure: shot('settings-profile', 'The School profile settings tab', 'Settings → School profile.'),
                    steps: [
                        { title: 'Logo', body: 'Upload a square PNG with a clear background. It prints on report cards and receipts.' },
                        { title: 'Name and contacts', body: 'Check the school name, address, phone and email.' },
                        { title: 'Report cards', body: 'Add the school motto (printed under the name), the principal’s name and signature (printed on the signature line), and the pass mark. The pass mark (for example 50%) decides what counts as a pass everywhere in Skulbase: dashboards, analytics and learners’ results.' },
                        { title: 'Positions', body: 'Choose whether CBC report cards show positions, and how Senior School (Grades 10–12) learners are ranked and grouped by subject combination.' },
                    ],
                },
                {
                    id: 'calendar',
                    title: 'Academic calendar',
                    summary: 'Settings → Academic calendar holds your years and terms. Exactly one term is current: it is what the dashboard, attendance and report cards treat as “now”.',
                    figure: shot('settings-calendar', 'The Academic calendar settings tab with years and terms', 'Settings → Academic calendar.'),
                    steps: [
                        { title: 'Add the year', body: 'Press “Add year” and enter the year, for example 2027.' },
                        { title: 'Add its terms', body: 'Add each term with its name, start and end dates. Optionally add the mid-term reopening date (printed on mid-term report cards) and the date school reopens after the term (printed as “Next term begins”).' },
                        { title: 'Make a term current', body: 'Press “Make current” on the term you are in. Do this at the start of every term.' },
                    ],
                    caution: 'If no term is current, reports and attendance cannot tell which term it is. The dashboard reminds you.',
                },
                {
                    id: 'grading',
                    title: 'Grading systems',
                    summary: 'Settings → Grading systems decides the grade printed for each mark. There are two kinds: subject grading (the grade for each subject’s score) and overall grading (the grade for a learner’s overall mean).',
                    figure: shot('settings-grading', 'The Grading systems settings tab', 'Settings → Grading systems.'),
                    steps: [
                        { title: 'Add a subject grading system', body: 'Choose the curriculum level, give it a name, and list each grade with its score range, points and remark. CBC schools typically use EE, ME, AE and BE; 8-4-4 schools use A to E.' },
                        { title: 'Choose its subjects', body: 'Pick which subjects use this system. A subject with no grading system prints no grade, and the dashboard lists it under “Needs your attention”.' },
                        { title: 'Add an overall grading system (8-4-4)', body: 'This grades each learner’s mean points on report cards and mark sheets.' },
                    ],
                },
                {
                    id: 'classes',
                    title: 'Classes',
                    summary: 'The Classes page lists every grade you teach and its classes (streams), for example Grade 7 East and Grade 7 West. Learners, teachers, mark sheets and report cards all belong to a class.',
                    figure: shot('classes', 'The Classes page with grades and their classes', 'Classes: each grade and its streams, with its class teacher and number of learners.'),
                    steps: [
                        { title: 'Add a grade', body: 'Press “Add grade” and choose it from your curriculum.' },
                        { title: 'Add its classes', body: 'Add each stream. A grade with a single class still needs one class.' },
                        { title: 'Check class teachers', body: 'Each class shows its class teacher, or “No class teacher”. Class teachers are assigned when you add or edit a teacher on the Users page.' },
                    ],
                },
                {
                    id: 'subjects',
                    title: 'Subjects and subject teachers',
                    summary: 'The Subjects page has three tabs: the subjects your school offers, Senior School subject combinations, and which teacher teaches which subject in which class.',
                    figure: shot('subjects', 'The Subjects page', 'Subjects: tick the subjects you offer.'),
                    steps: [
                        { title: 'Choose the subjects you offer', body: 'On the Subjects tab, tick each subject your school teaches for each level.' },
                        { title: 'Senior School combinations (CBC Grades 10–12)', body: 'On the Subject combinations tab, create the combinations learners can take.' },
                        { title: 'Assign subject teachers', body: 'On the Subject teachers tab, give each subject in each class its teacher. A teacher only sees the classes and subjects they are assigned to when entering marks.' },
                    ],
                },
                {
                    id: 'payments-settings',
                    title: 'Online fee payments (optional)',
                    summary: 'Settings → Payments lets learners and parents pay fees from the learner’s Fees page. Payments are matched to the right learner automatically.',
                    figure: shot('settings-payments', 'The Payments settings tab with M-Pesa, Pesapal and bank transfer options', 'Settings → Payments.'),
                    points: [
                        'Choose one automated provider: M-Pesa (direct, with your Paybill or Till number and Daraja keys) or Pesapal. Learners then see a single Pay button.',
                        'Add your bank accounts to show bank transfer details on the learner’s Fees page.',
                        'Payments that could not be matched to a learner (for example a wrong account number) appear under “Unmatched payments” for you to assign.',
                    ],
                    caution: 'Test with the sandbox environment first, then switch to production (live) once a test payment works.',
                },
            ],
        },
        {
            id: 'people',
            title: 'People and accounts',
            intro: 'Everyone at the school has a record on the People page. Staff and learners who need to sign in also get an account, created on the Users page or when you add them, with an invite code to activate it.',
            sections: [
                {
                    id: 'learners',
                    title: 'Add learners',
                    summary: 'People → Students is the school roll. Add learners one at a time or import a whole class from Excel or CSV.',
                    figure: shot('people-students', 'The People page Students tab', 'People → Students: search, filter by class or status, and add or import learners.'),
                    steps: [
                        { title: 'Add one learner', body: 'Press “Add student”. Enter their name, admission number, class, gender and date of birth, and their guardian’s name and phone number (used for SMS).' },
                        { title: 'Import a class list', body: 'Press Import, choose the class everyone in the file joins, and upload your Excel or CSV file. Any rows with problems are listed so you can fix them and import again.' },
                        { title: 'Save the invite codes', body: 'After adding learners, their invite codes are shown once. Copy them or download the CSV before closing, and give each learner their code.' },
                    ],
                    points: [
                        'Filter by class, status (active, transferred, graduated), pathway or subject combination, or search by name, admission number or guardian.',
                        '“Pathways” sets Senior School pathways for several learners at once.',
                    ],
                },
                {
                    id: 'add-learner-form',
                    title: 'The Add student form',
                    summary: 'Guardian phone numbers matter: they are where results, absence notices and announcements are texted.',
                    figure: shot('people-add-student', 'The Add student form', 'Adding one learner.'),
                },
                {
                    id: 'import',
                    title: 'Import learners from a spreadsheet',
                    summary: 'The fastest way to enrol a class. Every learner in the file joins the class you choose.',
                    figure: shot('people-import', 'The Import students dialog', 'Importing a class list.'),
                    tip: 'Put one learner per row, with columns for first name, last name, admission number, gender and guardian phone.',
                },
                {
                    id: 'staff',
                    title: 'Staff and accounts',
                    summary: 'The Users page lists everyone with an account. “Add user” creates an account for a teacher, learner, administrator or other staff member and gives you their invite code.',
                    figure: shot('users-add', 'The Add User form', 'Add user: choose the role. For a teacher, you can also make them a class teacher and list the subjects they teach.'),
                    steps: [
                        { title: 'Add the person', body: 'On Users press “Add user”. Enter their first and last name and phone number. Use the sequence number only when two people have the same name.' },
                        { title: 'Choose the role', body: 'Teacher, Student, Other Staff (for example a bursar or secretary) or Admin.' },
                        { title: 'For a teacher', body: 'Optionally choose the class they are class teacher of, and add the grades and subjects they teach.' },
                        { title: 'Share their invite', body: 'Skulbase shows their username, invite code and an activation link. It tries to send the code by SMS; you can also press “Send on WhatsApp” or copy it.' },
                    ],
                    points: [
                        'Open anyone on the Users page to see their full profile, edit their account, or reset it (which issues a new invite code, for example when someone forgets their password and has no email address).',
                        '“Print activation codes” prints codes for everyone who has not activated yet, for example to hand out to a class.',
                    ],
                },
                {
                    id: 'staff-and-parents',
                    title: 'Staff and parents directories',
                    summary: 'People → Staff lists teachers and other staff with their roles, subjects and classes. People → Parents is built from guardian details on learners’ records: one card per guardian with their children, and buttons to call or email.',
                    figure: shot('people-staff', 'The People page Staff tab', 'People → Staff.'),
                },
            ],
        },
        marksChapter('Marks are entered by teachers (and administrators) on Exams & Marks, checked, and then released so learners can see them. As administrator you can do everything a teacher can, for every class and subject, and you also add exams to the term.'),
        {
            id: 'exams',
            title: 'Setting up exams',
            intro: 'Each term’s exams are created once, and every subject in every class gets its own exam to enter marks against.',
            sections: [
                {
                    id: 'add-exams',
                    title: 'Add exams to the term',
                    summary: 'On Exams & Marks, the “More” button next to the exams opens the exam menu.',
                    figure: shot('marks-exam-menu', 'The exam menu with school exams, external and mock exams and tools', 'Add exams to this term: each one creates an exam for every subject in every class.'),
                    points: [
                        'School exams: Opener, CAT, Midterm, Endterm and others. Pick one to create it for every subject in every class for the term.',
                        'External and mock exams: zone, sub-county, county and national exams and mocks.',
                        'Tools: fill in the term’s exams for subjects added since they were set up, or create a single exam for one subject and class.',
                    ],
                },
            ],
        },
        {
            id: 'reports-chapter',
            title: 'Report cards and results for parents',
            intro: 'Report Cards turns released marks into printable report cards and mark sheets, and texts results to parents.',
            sections: [
                {
                    id: 'report-cards',
                    title: 'Generate report cards',
                    summary: 'Choose the class, term and exam once; then pick what to produce.',
                    figure: shot('reports', 'The Report cards page with class, term, card design and exam choices', 'Report cards: choose the scope, then an action.'),
                    steps: [
                        { title: 'Choose the scope', body: 'Pick the class and the term. Optionally type a title for the card (for example “Mid Term 1 Report”) and choose a card design.' },
                        { title: 'Choose the exam', body: 'Each exam shows how many subjects have marks. “Most recent” is suggested. Report cards, the mark sheet and SMS all use this exam.' },
                        { title: 'Whole class', body: 'Press “Generate & download” for every learner’s card in one PDF, ready to print.' },
                        { title: 'One learner', body: 'Press “Choose learner” to download a single card.' },
                        { title: 'Mark sheet', body: 'Downloads the ranked subject scores for the whole class.' },
                    ],
                    points: [
                        'Class teacher and principal comments are added under “Comments on the cards” and print on each learner’s card.',
                        'Each report card carries a QR code. Scanning it opens a page that shows the approved results, so parents and others can check a card is genuine.',
                        'Senior School classes can split the class download by subject combination.',
                    ],
                },
                {
                    id: 'sms-results',
                    title: 'Text results to parents',
                    summary: '“SMS to parents” sends each guardian their child’s results for the chosen exam.',
                    figure: shot('reports-sms', 'The Text results to parents dialog', 'Choose which learners’ guardians to text, check the example message, and send.'),
                    steps: [
                        { title: 'Open it', body: 'With the class, term and exam chosen, press “Send SMS”.' },
                        { title: 'Choose learners', body: 'Everyone is selected; untick anyone to leave out. Learners without a guardian phone number are skipped.' },
                        { title: 'Check and send', body: 'Read the example message, then confirm. SMS costs apply per message.' },
                    ],
                },
                {
                    id: 'compare-terms',
                    title: 'Compare terms',
                    summary: '“Compare terms” shows how a class’s average and pass rate moved between two terms, overall and subject by subject.',
                    figure: shot('reports-compare', 'The Compare terms dialog', 'Compare two terms for a class.'),
                },
            ],
        },
        {
            id: 'attendance-chapter',
            title: 'Attendance',
            intro: 'Class teachers usually take the register; administrators can take or correct it for any class.',
            sections: [attendanceSection],
        },
        {
            id: 'fees-chapter',
            title: 'Fees',
            intro: 'Fees tracks what each learner has been billed for the term, what they have paid, and what is still owed. Only administrators can see the Fees page; learners see their own fees in their portal.',
            sections: [
                {
                    id: 'fee-records',
                    title: 'Fee records',
                    summary: 'The Fee records tab shows the term’s totals (expected, collected, outstanding, overdue), a collection progress bar, and one row per learner.',
                    figure: shot('fees', 'The Fees page with totals and fee records', 'Fees → Fee records for the chosen term.'),
                    points: [
                        'Choose the term at the top. Search by learner or admission number, or filter by status and class.',
                        '“Add record” bills one learner. “Export” downloads the list as a spreadsheet.',
                        'Each row has Pay (record a payment), payment history (with receipts), edit and delete.',
                    ],
                },
                {
                    id: 'batch-fees',
                    title: 'Bill a whole class at once',
                    summary: 'The Batch entry tab bills every learner in a class for the term in one go.',
                    figure: shot('fees-batch', 'The Batch entry tab', 'Fees → Batch entry.'),
                    steps: [
                        { title: 'Choose the class and term', body: 'Every active learner in the class is listed.' },
                        { title: 'Set the fee', body: 'Type the fee once and press Apply to fill it for everyone, and set one due date. Change any learner’s fee individually if needed.' },
                        { title: 'Record payments now (optional)', body: 'Enter any payment already received in “Payment now”; “Balance after” updates as you type.' },
                        { title: 'Save all', body: 'Press “Save all”. Learners already billed for the term keep their record and are updated rather than billed twice.' },
                    ],
                },
                {
                    id: 'record-payment',
                    title: 'Record a payment',
                    summary: 'For cash, cheques, bank deposits and M-Pesa messages you receive yourself. Online payments made through the learner’s portal are recorded automatically.',
                    figure: shot('fees-payment', 'The Record payment dialog', 'Record payment: the amount is filled with the balance; change it for a part payment.'),
                    steps: [
                        { title: 'Press Pay', body: 'On the learner’s row, press Pay.' },
                        { title: 'Enter the payment', body: 'Type the amount, the date paid (change it when recording an older slip), the method and, optionally, who paid and a note.' },
                        { title: 'Save', body: 'The balance updates straight away, and a receipt is available from the payment history.' },
                    ],
                },
                {
                    id: 'payments-log',
                    title: 'The payments log',
                    summary: 'The Payments tab lists every payment received, filtered by date, method (automatic or manual) and status. Unmatched online payments appear here too, with a button to assign them to the right learner.',
                },
            ],
        },
        {
            id: 'communication',
            title: 'Announcements and homework',
            intro: 'Keep staff, learners and parents informed, and see all homework set across the school.',
            sections: [
                { ...announcementsSection(true), figure: shot('announcements', 'The Announcements page with a list of announcements', 'Announcements: important ones are highlighted.') },
                {
                    id: 'announcements-new',
                    title: 'Writing an announcement',
                    summary: 'Keep the title short; it is what people see first on their dashboards and in the SMS.',
                    figure: shot('announcements-new', 'The new announcement form', 'A new announcement, with the option to text every guardian.'),
                },
                { ...assignmentsSection, figure: shot('assignments', 'The Assignments page', 'Assignments: every piece of homework set across the school.') },
            ],
        },
        {
            id: 'analytics-chapter',
            title: 'Analytics',
            intro: 'Analytics compares performance across the school: class by class, subject by subject, term by term.',
            sections: [{
                id: 'analytics-page',
                title: 'Reading Analytics',
                summary: 'Choose a class (or all classes), an academic year and a term. The page shows averages and pass rates against your pass mark, which classes and subjects are strongest and weakest, and which classes still have exams to mark.',
                figure: shot('analytics', 'The Analytics page', 'Analytics for the whole school.'),
                tip: 'The filters are kept in the page address, so you can bookmark or share a view (for example Grade 8, Term 2).',
            }],
        },
        {
            id: 'phone',
            title: 'On your phone',
            intro: 'Skulbase works fully on a phone.',
            sections: [phoneSection('mobile-admin', 'The administrator dashboard on a phone. The bottom bar holds Dashboard, Exams, People and Fees; everything else is under More.')],
        },
        helpChapter,
    ],
};
