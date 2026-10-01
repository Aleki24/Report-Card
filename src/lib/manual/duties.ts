import { phoneShot, shot } from './figures';
import { activateSection, helpChapter, navigationSection, signInSection } from './shared';
import {
    calendarSection, cbcSection, everydayToolsChapter, leaveSection, moduleNote, reportIncidentSection, uploadPaperSection,
} from './modules';
import type { Manual, ManualChapter, ManualSection } from './types';

/*
  Guides for the duties an administrator assigns under Settings → Roles &
  duties. A duty adds pages to someone's menu on top of their login role, so
  a chemistry teacher who is also DOS reads the teacher guide and this one.
*/

const startChapter = (who: string): ManualChapter => ({
    id: 'start',
    title: 'Getting started',
    intro: `${who} sign in with their own account like everyone else. The administrator then assigns the duty under Settings → Roles & duties, and its pages appear in the menu the next time you open Skulbase. ${moduleNote}`,
    sections: [activateSection, signInSection, navigationSection],
});

const dutyTable = (rows: readonly [string, string][]): ManualSection => ({
    id: 'duties-covered',
    title: 'Who this guide is for',
    summary: 'The duties this guide covers, and what each one can do.',
    points: rows.map(([duty, can]) => `${duty}: ${can}`),
});

// ── Academic leadership ────────────────────────────────────────

export const leadershipManual: Manual = {
    slug: 'leadership',
    title: 'Academic leadership guide',
    audience: 'Principals, deputy principals, directors of studies, heads of department, timetablers and exams officers',
    summary: 'Running the academic side of the school: the calendar, the timetable and lesson cover, the exam paper bank from moderation to release, professional records and syllabus coverage, CBC assessment, and approvals.',
    chapters: [
        {
            ...startChapter('Leaders'),
            sections: [
                dutyTable([
                    ['Principal / Head teacher', 'every module page and approval. Setting up classes, users and settings stays with Admin accounts.'],
                    ['Deputy Principal', 'calendar, papers, timetable, professional records, CBC and discipline; sees boarding and health; approves leave and expenses.'],
                    ['Director of Studies (DOS)', 'exams, the paper bank, the timetable, professional records and the academic calendar.'],
                    ['Head of Department (HOD)', 'moderates exam papers and reviews schemes of work and coverage.'],
                    ['Timetabler', 'builds and publishes the timetable and arranges lesson cover.'],
                    ['Exams Officer', 'runs the paper bank: printing, packing and release.'],
                ]),
                activateSection, signInSection, navigationSection,
            ],
        },
        {
            id: 'overview',
            title: 'The school at a glance',
            intro: 'The principal and deputy see live figures from every module the school runs at the top of the dashboard.',
            sections: [{
                id: 'operations-overview',
                title: 'Across the school',
                summary: '“Across the school” shows one tile per thing that needs a leader’s eye: learners in the sick bay, learners out on exeat, vouchers waiting for approval, buses on the road, papers awaiting moderation and leave requests. Tap a tile to open its page.',
                figure: shot('admin-operations', 'The dashboard with operations tiles across the top', 'The dashboard with “Across the school” tiles above the usual academic figures.'),
            }],
        },
        {
            id: 'calendar-chapter',
            title: 'The academic calendar',
            intro: 'Put every exam window, marks deadline and report release on the calendar, so teachers, learners and parents all work to the same dates.',
            sections: [{
                ...calendarSection,
                steps: [
                    { title: 'Open Manage events', body: 'On Calendar, open the “Manage events” tab and press Add.' },
                    { title: 'Describe the event', body: 'Give it a title, choose its type (exam, deadline, report release, meeting, holiday or other), the start date and, for several days, the end date.' },
                    { title: 'Choose who sees it', body: 'Everyone, staff only, learners or parents. Parents see events meant for everyone or for parents in their portal.' },
                    { title: 'Link an exam (optional)', body: 'Link the event to an exam so the dates stay together.' },
                ],
            }],
        },
        {
            id: 'timetable',
            title: 'Building the timetable',
            intro: 'Skulbase generates a clash-free timetable from teaching loads, lets you adjust it, publishes it to everyone, and helps arrange cover when a teacher is away.',
            sections: [
                {
                    id: 'day-structure',
                    title: 'Set up the school day',
                    summary: 'On the “Day & rooms” tab, list the school days and the periods and breaks with their times, and the most lessons in a row one teacher may have. Add special rooms (labs, computer room, hall) so lessons that need them are placed there.',
                    caution: 'If you change the periods after publishing, generate the timetable again so lessons line up with the new day.',
                },
                {
                    id: 'loads',
                    title: 'Teaching loads',
                    summary: 'On “Teaching loads”, each row is one subject in one class with its teacher, lessons a week, how many of those are doubles, and any room type it needs.',
                    tip: '“Start from subject assignments” creates a load for every subject each teacher is assigned to a class this year. Then adjust the lessons a week.',
                },
                {
                    id: 'generate',
                    title: 'Generate and publish',
                    summary: 'On “Generate & publish”, name a new draft and press “Generate timetable”. Skulbase places every lesson without clashes for teachers, classes or rooms.',
                    figure: shot('timetable-build', 'A generated timetable draft for a class', 'Generate & publish: the draft, how many lessons were placed, and the grid for one class.'),
                    steps: [
                        { title: 'Check what was placed', body: 'The draft shows how many lessons were placed. Anything not placed is listed: lighten those loads, free the teacher, or add rooms, then generate again.' },
                        { title: 'Adjust by hand', body: 'Tap a lesson, then the slot to move or swap it into. “Pin here” keeps a lesson in its slot when you generate again.' },
                        { title: 'Publish', body: 'Press Publish. Teachers and learners see it straight away under Timetable, and learners under My timetable.' },
                    ],
                },
                {
                    id: 'cover',
                    title: 'Arrange lesson cover',
                    summary: 'When a teacher is away, open “Lesson cover”, choose the date and the absent teacher. Their lessons that day are listed with the colleagues who are free in each period; pick one to cover each lesson.',
                    tip: 'Leave requests list the lessons and duties that need cover, so check approved leave first.',
                },
            ],
        },
        {
            id: 'papers',
            title: 'The exam paper bank',
            intro: 'Papers move through moderation, printing and release in one place, with every download stamped and logged.',
            sections: [
                {
                    id: 'moderate',
                    title: 'Moderate papers (HOD, DOS)',
                    summary: 'The Moderation tab lists papers teachers have submitted. Open one to read the paper and marking scheme.',
                    figure: shot('exam-papers', 'The exam paper bank Moderation tab', 'Exam papers → Moderation: papers waiting for you, with totals for each stage.'),
                    steps: [
                        { title: 'Open the paper', body: 'Tap it, then “Open paper” and “Marking scheme”. Files open stamped with your name and the time.' },
                        { title: 'Approve or return', body: 'Approve it, or return it with a comment saying what to change (a comment is required when returning). The teacher sees the comment in the paper’s History.' },
                    ],
                },
                {
                    id: 'print-release',
                    title: 'Print, pack and release (Exams Officer)',
                    summary: 'The “Print & release” tab lists approved papers with the number of copies each class needs. Approved papers are locked so nobody can change them.',
                    figure: shot('exam-papers-print', 'The Print & release tab with copies and printing status', 'Print & release: mark each paper Printed, then Packed, and release it after the exam.'),
                    points: [
                        'Mark a paper Printed when the copies are done and Packed when they are sealed for the exam room.',
                        'After the exam (at the release time set by the teacher) release it; it then appears under Past papers for revision.',
                    ],
                },
                { ...uploadPaperSection, title: 'How teachers submit papers' },
            ],
        },
        {
            id: 'records',
            title: 'Professional records and coverage',
            intro: 'Heads of department and the DOS review schemes of work and follow syllabus coverage class by class.',
            sections: [
                {
                    id: 'review-schemes',
                    title: 'Review schemes of work',
                    summary: 'Submitted schemes show “Submitted” on the Schemes of work tab. Open one, read it, and approve it or return it with a review comment.',
                    figure: shot('lesson-records', 'Schemes of work with their status', 'Schemes of work: Draft, Submitted, Approved or Returned.'),
                },
                {
                    id: 'coverage',
                    title: 'Syllabus coverage',
                    summary: 'The Syllabus coverage tab shows, for each scheme, how many planned lessons have been taught, as a percentage, and when the class was last taught.',
                    figure: shot('lesson-coverage', 'Syllabus coverage bars per scheme', 'Syllabus coverage: spot classes falling behind early.'),
                },
                cbcSection,
            ],
        },
        {
            id: 'approvals',
            title: 'Approvals',
            intro: 'The principal and deputy approve staff leave and spending.',
            sections: [
                { ...leaveSection, id: 'approve-leave', title: 'Approve staff leave', summary: 'Staff Leave lists every request with the dates and who will cover. Press Approve or Decline; the teacher sees the decision straight away.' },
                {
                    id: 'approve-expenses',
                    title: 'Approve expenses',
                    summary: 'Vouchers raised by staff wait under “Awaiting approval” on Expenses. Approve or reject each one; the bursar then pays approved vouchers and records the payment.',
                    figure: shot('expenses', 'The Expenses page with vouchers awaiting approval', 'Expenses: approve or reject each voucher.'),
                },
                reportIncidentSection,
            ],
        },
        helpChapter,
    ],
};

// ── Finance: bursar and accountant ─────────────────────────────

export const financeManual: Manual = {
    slug: 'finance',
    title: 'Bursar and finance guide',
    audience: 'Bursars and accountants',
    summary: 'Billing the term from fee structures and vote heads, recording payments and receipts, bursaries and waivers, fee reminders, and spending through payment vouchers.',
    chapters: [
        {
            ...startChapter('Bursars and accountants'),
            sections: [
                dutyTable([
                    ['Bursar', 'fees, billing, expenses and financial reports, including approving vouchers.'],
                    ['Accountant', 'records payments and expenses; approvals stay with the bursar or principal.'],
                ]),
                activateSection, signInSection, navigationSection,
            ],
        },
        {
            id: 'billing',
            title: 'Billing the term',
            intro: 'Billing sets what each learner owes, from vote heads and fee structures, and bills a whole term in one go.',
            sections: [
                {
                    id: 'vote-heads',
                    title: 'Vote heads',
                    summary: 'Vote heads are the accounts fees are split into (tuition, exams, boarding, transport and so on). Add each with a name, a short code and an allocation order: payments are allocated to vote heads in that order.',
                },
                {
                    id: 'structures',
                    title: 'Fee structures',
                    summary: 'A fee structure is the year’s fees for a class level, for day scholars, boarders or both: an amount for the year per vote head, and the share billed each term (for example 50%, 30% and 20%).',
                    figure: shot('billing', 'The Billing page', 'Billing: Invoicing, Fee structures, Bursaries & waivers, Day & boarding, and the vote-head statement.'),
                },
                {
                    id: 'day-boarding',
                    title: 'Day scholars and boarders',
                    summary: 'On “Day & boarding”, mark each learner as a day scholar or a boarder (a whole class at once, or one by one), so they are billed from the right structure.',
                },
                {
                    id: 'awards',
                    title: 'Bursaries and waivers',
                    summary: 'Record a bursary, scholarship, waiver or discount for a learner and term: the amount, the sponsor (for example CDF) and a reference. Awards reduce what the learner owes when the term is billed.',
                    caution: 'If you add an award after billing, bill the term again so it is taken off.',
                },
                {
                    id: 'invoicing',
                    title: 'Bill the term',
                    summary: 'On Invoicing, choose the term (and a class, if you like) and press Preview.',
                    figure: shot('billing-invoicing', 'The Invoicing tab with term and class choices', 'Invoicing: preview first, then bill the term.'),
                    steps: [
                        { title: 'Preview', body: 'Every learner is listed with the amount from their structure, less any awards. Learners with no structure are skipped and listed so you can fix them.' },
                        { title: 'Bill', body: 'Press “Bill term” and confirm. Each learner’s fee record for the term is created or updated on the Fees page.' },
                    ],
                },
                {
                    id: 'statement',
                    title: 'Vote-head statement and reminders',
                    summary: 'The vote-head statement shows, for a term, what was billed and collected under each vote head. “Balance reminders” texts the guardians of learners who owe at least an amount you choose.',
                },
            ],
        },
        {
            id: 'fees',
            title: 'Fees and payments',
            intro: 'The Fees page is where each learner’s balance lives and where payments are recorded.',
            sections: [
                {
                    id: 'fee-records',
                    title: 'Fee records',
                    summary: 'Choose the term to see what is expected, collected, outstanding and overdue, with a collection progress bar and one row per learner.',
                    figure: shot('bursar-fees', 'The Fees page for a bursar', 'Fees → Fee records.'),
                    points: [
                        'Pay records a payment; the clock icon shows a learner’s payment history with receipts.',
                        '“Batch entry” bills or records payments for a whole class at once.',
                        '“Export” downloads the term as a spreadsheet.',
                    ],
                },
                {
                    id: 'record-payment',
                    title: 'Record a payment',
                    summary: 'For cash, cheques, bank deposits and M-Pesa messages you receive yourself. Online payments made from the learner’s or parent’s Fees page are recorded automatically.',
                    figure: shot('fees-payment', 'The Record payment dialog', 'Record payment.'),
                    steps: [
                        { title: 'Press Pay', body: 'On the learner’s row.' },
                        { title: 'Enter it', body: 'The amount (filled with the balance; change it for a part payment), the date paid, the method and, optionally, who paid and a note.' },
                        { title: 'Save and give a receipt', body: 'The balance updates at once and the receipt is in the payment history.' },
                    ],
                },
                {
                    id: 'payments-log',
                    title: 'The payments log and unmatched payments',
                    summary: 'The Payments tab lists every payment, filtered by date, method and status. M-Pesa or bank payments that could not be matched to a learner (for example a wrong account number) appear with a button to assign them.',
                },
            ],
        },
        {
            id: 'expenses',
            title: 'Expenses',
            intro: 'Every shilling spent goes through a payment voucher, so spending can be tracked by vote head and supplier.',
            sections: [
                {
                    id: 'vouchers',
                    title: 'Payment vouchers',
                    summary: 'The Expenses tab shows totals awaiting approval, approved but unpaid, paid and rejected, and every voucher.',
                    figure: shot('expenses', 'The Expenses page with vouchers', 'Expenses: approve, reject and mark vouchers paid.'),
                    steps: [
                        { title: 'Raise a voucher', body: 'Press “Record expense”: what it is for, the amount, date, supplier, vote head, payment method and invoice reference. Staff raise their own under “My requests”.' },
                        { title: 'Approve or reject (bursar, principal)', body: 'Use Approve or Reject on each pending voucher.' },
                        { title: 'Pay it', body: 'When you pay an approved voucher, press Paid and enter who was paid and the reference (cheque number or M-Pesa code).' },
                    ],
                },
                {
                    id: 'suppliers',
                    title: 'Suppliers',
                    summary: 'The Suppliers tab keeps each supplier’s name, phone, email, KRA PIN and category, so vouchers pick them from a list.',
                },
            ],
        },
        helpChapter,
    ],
};

// ── Welfare: boarding and discipline ───────────────────────────

export const welfareManual: Manual = {
    slug: 'welfare',
    title: 'Boarding and discipline guide',
    audience: 'Matrons, patrons and house masters, and discipline masters',
    summary: 'Dorms and beds, roll calls, exeats with gate passes, dorm inspections, and discipline incidents from report to action.',
    chapters: [
        {
            ...startChapter('Matrons, patrons and discipline masters'),
            sections: [
                dutyTable([
                    ['Matron', 'runs boarding: dorms, roll calls, exeats and inspections, and can see health records.'],
                    ['Patron / House master', 'takes roll calls for their own dorm and records discipline incidents.'],
                    ['Discipline Master', 'manages every incident and the action taken, and informs parents.'],
                ]),
                activateSection, signInSection, navigationSection,
            ],
        },
        {
            id: 'boarding',
            title: 'Boarding',
            intro: 'Everything about boarders: where they sleep, whether they are in, and when they are allowed out.',
            sections: [
                {
                    id: 'roll-call',
                    title: 'Take a roll call',
                    summary: 'Roll call is a register for a dorm, taken morning, evening or at night.',
                    figure: shot('boarding', 'The Roll call tab', 'Boarding → Roll call: choose the dorm, session and date, then open the roll.'),
                    steps: [
                        { title: 'Open the roll', body: 'Choose the dorm, the session (morning, evening or night) and the date, and press “Open roll”.' },
                        { title: 'Mark each boarder', body: 'Present, absent, late, out on exeat or in the sick bay. “Rest present” marks everyone not yet marked as present.' },
                        { title: 'Save', body: 'If the roll was already taken, saving updates it.' },
                    ],
                    points: ['Patrons can only take roll calls for their own dorm.'],
                },
                {
                    id: 'exeats',
                    title: 'Exeats and the gate check',
                    summary: 'An exeat is permission for a boarder to leave school. Once approved it has a pass code that the gate checks.',
                    figure: shot('boarding-exeats', 'Exeats with their status and pass codes, and the gate check box', 'Boarding → Exeats.'),
                    steps: [
                        { title: 'Request', body: 'Press “Request exeat”: the learner, the type (weekend, medical, family, official or other), when they leave, when they must be back, and the reason.' },
                        { title: 'Approve', body: 'Approve or reject it. An approved exeat gets a short pass code, which the parent or learner shows at the gate.' },
                        { title: 'At the gate', body: 'Type the pass code into “Gate check” and press Check to confirm the exeat is genuine and current before the learner leaves. The exeat then shows Out.' },
                        { title: 'Back', body: 'When the learner returns, press Back.' },
                    ],
                },
                {
                    id: 'dorms',
                    title: 'Dorms and beds',
                    summary: 'The “Dorms & beds” tab lists each dorm with its house, whether it is for boys or girls, the number of beds and its patron. Allocate each boarder a bed; “Move out” frees it.',
                    figure: shot('boarding-dorms', 'Dorms with house, beds and patron', 'Boarding → Dorms & beds.'),
                },
                {
                    id: 'inspections',
                    title: 'Dorm inspections',
                    summary: 'Record each inspection with the dorm, the date, a score out of 100 and remarks, to track standards over the term.',
                },
            ],
        },
        {
            id: 'discipline',
            title: 'Discipline',
            intro: 'Teachers report incidents; the discipline master decides the action and informs the parent.',
            sections: [
                reportIncidentSection,
                {
                    id: 'manage-incidents',
                    title: 'Record the action (Discipline Master)',
                    summary: 'Open an incident to record the action taken: none, warning, counselling, punishment, parent called in, suspension or expulsion. Mark it resolved when it is dealt with.',
                    points: ['“Tell parent” texts the learner’s guardian about the incident.', 'Discipline records are sensitive: teachers see the incidents they reported; administrators, the discipline master, deputy and principal see them all.'],
                },
            ],
        },
        helpChapter,
    ],
};

// ── Health ─────────────────────────────────────────────────────

export const healthManual: Manual = {
    slug: 'health',
    title: 'School nurse guide',
    audience: 'School nurses and sick bay staff',
    summary: 'Clinic visits and the sick bay, learners’ medical profiles, medicine given, medicine stock, and early warning of outbreaks.',
    chapters: [
        startChapter('Nurses'),
        {
            id: 'health',
            title: 'Health & sick bay',
            intro: 'Clinical details are only visible to the nurse and the principal. Matrons and class teachers see only what they need, such as who is in the sick bay.',
            sections: [
                {
                    id: 'today',
                    title: 'Today',
                    summary: 'The Today tab shows who is in the sick bay now, who was sent home or referred today, and the most common complaints in the last 48 hours.',
                    figure: shot('health', 'The Health Today tab with a possible outbreak alert', 'Health → Today. A red banner warns when one complaint is suddenly common.'),
                    caution: 'When several learners come in with the same complaint in 48 hours, a “Possible outbreak” banner appears. Inform the principal.',
                },
                {
                    id: 'visits',
                    title: 'Record a clinic visit',
                    summary: 'Every visit to the clinic is recorded on Clinic visits.',
                    steps: [
                        { title: 'Add the visit', body: 'Choose the learner and the time, and record the temperature, complaint, your assessment and the treatment given.' },
                        { title: 'Record the outcome', body: 'Returned to class, admitted to the sick bay, sent home, or referred (and where to).' },
                        { title: 'Tell the parent', body: '“Tell parent” texts the guardian. “Discharge” returns a learner from the sick bay to class.' },
                    ],
                },
                {
                    id: 'profiles',
                    title: 'Medical profiles',
                    summary: 'Each learner’s blood group, SHA number, allergies, chronic conditions, regular medication, family doctor and emergency contact, and whether a treatment consent form is on file.',
                    figure: shot('health-profiles', 'Medical profiles with allergies, conditions, blood group and consent', 'Health → Medical profiles.'),
                },
                {
                    id: 'medication',
                    title: 'Medication given and medicine stock',
                    summary: 'Record each dose given (from stock, so the count goes down), and keep the medicine stock with batch numbers, expiry dates and reorder levels.',
                    figure: shot('health-stock', 'Medicine stock with reorder and expiry warnings', 'Health → Medicine stock: items to reorder and those expiring within 60 days are highlighted.'),
                },
            ],
        },
        helpChapter,
    ],
};

// ── Transport ──────────────────────────────────────────────────

export const transportManual: Manual = {
    slug: 'transport',
    title: 'Transport guide',
    audience: 'Transport managers and drivers',
    summary: 'The fleet and its NTSA compliance, drivers and attendants, routes, stops and riders, daily trips with boarding check-in, fuel and service logs, and every bus live on the map.',
    chapters: [
        {
            ...startChapter('Transport managers and drivers'),
            sections: [
                dutyTable([
                    ['Transport Manager', 'fleet, drivers, routes, trips and compliance.'],
                    ['Driver', 'runs the trips they are assigned and shares the bus location from their phone.'],
                ]),
                activateSection, signInSection, navigationSection,
            ],
        },
        {
            id: 'manage',
            title: 'Managing transport',
            intro: 'Set up the fleet and routes once; then schedule trips and follow them live.',
            sections: [
                {
                    id: 'live-map',
                    title: 'The live map',
                    summary: 'Every bus on a trip appears on the map, with its route, driver, speed and when it was last seen. It refreshes every 10 seconds, and speeding is flagged.',
                    figure: shot('transport-live', 'The live transport map with a bus and its details', 'Transport → Live map (map tiles need an internet connection).'),
                },
                {
                    id: 'vehicles',
                    title: 'Vehicles and compliance',
                    summary: 'List each vehicle with its registration, make, seats and status (active, in maintenance, retired), and its NTSA documents with expiry dates: insurance, inspection and speed governor. Documents due soon are flagged in amber and missing ones in red.',
                    figure: shot('transport-fleet', 'Vehicles with seats, status and NTSA document warnings', 'Transport → Vehicles.'),
                },
                {
                    id: 'crew',
                    title: 'Drivers and attendants',
                    summary: 'Add each driver and attendant with their phone, licence number, class and expiry dates. Link a driver to their Skulbase login so they can use driver mode.',
                },
                {
                    id: 'routes',
                    title: 'Routes, stops and riders',
                    summary: 'A route has its vehicle, driver, direction and fee per term. Add its stops in order with pick-up and drop-off times (and map position), then assign learners to their stop.',
                    figure: shot('transport-routes', 'Routes with stops, learners, vehicle and fee', 'Transport → Routes.'),
                },
                {
                    id: 'trips',
                    title: 'Trips and logs',
                    summary: 'Schedule each morning and evening trip with its route, vehicle and driver. Record fuel, service, repairs and inspections under “Fuel & service” to track running costs.',
                },
            ],
        },
        {
            id: 'driver',
            title: 'Driver mode',
            intro: 'Drivers run their trip from a phone. Keep the page open during the trip so the bus shows on the map.',
            sections: [{
                id: 'driver-mode',
                title: 'Run a trip',
                summary: 'Open Transport → Driver mode on your phone. Your trips for today are listed.',
                figure: phoneShot('driver-mode', 'Driver mode on a phone', 'Driver mode.'),
                steps: [
                    { title: 'Start the trip', body: 'Press “Start trip” (optionally enter the odometer). Allow the phone to share its location when asked.' },
                    { title: 'Check learners on and off', body: 'Each learner on the route is listed with their stop. Mark them as they board or get off, or Absent. Parents are told when their child boards.' },
                    { title: 'End the trip', body: 'Press “End trip” at the last stop (optionally enter the odometer).' },
                ],
                tip: 'If no trip is listed, ask the transport manager to schedule one and link your account under “Drivers & attendants”.',
            }],
        },
        helpChapter,
    ],
};

// ── Operations: library, stores, HR ────────────────────────────

export const operationsManual: Manual = {
    slug: 'operations',
    title: 'Library, stores and HR guide',
    audience: 'Librarians, storekeepers and HR officers or secretaries',
    summary: 'The library catalogue and loans, the store and asset register with requisitions, and staff leave approvals.',
    chapters: [
        {
            ...startChapter('Librarians, storekeepers and HR officers'),
            sections: [
                dutyTable([
                    ['Librarian', 'the catalogue, issuing and returning books, overdue books and fines.'],
                    ['Storekeeper', 'store stock, the asset register and requisitions.'],
                    ['HR / Secretary', 'approves staff leave.'],
                ]),
                activateSection, signInSection, navigationSection,
            ],
        },
        {
            id: 'library',
            title: 'Library',
            intro: 'The catalogue, what is out and who has it.',
            sections: [
                {
                    id: 'catalogue',
                    title: 'The catalogue',
                    summary: 'Add each title with its author, ISBN, category (set book, textbook, literature…), shelf and number of copies. “Available” shows how many are on the shelf.',
                    figure: shot('library', 'The library catalogue', 'Library → Catalogue.'),
                },
                {
                    id: 'loans',
                    title: 'Issue and return books',
                    summary: 'On Loans, press “Issue book”: the book, the borrower (learner or staff), the date issued and the due date. Press Returned when it comes back.',
                    figure: shot('library-loans', 'Library loans with overdue items', 'Library → Loans: out now and overdue, with any fine.'),
                },
            ],
        },
        {
            id: 'stores',
            title: 'Inventory & stores',
            intro: 'Stock and assets, and the requests staff make for them.',
            sections: [
                {
                    id: 'stock',
                    title: 'Stock and assets',
                    summary: 'Consumables (exercise books, chalk) have a quantity and a reorder level; assets (projectors, laptops) have a serial or tag number and a value. Items to reorder and the value on record are shown at the top.',
                    figure: shot('inventory', 'Stock and assets with reorder warnings', 'Inventory → Stock & assets.'),
                },
                {
                    id: 'approve-requisitions',
                    title: 'Approve and issue requisitions',
                    summary: 'Staff requests appear under Requisitions. Approve or reject each one; when you hand the items over press Issue, and the stock count goes down.',
                    figure: shot('inventory-requisitions', 'Requisitions with Approve and Reject buttons', 'Inventory → Requisitions.'),
                },
            ],
        },
        {
            id: 'hr',
            title: 'Staff leave',
            intro: 'Leave requests from every member of staff.',
            sections: [{ ...leaveSection, id: 'approve-leave', title: 'Approve leave', summary: 'Each request shows the staff member, type, dates, reason and who will cover. Press Approve or Decline.' }],
        },
        helpChapter,
    ],
};

/** Every duty guide's shared “everyday tools” chapter is in the staff guide. */
export const staffEverydayChapter = everydayToolsChapter('Tools every member of staff has.');
