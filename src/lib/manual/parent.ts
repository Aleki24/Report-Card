import { shot } from './figures';
import { activateSection, helpChapter, navigationSection, signInSection } from './shared';
import { parentPortalFigure } from './modules';
import type { Manual } from './types';

export const parentManual: Manual = {
    slug: 'parent',
    title: 'Parent guide',
    audience: 'Parents and guardians',
    summary: 'How to activate your parent account and follow each of your children: results and report cards, fees, attendance, the school bus and school news. It also covers what you receive by SMS if you do not have an account.',
    chapters: [
        {
            id: 'start',
            title: 'Getting started',
            intro: 'If your school uses the Parent Portal, it links your phone number to your child and gives you an invite code. One account shows all your children at the school.',
            sections: [
                { ...activateSection, summary: 'The school gives you a personal invite code (or a link with the code in it). You use it once to set up your own login.' },
                signInSection,
                navigationSection,
            ],
        },
        {
            id: 'children',
            title: 'My children',
            intro: 'Your home page after signing in. Each child has a tab at the top; tap one to see their summary.',
            sections: [
                {
                    id: 'overview',
                    title: 'A child at a glance',
                    summary: 'The figures at the top show the child’s average score for the current term, days absent in the last 30 days, the fee balance and, if they use it, the school bus.',
                    figure: shot('parent-portal', 'The parent portal showing one child’s results, fees, bus and attendance', 'My children: one tab per child.'),
                    points: [
                        'School bus: whether the bus is on the road, when it was last seen, and whether your child has boarded. You also see their route and stop with pick-up and drop-off times.',
                        'Latest results: the newest marks the school has released, with grades.',
                        'Fees: what is owed for each term. To pay online, sign in on your child’s learner account and use their Fees page.',
                        'Report cards: the average, position and teachers’ comments from each report card.',
                        'Attendance: every school day in the last 30 days.',
                        'Coming up and Notices: exams, meetings and holidays from the school calendar, and announcements.',
                    ],
                },
                {
                    id: 'phone',
                    title: 'On your phone',
                    summary: 'The parent portal is built for phones. Save skulbase.com to your home screen to open it like an app.',
                    figure: parentPortalFigure,
                },
                {
                    id: 'missing-child',
                    title: 'A child is missing',
                    summary: 'If a child does not appear, the school has not linked them to your phone number yet. Ask the school office to link your account to them under Parent accounts.',
                },
            ],
        },
        {
            id: 'without-account',
            title: 'Without an account',
            intro: 'Parents who do not use the portal still hear from the school by SMS, on the phone number the school has for them.',
            sections: [{
                id: 'sms',
                title: 'What you receive by SMS',
                summary: 'Keep your phone number up to date with the school so these reach you.',
                points: [
                    'Results after an exam, when the school sends them.',
                    'A text when your child is marked absent, if the class teacher sends absence notices.',
                    'Fee balance reminders and important announcements, such as closing and opening dates.',
                    'Printed report cards carry a QR code. Scan it with your phone camera to see the results the school approved, and check the card is genuine.',
                ],
            }],
        },
        helpChapter,
    ],
};
