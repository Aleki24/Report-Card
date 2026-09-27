import { shot } from './figures';
import { staffEverydayChapter } from './duties';
import { activateSection, announcementsSection, helpChapter, navigationSection, signInSection } from './shared';
import type { Manual } from './types';

export const staffManual: Manual = {
    slug: 'staff',
    title: 'Staff guide',
    audience: 'Non-teaching staff: bursars, secretaries, matrons, nurses, drivers, librarians, storekeepers and support staff',
    summary: 'How to activate your account and sign in, what your dashboard shows, the tools every member of staff has, and which guide to read for your duty.',
    chapters: [
        {
            id: 'start',
            title: 'Getting started',
            intro: 'Your administrator adds you as staff and gives you an invite code to activate your account.',
            sections: [activateSection, signInSection, navigationSection],
        },
        {
            id: 'duties',
            title: 'Your duty and your menu',
            intro: 'Staff accounts start with announcements, the calendar, leave and store requests. The administrator then gives you a duty under Settings → Roles & duties, and the pages for your job appear in your menu.',
            sections: [
                {
                    id: 'staff-dashboard',
                    title: 'Your dashboard',
                    summary: 'Your dashboard welcomes you with your job title and links to Announcements. Pages for your duty are in the menu on the left (on a phone, under More).',
                    figure: shot('staff-duty-dashboard', 'A staff dashboard with duty pages in the menu', 'A bursar’s dashboard: Fees, Billing and Expenses have been added to the menu.'),
                },
                {
                    id: 'which-guide',
                    title: 'Which guide to read',
                    summary: 'Each duty has its own illustrated guide, available from Help & guide in your menu and at skulbase.com/help.',
                    points: [
                        'Bursar or Accountant: the Bursar and finance guide.',
                        'Matron, Patron or Discipline Master: the Boarding and discipline guide.',
                        'School Nurse: the School nurse guide.',
                        'Transport Manager or Driver: the Transport guide.',
                        'Librarian, Storekeeper or HR / Secretary: the Library, stores and HR guide.',
                        'Principal, Deputy, DOS, HOD, Timetabler or Exams Officer: the Academic leadership guide.',
                    ],
                    tip: 'If a page you need is missing, your duty has not been assigned yet, or your school has not switched that module on. Ask your administrator.',
                },
                { ...announcementsSection(false), summary: 'Announcements are notices for the whole school. Read them on the Announcements page; administrators and teachers post them.', steps: undefined, figure: undefined },
            ],
        },
        staffEverydayChapter,
        helpChapter,
    ],
};
