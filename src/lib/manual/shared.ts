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
    summary: 'Every page works on a phone, in the browser or in the Skulbase app. Tables turn into cards, the main pages sit in a bar along the bottom, and everything else is under More.',
    figure: phoneShot(name, 'Skulbase on a phone, with the menu bar at the bottom', caption),
    points: [
        'In the browser, use a current version of Chrome, Safari or Samsung Internet, and save skulbase.com to your home screen.',
        'The Skulbase app signs in with the same account and shows the same pages. More lists every other page in one grid, with a search box to find one by name.',
        'The app updates itself in the background. When an update is ready it offers “Restart now”; otherwise it opens the next time you start the app. Profile → “Check for updates” fetches the latest at any time.',
        'Mark entry keeps your work on the phone if the network drops, and saves it when you are back online.',
        'Downloads such as report cards, receipts and statements open in your phone’s PDF viewer, ready to share on WhatsApp or print.',
    ],
});

// ── Marks ───────────────────────────────────────────────────────

export const enterMarksSection: ManualSection = {
    id: 'enter-marks',
    title: 'Enter or correct marks',
    summary: 'Marks go in on Exams & Marks, on the “Enter & Correct Marks” tab. The school chooses which exam each class is marking, so you only pick the class and subject: the mark sheet opens on the right exam and your marks cannot land in the wrong one.',
    steps: [
        { title: 'Open Exams & Marks', body: 'Choose Exams & Marks in the menu. The “Enter & Correct Marks” tab is open.' },
        { title: 'Pick up where you left off', body: 'If you were part-way through a sheet, “Pick up where you left off” at the top opens it again.' },
        { title: 'Choose the class and subject', body: '“Marking now” lists each of your classes with the exam it is on (for example End-Term) and your subjects there. Pick the class, then the subject. You only see the classes and subjects you teach.' },
        { title: 'Open the mark sheet', body: 'The sheet opens on the exam your school is marking, with a badge naming it. Saved marks are already filled in.' },
    ],
    points: [
        'No exam open for a class yet? It shows “No exam open yet”. Press “Ask for the exam”: your administrator, principal or DOS sees the request and opens the right one.',
        'To mark a CAT, correct an earlier exam or work in another term, press “Mark a CAT, correct an earlier exam or open another term” and choose the term, exam, class and subject yourself. A sheet also lists “Other exams for this class” to jump between them.',
        'If you open an empty sheet for an exam the school is not marking, Skulbase asks you to check which exam the marks are from before you start.',
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
        'Once every learner on the sheet has a saved mark, the sheet offers to release the results there and then, so learners and parents can see them. You can still correct a mark afterwards.',
        '“Change history” at the bottom lists every mark entered, changed or removed on the sheet: the old and new score, who saved it and when. The search box narrows it to one learner.',
        'When the school locks a finished term, its sheets say so and cannot be saved. Ask whoever runs exams to unlock it for a correction.',
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
        { title: 'Open the Release Results tab', body: 'On Exams & Marks choose “Release Results”. “Ready to release” at the top lists every paper this term that has its marks in and is not yet released, grouped by class and exam, each group one click from released.' },
        { title: 'Choose the class, term and exam', body: 'The list shows every subject for that exam and how many learners have marks.' },
        { title: 'Check the ranking preview', body: 'Scroll down to see the class ranking the release would produce, and any learners with missing papers (a missing paper counts as 0).' },
        { title: 'Release', body: 'Release a single subject, or all of them at once. Released subjects show “Learners can see”.' },
    ],
    points: [
        'You can still correct marks after releasing; learners see the corrected mark.',
        'A finished mark sheet also offers to release its subject on the spot.',
        '“Withdraw” hides a subject from learners again at any time.',
    ],
};

export const resultsTabSection: ManualSection = {
    id: 'results-tab',
    title: 'See a class’s results',
    summary: 'The “Results & Reports” tab on Exams & Marks shows how a class did: every subject side by side, one exam at a time, the analysis, and individual report cards.',
    figure: shot('marks-results', 'The Results & Reports tab for a class', 'Results & Reports: choose a class, then an exam, to see its results.'),
    points: [
        'Choose a class. “All subjects” is the broadsheet and rankings, with its own term and exam choice.',
        'For one subject, choose the term (the current one is selected), the exam and the subject. It opens on the exam the school is marking for that class, and each subject shows whether it is released.',
        '“Correct marks” opens that paper’s mark sheet on Enter & Correct Marks.',
        'Click a learner to download their PDF report card. Whole-class report cards are on the Report Cards page.',
    ],
};

export const examBeingMarkedSection: ManualSection = {
    id: 'exam-being-marked',
    title: 'Choose the exam being marked',
    summary: '“Exam being marked” on Enter & Correct Marks decides which exam each class is marking. Teachers then go straight to it, so Mid-Term marks never land in End-Term. Administrators, and staff with the Principal, Deputy Principal, DOS or Exams Officer duty, see it.',
    steps: [
        { title: 'Pick each level’s exam', body: 'Each level (for example Junior School) has a card. Choose the exam it is sitting, and every class in the level moves to it. A class sitting something different, such as a Form 4 mock, can be set on its own.' },
        { title: 'Set the exam dates', body: 'Under a level’s “Exam dates”, pick the day each exam starts. Every paper of that exam for the level’s classes moves to that date, so Skulbase knows which exam is due.' },
        { title: 'Move on when it changes', body: 'Once an exam is over, the card offers “Mid-Term done? Move on to End-Term”. Earlier exams stay open for corrections. “Stop marking” closes a level’s exam.' },
        { title: 'Answer requests', body: 'When a teacher presses “Ask for the exam”, their class shows “Asked by” with their name until you choose one.' },
    ],
    points: [
        'The heading says how many classes still have no exam chosen. Teachers there pick an exam themselves until you choose one.',
        'CATs and topical tests are always open; teachers reach them from “Mark a CAT, correct an earlier exam or open another term”.',
    ],
};

export const markingProgressSection: ManualSection = {
    id: 'marking-progress',
    title: 'See who is behind on marking',
    summary: '“Marking progress” on Enter & Correct Marks lists, for the exam each class is marking, every subject in every stream as marks entered out of expected, with the teacher assigned. Unfinished sheets come first, so you can nudge the right teacher before report-card day. Tap a cell to open that mark sheet.',
};

export const termLockSection: ManualSection = {
    id: 'lock-term',
    title: 'Lock a finished term',
    summary: 'Once report cards are out, lock the term so nobody changes a mark by mistake. The lock card is on Enter & Correct Marks for those who choose the exam being marked.',
    steps: [
        { title: 'Lock it', body: 'Press “Lock term” on the card and confirm. Nobody can enter, change or remove a mark in that term until it is unlocked. Releasing results still works.' },
        { title: 'Unlock for a correction', body: 'Press Unlock, let the teacher fix the mark, then lock the term again.' },
    ],
};

/** The marks chapter; `leaders` adds choosing the exam, marking progress and the term lock. */
export const marksChapter = (intro: string, leaders = false): ManualChapter => ({
    id: 'marks',
    title: 'Exams and marks',
    intro,
    sections: [
        ...(leaders ? [examBeingMarkedSection, markingProgressSection] : []),
        enterMarksSection, markSheetSection, uploadMarksSection, releaseSection, resultsTabSection,
        ...(leaders ? [termLockSection] : []),
    ],
});

// ── Attendance ──────────────────────────────────────────────────

export const attendanceSection: ManualSection = {
    id: 'attendance',
    title: 'Take the daily register',
    summary: 'Attendance holds one register per class per day. On the Register tab, mark each learner Present, Absent, Late or Excused, add a reason if you like, and let the parents of absent learners know by SMS.',
    figure: shot('attendance', 'The attendance register for a class with Present, Absent, Late and Excused buttons', 'The register: totals at the top, one row per learner, and a Save bar at the bottom.'),
    steps: [
        { title: 'Open Attendance', body: 'Choose Attendance in the menu. The Register tab is open. A class teacher’s own class opens straight away; otherwise pick the class.' },
        { title: 'Check the day', body: 'Today is selected. The arrows step to the previous or next school day, skipping weekends; the date box picks any day. A weekend day is flagged if you choose one.' },
        { title: 'Mark each learner', body: 'Tap Present, Absent, Late or Excused on each row. To save time, press “Mark N unmarked present” and then change only the exceptions.' },
        { title: 'Add a reason (optional)', body: 'The note icon at the end of a row adds a reason, such as “Unwell”. It shows under the learner’s name.' },
        { title: 'Save', body: 'Press Save at the bottom. Unsaved changes are kept if you switch class or day by mistake: you are asked first.' },
        { title: 'Tell parents', body: 'Press “Notify guardians” to text the parents of every learner marked absent: every linked parent and the number on the learner’s record. You see who will be texted before anything is sent, and nobody is texted twice for the same day.' },
    ],
    tip: 'PDF downloads the day’s register for printing or filing.',
};

export const attendanceSchoolSection: ManualSection = {
    id: 'attendance-school',
    title: 'The whole school on one day',
    summary: 'The Whole school tab (administrators) shows any school day across every class: how many registers have been taken out of all classes, how many learners are absent and late, and the school’s attendance rate.',
    points: [
        'Classes whose register has not been taken come first, marked “Not taken”, so you can remind their teachers.',
        'Each class shows a colour bar for the day (present, late, excused, absent), its rate and how many are absent.',
        'Tap a class to open its register for that day.',
        'The arrows move between school days, skipping weekends.',
    ],
};

export const attendanceReportsSection: ManualSection = {
    id: 'attendance-reports',
    title: 'Attendance reports',
    summary: 'The Reports tab shows one class over a period: the class’s attendance rate, how many registers were taken, and which learners attend less than 85% of the time. Administrators can choose any class; class teachers see their own.',
    steps: [
        { title: 'Choose the class and period', body: 'Pick the class, then This week, This month, Last 30 days or Last 90 days, or set your own dates (up to 120 days).' },
        { title: 'Read it', body: 'Learners are listed lowest attendance first, each with their rate, absent, late and excused days, and a small square for every day the register was taken. Tick “Only below 85%” to see just the learners to follow up.' },
        { title: 'Export', body: '“Excel” downloads the same grid: one column per day with P, A, L or E, the totals and each learner’s rate.' },
    ],
    tip: 'A day counts only if the class’s register was taken that day. A learner left unmarked on a day the register was taken counts as not marked, not absent.',
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
