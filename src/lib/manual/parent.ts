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
                        'With more than one child at the school, the top shows one family fee balance, and each child’s tab shows what that child owes.',
                        'School bus: whether the bus is on the road, when it was last seen, and whether your child has boarded. You also see their route and stop with pick-up and drop-off times.',
                        'Latest results: the newest marks the school has released, with grades.',
                        'Report cards: the average, position and teachers’ comments from each report card.',
                        'Attendance: every school day in the last 30 days.',
                        'Coming up and Notices: exams, meetings and holidays from the school calendar, and announcements.',
                    ],
                },
                {
                    id: 'fees',
                    title: 'Fees: balance, receipts and paying',
                    summary: 'Each child’s Fees section shows the balance to pay across every term (arrears included), each term’s bill and what has been paid, the latest receipts, and how to pay.',
                    steps: [
                        { title: 'Pay online', body: 'If the school takes M-Pesa or Pesapal, press “Pay” (it starts with the oldest term owing) or Pay beside any term. With M-Pesa, enter the phone number and amount (part payments are fine) and your PIN when the prompt appears on that phone. With Pesapal, finish on the Pesapal page that opens. The balance updates once the payment is received.' },
                        { title: 'Pay another way', body: 'The bottom of the section shows the school’s Paybill and the account number to use (your child’s admission number), and its bank accounts. Keep your M-Pesa message or bank slip; the school records the payment when it arrives.' },
                        { title: 'Download a receipt', body: 'Each payment in Receipts has its receipt as a PDF. Older receipts are on the statement.' },
                        { title: 'Download the statement', body: '“Statement” gives every charge, bursary and payment with a running balance, ready to print or share.' },
                    ],
                    tip: 'Every receipt has a QR code. Scan it with your phone camera to check with the school’s records that the receipt is genuine.',
                },
                {
                    id: 'phone',
                    title: 'On your phone',
                    summary: 'The parent portal is built for phones. Save skulbase.com to your home screen to open it like an app, or use the Skulbase app with the same login: it shows the same children, fees and payments.',
                    figure: parentPortalFigure,
                },
                {
                    id: 'missing-child',
                    title: 'A child is missing',
                    summary: 'If a child does not appear, the school has not linked them to your phone number yet. Ask the school office to link your account to them under Parent accounts. Use the same phone number for every child, so they all appear under one login.',
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
                    'A text when your child is marked absent, if the class teacher sends absence notices. Every parent linked to the child gets it, as well as the number on the child’s record.',
                    'Fee balance reminders, with the balance across all terms and, if the school takes M-Pesa, the Paybill and account number to use.',
                    'Important announcements, such as closing and opening dates.',
                    'Fee receipts carry a QR code too: scan it to check the receipt is genuine.',
                    'Printed report cards carry a QR code. Scan it with your phone camera to see the results the school approved, and check the card is genuine.',
                ],
            }],
        },
        helpChapter,
    ],
};
