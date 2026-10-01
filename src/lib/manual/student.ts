import { shot } from './figures';
import { activateSection, helpChapter, navigationSection, phoneSection, signInSection } from './shared';
import type { Manual } from './types';

export const studentManual: Manual = {
    slug: 'student',
    title: 'Learner guide',
    audience: 'Learners (parents have their own Parent guide)',
    summary: 'How to activate your account, see your results and report cards, follow your timetable, hand in homework, check attendance and pay fees. Parents have their own guide; the last chapter summarises what they receive.',
    chapters: [
        {
            id: 'start',
            title: 'Getting started',
            intro: 'Your school gives you an invite code. You use it once to set up your own login.',
            sections: [activateSection, signInSection, navigationSection],
        },
        {
            id: 'dashboard',
            title: 'Your dashboard',
            intro: 'Your dashboard is everything that matters this week: exams coming up, homework to hand in, your latest results and school news.',
            sections: [{
                id: 'student-dashboard',
                title: 'Reading your dashboard',
                summary: 'The top says what is coming up (your next exam and how much homework is due), and shows your average for the latest term and how it changed.',
                figure: shot('student-dashboard', 'The learner dashboard', 'A learner’s dashboard.'),
                points: [
                    'At a glance: your average, number of subjects, results released, attendance rate and, if your school uses it, your fee balance. Tap any of them to open the page.',
                    'Latest results shows your newest released marks. Progress over time charts your average each term against the pass mark.',
                    'Coming up lists exams in the next 30 days. Announcements shows notices from school; important ones are marked in red.',
                    'Study goals lets you set yourself targets, such as “Score 75% in Mathematics”, and tick them off.',
                ],
            }],
        },
        {
            id: 'homework',
            title: 'Homework',
            intro: 'Homework set by your teachers appears on your dashboard. You hand it in there too.',
            sections: [{
                id: 'hand-in',
                title: 'Hand in homework',
                summary: 'The Homework list shows work still to hand in first, then late work, then work you have handed in and work your teacher has marked.',
                figure: shot('student-handin', 'The hand-in dialog showing the teacher’s instructions and a box for your answer', 'Tap a piece of homework to read the instructions and hand it in.'),
                steps: [
                    { title: 'Open it', body: 'Tap the homework in the list. You see your teacher’s instructions and any file they attached (“Open the attachment”).' },
                    { title: 'Do the work', body: 'Type your answer in the box, attach a file (a photo of your written work, a PDF or a document up to 10 MB), or both.' },
                    { title: 'Hand in', body: 'Press “Hand in”. It now shows “Handed in”.' },
                    { title: 'See your mark', body: 'When your teacher marks it, it shows “Marked” with your score. Open it to read their feedback.' },
                ],
                points: [
                    'You can hand in again to replace your work until your teacher marks it.',
                    'Late work can still be handed in; it shows “Was due” with the date.',
                ],
            }],
        },
        {
            id: 'results',
            title: 'Results and subjects',
            intro: 'You see marks once your teachers release them.',
            sections: [
                {
                    id: 'my-results',
                    title: 'My results',
                    summary: 'The Exam marks tab lists every released mark by term and then by exam (for example Midterm, then CAT), with your score, percentage, grade and each exam’s average.',
                    figure: shot('student-results', 'The My results page grouped by term and exam', 'My results: each exam in its own table.'),
                    points: [
                        'Filter by year, term or subject.',
                        'Marks in green are at or above your school’s pass mark; red ones are below it.',
                        'The Report cards tab lists your official report cards. Open one to see its details and press “Download PDF”.',
                    ],
                },
                {
                    id: 'my-timetable',
                    title: 'My timetable',
                    summary: 'If your school uses the timetable, My timetable shows your class’s lessons for the week: each period with the subject, teacher and room. On a phone it shows one day at a time.',
                    figure: shot('student-timetable', 'A learner’s weekly timetable', 'My timetable.'),
                },
                {
                    id: 'my-subjects',
                    title: 'My subjects',
                    summary: 'My Subjects lists the subjects you take. Open one to see how you have done in it each term and the homework set for it.',
                    figure: shot('student-subject', 'A subject page with term averages and homework', 'One subject: your latest average, change since last term, best term, a term-by-term chart and its homework.'),
                },
            ],
        },
        {
            id: 'attendance-fees',
            title: 'Attendance and fees',
            intro: 'Check your attendance record and your fee balance, and pay fees if your school accepts online payments.',
            sections: [
                {
                    id: 'my-attendance',
                    title: 'Attendance',
                    summary: 'Your attendance rate and every day your class teacher recorded: present, absent, late or excused, with any reason. Filter by month.',
                    figure: shot('student-attendance', 'The learner attendance page', 'Attendance, as recorded by your class teacher.'),
                },
                {
                    id: 'my-fees',
                    title: 'Fees and paying',
                    summary: 'Fees shows the balance to pay, what you were billed and what has been paid, term by term, with receipts.',
                    figure: shot('student-fees', 'The learner fees page with balance and payment options', 'Fees: the balance, how to pay, and payment history.'),
                    steps: [
                        { title: 'Pay with M-Pesa', body: 'If your school uses M-Pesa, press Pay, enter the phone number and amount (you can pay part of the balance), and enter your M-Pesa PIN when the prompt appears on that phone. The page updates when the payment is received.' },
                        { title: 'Pay with Pesapal', body: 'If your school uses Pesapal, press Pay and finish on the Pesapal page that opens (card or mobile money). Come back to Skulbase; your balance updates automatically.' },
                        { title: 'Pay by bank', body: 'Use the bank account shown on the page and keep your slip or reference. Your school records it when the money clears.' },
                        { title: 'Receipts', body: 'Tap a term to see its payments and open a receipt.' },
                    ],
                },
                {
                    id: 'my-profile',
                    title: 'My profile',
                    summary: 'Your details as the school holds them: admission number, class, date of birth and guardian. You can update your own phone number; for anything else, ask your school.',
                    figure: shot('student-profile', 'The learner profile page', 'My profile.'),
                },
            ],
        },
        {
            id: 'parents',
            title: 'For parents and guardians',
            intro: 'If your school uses the Parent Portal, parents get their own login to follow every child (see the Parent guide). Without one, Skulbase reaches parents by SMS on the phone number the school has for them.',
            sections: [{
                id: 'parents-info',
                title: 'What parents receive',
                summary: 'Keep your phone number up to date with the school so these reach you.',
                points: [
                    'Results by SMS when the school sends them after an exam.',
                    'A text if your child is marked absent, when the class teacher sends absence notices.',
                    'Important announcements, such as closing and opening dates.',
                    'Printed report cards carry a QR code. Scan it with your phone camera to open a page that shows the results the school approved, so you can check the card is genuine.',
                    'To pay fees online, sign in with your child on their learner account and use the Fees page.',
                ],
            }],
        },
        { id: 'phone', title: 'On your phone', intro: 'Skulbase works on any smartphone.', sections: [phoneSection('mobile-student', 'The learner dashboard on a phone. The bottom bar holds Dashboard, My Results and My Subjects; everything else is under More.')] },
        helpChapter,
    ],
};
