import { shot } from './figures';
import {
    activateSection, announcementsSection, assignmentsSection, attendanceSection, helpChapter,
    marksChapter, navigationSection, phoneSection, signInSection,
} from './shared';
import type { Manual, ManualChapter } from './types';

const startChapter: ManualChapter = {
    id: 'start',
    title: 'Getting started',
    intro: 'Your school administrator creates your account and gives you an invite code. You activate it once, then sign in with your username or email.',
    sections: [activateSection, signInSection, navigationSection],
};

const marksIntro = 'Entering marks is the main job in Skulbase. You only see the classes and subjects your administrator has assigned to you; if one is missing, ask them to add it on the Subjects page.';

const communicationChapter: ManualChapter = {
    id: 'communication',
    title: 'Homework and announcements',
    intro: 'Set homework for your classes, mark what learners hand in, and post notices.',
    sections: [assignmentsSection, announcementsSection(false)],
};

export const classTeacherManual: Manual = {
    slug: 'class-teacher',
    title: 'Class teacher guide',
    audience: 'Teachers who are responsible for a class',
    summary: 'How to enter and correct marks, keep your class’s register, look after your class list, and produce report cards for parents.',
    chapters: [
        startChapter,
        {
            id: 'dashboard',
            title: 'Your dashboard',
            intro: 'Your dashboard leads with the job that matters most in a term: getting marks in.',
            sections: [{
                id: 'teacher-dashboard',
                title: 'Reading your dashboard',
                summary: 'The top shows where the school is in the term and how many marks you still have to enter. The big button takes you straight to the next mark sheet to finish.',
                figure: shot('teacher-dashboard', 'The class teacher dashboard with marking progress', 'A class teacher’s dashboard.'),
                points: [
                    '“Continue: Mathematics · Grade 7 East” opens the exam you were part-way through, or the next one to start.',
                    'At a glance: marks still to enter, exams fully marked, learners in your class, and your class average.',
                    'My marking lists every exam you enter marks for this term, with how many learners are marked. Tap one to open its mark sheet.',
                    'Quick actions open marks, class results, report cards, attendance and your class list. “Coming up” shows exams in the next three weeks.',
                    'If report cards are still to be generated for your class, a reminder appears on the right.',
                ],
            }],
        },
        marksChapter(marksIntro),
        {
            id: 'class',
            title: 'Your class',
            intro: 'As class teacher you keep the register and the class list, and produce your class’s report cards.',
            sections: [
                attendanceSection,
                {
                    id: 'my-students',
                    title: 'My Students',
                    summary: 'My Students is your class list: every learner in your class, with their admission number, guardian and contact details. Search by name, admission number or guardian.',
                    figure: shot('teacher-my-students', 'The My Students page showing a class list', 'My Students: your own class only.'),
                    tip: 'If a learner is missing or in the wrong class, or a guardian’s phone number has changed, ask your administrator to update their record. Correct phone numbers make sure SMS results and absence notices arrive.',
                },
                {
                    id: 'report-cards',
                    title: 'Report cards for your class',
                    summary: 'On Report Cards, choose your class, the term and the exam, then download every card, one learner’s card or the mark sheet.',
                    figure: shot('reports', 'The Report cards page', 'Report cards: choose the class, term and exam, then an action.'),
                    steps: [
                        { title: 'Choose the scope', body: 'Pick your class and the term, and optionally a title and card design.' },
                        { title: 'Choose the exam', body: 'Each exam shows how many subjects have marks. Make sure all subjects are in before printing.' },
                        { title: 'Add your comments', body: 'Under “Comments on the cards”, write a class teacher remark for each learner (for example “Excellent progress this term”). They print on the cards.' },
                        { title: 'Download', body: '“Generate & download” produces every card in one PDF; “Choose learner” produces one; “Download mark sheet” gives the ranked class list.' },
                    ],
                    points: ['Sending results to parents by SMS is done by an administrator.'],
                },
            ],
        },
        communicationChapter,
        { id: 'phone', title: 'On your phone', intro: 'You can enter marks and take the register from a phone.', sections: [phoneSection('mobile-teacher-marks', 'Entering marks on a phone. The bottom bar holds Dashboard, Exams, Attendance and Reports.')] },
        helpChapter,
    ],
};

export const subjectTeacherManual: Manual = {
    slug: 'subject-teacher',
    title: 'Subject teacher guide',
    audience: 'Teachers who teach subjects in one or more classes',
    summary: 'How to enter and correct marks for the subjects you teach, release results, set and mark homework, and post announcements.',
    chapters: [
        startChapter,
        {
            id: 'dashboard',
            title: 'Your dashboard',
            intro: 'Your dashboard shows how much marking is left this term and takes you straight to the next mark sheet.',
            sections: [{
                id: 'teacher-dashboard',
                title: 'Reading your dashboard',
                summary: 'The top shows the term and how many marks you have left to enter. “Continue” opens the next mark sheet to finish.',
                figure: shot('subject-teacher-dashboard', 'The subject teacher dashboard', 'A subject teacher’s dashboard.'),
                points: [
                    'At a glance: marks still to enter, exams fully marked, your subjects’ average, and how many marks you have entered.',
                    'My marking lists every exam you enter marks for this term, with progress. Tap one to open it.',
                    'Quick actions open marks, results, release, assignments and announcements.',
                ],
            }],
        },
        marksChapter(marksIntro),
        communicationChapter,
        { id: 'phone', title: 'On your phone', intro: 'You can enter marks from a phone, even on a weak connection.', sections: [phoneSection('mobile-teacher-marks', 'Entering marks on a phone.')] },
        helpChapter,
    ],
};
