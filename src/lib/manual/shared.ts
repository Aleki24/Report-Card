import { phoneShot, shot } from './figures';
import type { ManualChapter, ManualSection } from './types';

/*
  Chapters and sections more than one guide needs. Each guide composes these
  with its own, so a change to how marks are entered is written once.
*/

// ── Getting started ─────────────────────────────────────────────

export const activateSection: ManualSection = {
    id: 'activate',
    title: 'Activate your account with an invite code',
    summary: 'Teachers, staff and learners do not sign up on their own. Your school adds you, and you get a personal invite code (or a link that has the code in it) to set up your login.',
    figure: shot('activate', 'The account activation page with a box for the invite code', 'Activating an account: type the invite code from your school, or open the link they sent you.'),
    steps: [
        { title: 'Get your code', body: 'Your school administrator gives you a six-character invite code, for example A7X3K9, by SMS, WhatsApp, on paper, or as a link. The code only works for your account.' },
        { title: 'Open the activation page', body: 'Tap the link you were sent, or go to skulbase.com, choose Sign in and then “Activate your account”. If you opened a link, the code is already filled in.' },
        { title: 'Check it is you', body: 'Press Continue. Skulbase shows the name the school registered. If it is not you, choose “Not you?” and ask the school for the right code.' },
        { title: 'Choose how you will sign in', body: 'Pick a username (one is suggested for you) and a password of at least 8 characters, or continue with Google. Adding an email address lets you reset your password yourself later.' },
        { title: 'You are in', body: 'You are signed in straight away and land on the home page for your role.' },
    ],
    caution: 'Each code can be used once. If yours says it has expired or was already used, ask your administrator to reset your account; they get a fresh code in seconds.',
};

export const signInSection: ManualSection = {
    id: 'sign-in',
    title: 'Sign in',
    summary: 'Once your account is active, sign in with your email address or username and your password, or with Google if you activated with Google.',
    figure: shot('signin', 'The Skulbase sign-in page', 'The sign-in page. “Forgot password?” sends you a code by email.'),
    steps: [
        { title: 'Go to the sign-in page', body: 'Open skulbase.com and choose Sign in.' },
        { title: 'Enter your details', body: 'Type your email address or username, then your password, and press Sign In. Or press “Sign in with Google”.' },
        { title: 'Forgot your password?', body: 'Choose “Forgot password?”, enter your email address, and type the six-digit code we email you along with a new password. This also works if you have only ever used Google, and afterwards both ways work.' },
    ],
    tip: 'Save skulbase.com to your phone’s home screen. It opens like an app and remembers you are signed in.',
};

// ── Finding your way ────────────────────────────────────────────

export const navigationSection: ManualSection = {
    id: 'navigation',
    title: 'Finding your way around',
    summary: 'The menu only shows the pages your role can use. On a computer it runs down the left-hand side; on a phone the main pages sit in a bar along the bottom.',
    points: [
        'On a computer, the arrow at the top of the menu makes it narrower (icons only) or wider (icons and names). Skulbase remembers your choice.',
        'Press the / key, or tap “Search menu”, to jump to any page by typing part of its name.',
        'Your name at the bottom of the menu opens your account menu: switch between light and dark appearance, or sign out.',
        'If you hold more than one role (for example an administrator who is also a class teacher), use “View as” in the account menu to switch views.',
        'On a phone, the bottom bar shows your four most-used pages. Everything else is under More.',
    ],
};

export const phoneSection = (name: string, caption: string): ManualSection => ({
    id: 'on-your-phone',
    title: 'Using Skulbase on a phone',
    summary: 'Every page works on a phone. Tables turn into cards, and the menu moves to the bottom of the screen.',
    figure: phoneShot(name, 'Skulbase on a phone, with the menu bar at the bottom', caption),
    points: [
        'Use a current version of Chrome, Safari or Samsung Internet.',
        'Mark entry keeps your work on the phone if the network drops, and saves it when you are back online.',
        'Downloads such as report cards open in your phone’s PDF viewer, ready to share on WhatsApp or print.',
    ],
});

// ── Marks ───────────────────────────────────────────────────────

export const enterMarksSection: ManualSection = {
    id: 'enter-marks',
    title: 'Enter or correct marks',
    summary: 'Marks go in on Exams & Marks, on the “Enter & Correct Marks” tab. You pick the term, the exam, the class and the subject, and a mark sheet opens with every learner in the class.',
    figure: shot('marks-choose', 'The Exams & Marks page with Term, Exam and Class steps', 'Choose the term (the current one is marked NOW), then the exam, then the class and subject.'),
    steps: [
        { title: 'Open Exams & Marks', body: 'Choose Exams & Marks in the menu. The “Enter & Correct Marks” tab is open.' },
        { title: 'Choose the term', body: 'The current term is selected for you and marked NOW. Pick another term to correct older marks.' },
        { title: 'Choose the exam', body: 'Tap the exam, for example Midterm or Endterm. Only exams your school has set up for that term are shown.' },
        { title: 'Choose the class and subject', body: 'Pick the class, then the subject. Teachers only see the classes and subjects they teach.' },
        { title: 'Open the mark sheet', body: 'Press “Open mark sheet”. Saved marks are already filled in.' },
    ],
};

export const markSheetSection: ManualSection = {
    id: 'mark-sheet',
    title: 'Using the mark sheet',
    summary: 'The mark sheet lists every learner with a box for their score. The grade fills itself in from your school’s grading system.',
    figure: shot('marks-sheet', 'A mark sheet with scores, grades and a Save changes button', 'The mark sheet: type a score, press Enter to move to the next learner, then Save changes.'),
    steps: [
        { title: 'Type the scores', body: 'Click the first score box, type the mark and press Enter to jump to the next learner. The grade appears as you type. Remarks are optional.' },
        { title: 'Save', body: 'Press “Save changes” at the bottom. The bar tells you how many learners still have no mark.' },
        { title: 'Correct a mistake', body: 'Find the learner with the search box, type the right score over the old one, and save. Undo puts a mark back as it was; the bin removes a mark for a learner who did not sit the exam.' },
        { title: 'Filter the list', body: 'Use the tabs (All, Not entered, Entered, Unsaved) and the stream filter to find who is left.' },
    ],
    points: [
        '“Online” at the top right shows the sheet is connected. If the network drops, your typing is kept on this device and saved when you are back online.',
        'Scores are out of the exam’s maximum (shown at the top, for example “Out of 100”).',
        'A subject with several papers can be split with “Split into papers”; each paper then gets its own column and the final mark is worked out for you.',
    ],
};

export const uploadMarksSection: ManualSection = {
    id: 'upload-marks',
    title: 'Upload marks from a spreadsheet or a photo',
    summary: 'Instead of typing, you can upload an Excel or CSV file, or take a photo of a handwritten mark sheet.',
    figure: shot('marks-upload', 'The Upload file option on the mark sheet', '“Upload file” reads marks from Excel or CSV; “Scan sheet” reads a photo of a paper mark sheet.'),
    steps: [
        { title: 'Upload a file', body: 'On the mark sheet choose “Upload file”, pick your Excel or CSV file, and check the columns Skulbase detected (learner, admission number, score). Press “Validate & Preview”, check the rows, then save.' },
        { title: 'Scan a paper sheet', body: 'Choose “Scan sheet” and take or upload a clear photo. Skulbase reads the names and scores; check every row, fix anything misread, and confirm. Nothing is saved until you confirm.' },
    ],
    tip: 'Admission numbers are the most reliable way to match rows to learners. Keep them in your spreadsheet.',
};

export const releaseSection: ManualSection = {
    id: 'release-results',
    title: 'Release results to learners',
    summary: 'Marks stay private to staff until they are released. Releasing a subject lets learners see its marks in their portal and on the report card’s QR check.',
    figure: shot('marks-release', 'The Release Results tab listing subjects and their release status', 'Release Results: each subject shows how many learners are marked and whether learners can see it.'),
    steps: [
        { title: 'Open the Release Results tab', body: 'On Exams & Marks choose “Release Results”.' },
        { title: 'Choose the class, term and exam', body: 'The list shows every subject for that exam and how many learners have marks.' },
        { title: 'Check the ranking preview', body: 'Scroll down to see the class ranking the release would produce, and any learners with missing papers (a missing paper counts as 0).' },
        { title: 'Release', body: 'Release a single subject, or all of them at once. Released subjects show “Learners can see”.' },
    ],
    points: [
        'You can still correct marks after releasing; learners see the corrected mark.',
        '“Withdraw” hides a subject from learners again at any time.',
    ],
};

export const resultsTabSection: ManualSection = {
    id: 'results-tab',
    title: 'See a class’s results',
    summary: 'The “Results & Reports” tab on Exams & Marks shows how a class did: every subject side by side, one exam at a time, the analysis, and individual report cards.',
    figure: shot('marks-results', 'The Results & Reports tab for a class', 'Results & Reports: choose a class, then an exam, to see its results.'),
    points: [
        'Choose a class, then an exam, to see the broadsheet and rankings.',
        'Click a learner to download their PDF report card, or generate the whole class at once.',
    ],
};

export const marksChapter = (intro: string): ManualChapter => ({
    id: 'marks',
    title: 'Exams and marks',
    intro,
    sections: [enterMarksSection, markSheetSection, uploadMarksSection, releaseSection, resultsTabSection],
});

// ── Attendance ──────────────────────────────────────────────────

export const attendanceSection: ManualSection = {
    id: 'attendance',
    title: 'Take the daily register',
    summary: 'Attendance holds one register per class per day. Mark each learner Present, Absent, Late or Excused, add a reason if you like, and let guardians of absent learners know by SMS.',
    figure: shot('attendance', 'The attendance register for a class with Present, Absent, Late and Excused buttons', 'The register: totals at the top, one row per learner, and a Save bar at the bottom.'),
    steps: [
        { title: 'Open Attendance', body: 'Choose Attendance in the menu. A class teacher’s own class opens straight away; otherwise pick the class.' },
        { title: 'Check the day', body: 'Today is selected. Use the arrows or the date box to fill in an earlier day.' },
        { title: 'Mark each learner', body: 'Tap Present, Absent, Late or Excused on each row. To save time, press “Mark N unmarked present” and then change only the exceptions.' },
        { title: 'Add a reason (optional)', body: 'The note icon at the end of a row adds a reason, such as “Unwell”. It shows under the learner’s name.' },
        { title: 'Save', body: 'Press Save at the bottom. Unsaved changes are kept if you switch class or day by mistake: you are asked first.' },
        { title: 'Tell guardians', body: 'Press “Notify guardians” to text the guardian of every learner marked absent. You see who will be texted before anything is sent.' },
    ],
    tip: 'PDF downloads the day’s register for printing or filing.',
};

// ── Communication ───────────────────────────────────────────────

export const announcementsSection = (canText: boolean): ManualSection => ({
    id: 'announcements',
    title: 'Post announcements',
    summary: 'Announcements are notices for the whole school. They show on the Announcements page and on learners’ dashboards.',
    figure: shot('announcements-new', 'The new announcement form with title, message and options', 'A new announcement: a title, the message, and whether it is important.'),
    steps: [
        { title: 'Start one', body: 'On Announcements press “New announcement”.' },
        { title: 'Write it', body: 'Give it a short title (for example “Half-term break dates”) and the message.' },
        { title: 'Mark it important (optional)', body: 'Important announcements are highlighted in red on the list and on dashboards.' },
        ...(canText ? [{ title: 'Text guardians too (optional)', body: 'Tick “Also text every guardian” to send it as one SMS to each guardian phone on file for active learners. SMS costs apply, and you are shown how many messages will go out.' }] : []),
        { title: 'Post', body: 'Press Post. You can edit or delete your own announcements later from the list.' },
    ],
    points: [
        'Search, or filter to Important or to the ones you posted.',
        ...(canText ? [] : ['Only administrators can text an announcement to guardians. Ask your administrator if something needs to go out by SMS.']),
    ],
});

export const assignmentsSection: ManualSection = {
    id: 'assignments',
    title: 'Set homework and mark it',
    summary: 'Assignments is where homework is set for a class. Learners see it on their dashboard, hand it in there (typed or as a file), and you grade it here.',
    figure: shot('assignments-submissions', 'An assignment with its hand-ins open in a side panel', 'Open an assignment’s hand-ins to read each learner’s work and grade it.'),
    steps: [
        { title: 'Set an assignment', body: 'Press “New assignment”. Choose the class and subject, give it a title and a due date, add instructions, and attach a file (up to 10 MB) if you like.' },
        { title: 'Follow progress', body: 'The tiles at the top filter to Upcoming, Past due, Set by me and All. Each card shows how many learners have handed in.' },
        { title: 'Mark the work', body: 'Open the hand-ins, read each learner’s answer or open their file, and give a grade from 0 to 100 with optional feedback. Learners see the grade and feedback on their dashboard.' },
    ],
    points: [
        'Work is due at the end of the due date, not at midnight before it.',
        'Teachers can edit and grade only the assignments they set; administrators can manage all of them.',
        'Once you have graded a hand-in, the learner can no longer replace it.',
    ],
};

// ── Help ────────────────────────────────────────────────────────

export const helpChapter: ManualChapter = {
    id: 'help',
    title: 'Getting help',
    intro: 'Most questions are answered on the page itself: many pages have a “How to” panel at the bottom. For anything else, these are the places to go.',
    sections: [{
        id: 'where-to-get-help',
        title: 'Where to get help',
        summary: 'This guide is always available from Help in the menu, and as a PDF you can download and print.',
        points: [
            'Your school administrator can add or reset accounts, fix classes and subjects, and change school settings.',
            'For problems with Skulbase itself, use the contact page at skulbase.com/contact, or call 0740 129 444.',
            'When you report a problem, say which page you were on, what you pressed and what you expected. A screenshot helps.',
        ],
    }],
};
