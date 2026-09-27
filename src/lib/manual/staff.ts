import { shot } from './figures';
import { activateSection, helpChapter, navigationSection, signInSection } from './shared';
import type { Manual } from './types';

export const staffManual: Manual = {
    slug: 'staff',
    title: 'Staff guide',
    audience: 'Non-teaching staff such as bursars, secretaries and support staff',
    summary: 'How to activate your account, sign in and keep up with school announcements. Your administrator can give you more access if your job needs it.',
    chapters: [
        {
            id: 'start',
            title: 'Getting started',
            intro: 'Your school administrator adds you as staff and gives you an invite code to activate your account.',
            sections: [activateSection, signInSection, navigationSection],
        },
        {
            id: 'dashboard',
            title: 'Your dashboard and announcements',
            intro: 'Staff accounts see the school’s announcements.',
            sections: [{
                id: 'staff-dashboard',
                title: 'Your dashboard',
                summary: 'Your dashboard welcomes you with your job title and links to Announcements, where you can read and search every notice from the school. Posting announcements is done by administrators and teachers.',
                figure: shot('staff-dashboard', 'The staff dashboard', 'A staff member’s dashboard.'),
                points: [
                    'Your job title (for example Bursar) shows on your account.',
                    'If your work needs access to fees, attendance or other pages, ask your administrator to change your role.',
                ],
            }],
        },
        helpChapter,
    ],
};
