import { shot } from './figures';
import type { ManualChapter, ManualSection } from './types';

/*
  The Fees page, shared by the administrator guide and the bursar and finance
  guide: the same page, seen by admins and by staff with the Bursar or
  Accountant duty.
*/

export const feeRecordsSection: ManualSection = {
    id: 'fee-records',
    title: 'Fee records',
    summary: 'The Fee records tab shows the chosen term’s totals (expected, collected, outstanding, overdue), a collection progress bar, and one row per learner.',
    figure: shot('fees', 'The Fees page with totals and fee records', 'Fees → Fee records for the chosen term.'),
    points: [
        'Choose the term at the top. Search by learner or admission number, or filter by status and class.',
        'Click a learner’s row to open their fee account (below).',
        'Each row also has Pay (record a payment), payment history with receipts, edit and delete. “Add record” bills one learner; “Export” downloads the list as a spreadsheet.',
        'Finance staff get links from Fees to fee structures and invoicing, the payment channels, and linking a class’s parents.',
    ],
};

export const feeAccountSection: ManualSection = {
    id: 'fee-account',
    title: 'A learner’s fee account and statement',
    summary: 'A learner’s fee account puts everything about their fees in one place: what they owe across every term (arrears carried forward), each term’s bill with its vote heads and bursaries, every payment with its receipt, and the parents to call or text.',
    steps: [
        { title: 'Open it', body: 'Click the learner’s row on Fee records or on Who owes.' },
        { title: 'Read the balance', body: 'The top shows the balance due (or credit) across all terms, what was billed and paid, and any arrears from earlier terms.' },
        { title: 'Call the parent', body: 'The parents linked to the learner, and the contact on their record, are listed with their phone numbers. If nobody is linked you can link a parent on the spot.' },
        { title: 'Record a payment', body: '“Record payment” records money against the oldest term still owing, so arrears clear before the current bill.' },
        { title: 'Give the statement', body: '“Statement” downloads a PDF listing every charge, bursary and payment with a running balance, and how to pay (the Paybill with the admission number as the account, and bank accounts). Hand it to a parent or send it on WhatsApp.' },
    ],
};

export const recordPaymentSection: ManualSection = {
    id: 'record-payment',
    title: 'Record a payment',
    summary: 'For cash, cheques, bank deposits and M-Pesa messages you receive yourself. Payments made online from the learner’s or a parent’s Fees page are recorded automatically.',
    figure: shot('fees-payment', 'The Record payment dialog', 'Record payment: the amount is filled with the balance; change it for a part payment.'),
    steps: [
        { title: 'Press Pay', body: 'On the learner’s row, or “Record payment” in their fee account.' },
        { title: 'Enter the payment', body: 'Type the amount, the date paid (change it when recording an older slip), the method and, optionally, who paid and a note.' },
        { title: 'Give the reference', body: 'Every payment that is not cash needs what traces it: the M-Pesa code from the message (10 letters and numbers), the bank slip or transaction number, or the cheque number. Skulbase refuses a code or slip number already recorded, so the same money cannot be entered twice.' },
        { title: 'Save', body: 'The balance updates straight away, and the receipt is in the payment history and the fee account.' },
    ],
    caution: 'The bursar or an administrator can void a payment recorded by mistake from the payment history, and must say why (an M-Pesa reversal, entered twice, a bounced cheque). The receipt then shows as voided, with who voided it, when and why; the day book shows it too.',
};

export const shareSection: ManualSection = {
    id: 'share-payment',
    title: 'One payment for two children',
    summary: 'A parent often pays for two children in one M-Pesa payment, with only one child’s admission number as the account. The money lands on that child. Move the other child’s part across instead of voiding and re-entering it.',
    steps: [
        { title: 'Open the payment history', body: 'On the child the money went to, open the payment history and press the share button beside the payment.' },
        { title: 'Pick the brother or sister', body: 'Learners sharing a parent’s phone are offered first; you can also search for anyone else.' },
        { title: 'Enter their share', body: 'Half is filled in; change it if the parent says otherwise. Press Share.' },
    ],
    points: [
        'The other child gets their own receipt, carrying the same M-Pesa code; the first receipt keeps the rest.',
        'Voiding a share gives its money back to the payment it came from. Voiding the original payment (a reversal) voids its shares with it.',
    ],
};

export const receiptSection: ManualSection = {
    id: 'receipts',
    title: 'Receipts and checking one is genuine',
    summary: 'Every completed payment has an A5 receipt, ready to print or share. It shows who paid for which learner, the amount in figures and words, the M-Pesa or bank code, what the payment paid for (the term’s vote heads, in priority order), the term balance, arrears from earlier terms and the total still due, all as they stood right after the payment, so a reprint matches the original.',
    points: [
        'The receipt carries the school’s contacts and a QR code. Scanning it opens a Skulbase page that says whether the receipt is genuine, voided or not yet confirmed, with the receipt number, amount, date and the learner’s first name only.',
        'Receipts are only issued for confirmed payments. An online payment still waiting for confirmation has no receipt yet.',
    ],
};

export const batchFeesSection: ManualSection = {
    id: 'batch-fees',
    title: 'Bill a whole class at once',
    summary: 'The Batch entry tab bills every learner in a class for the term in one go. Schools with fee structures usually bill from Billing → Invoicing instead.',
    figure: shot('fees-batch', 'The Batch entry tab', 'Fees → Batch entry.'),
    steps: [
        { title: 'Choose the class and term', body: 'Every active learner in the class is listed.' },
        { title: 'Set the fee', body: 'Type the fee once and press Apply to fill it for everyone, and set one due date. Change any learner’s fee individually if needed.' },
        { title: 'Record payments now (optional)', body: 'Enter any cash already received in “Payment now”; “Balance after” updates as you type. M-Pesa, bank and cheque payments each need their own code, so record those one by one or upload the statement on Reconcile.' },
        { title: 'Save all', body: 'Press “Save all”. Learners already billed for the term keep their record and are updated rather than billed twice.' },
    ],
};

export const whoOwesSection: ManualSection = {
    id: 'who-owes',
    title: 'Who owes, and fee reminders',
    summary: 'The Who owes tab lists every learner owing across all their terms, most owed first: how much, how long it has been overdue, how many terms are owing, when they last paid, and the parent to call (a linked parent before the contact on the learner’s record).',
    steps: [
        { title: 'Narrow it down', body: 'Filter by class, and set “Over KSh” to leave out small balances. The figures above show how many learners owe, the total owed (arrears included) and how many have no parent phone.' },
        { title: 'Follow one up', body: 'Tap a phone number to call, or a learner to open their fee account.' },
        { title: 'Export', body: '“Excel” downloads the list for the board or the class teachers.' },
        { title: 'Text reminders', body: 'Press “Text reminders”. Skulbase first says how many messages will go to the parents of how many learners, and how many owing learners have no number at all. Confirm to send.' },
        { title: 'Chase the right families first', body: 'The buttons above the list narrow it to families who have paid nothing this term, to those whose promise to pay was broken, and to those who have promised. The Follow-up column shows each family’s latest promise, or when they were last contacted.' },
    ],
    points: [
        'Each reminder gives the learner’s balance across all terms and, when the school takes M-Pesa, the Paybill and account number.',
        'Reminders reach every linked parent as well as the number on the learner’s record, once each.',
        'Learners with no parent phone are counted, not texted. Link their parents under Parent accounts.',
    ],
};

export const collectionsSection: ManualSection = {
    id: 'collections',
    title: 'Collections report',
    summary: 'The Collections tab shows the money received over a period: today, the last 7 days, this month, the last 30 days or any dates. It gives the total, the number of payments and the daily average, split by method (M-Pesa, cash, bank), by class and by day. Use it for daily banking and the head’s weekly report.',
};

export const paymentsLogSection: ManualSection = {
    id: 'payments-log',
    title: 'The payments log',
    summary: 'The Payments tab lists every payment received, filtered by date, method, automatic or manual and status, with Export beside the search. It shows each payment’s reference (M-Pesa code, bank slip or cheque number), and who voided a voided one. Payments not yet matched to a learner are on the Reconcile tab.',
};

export const followUpsSection: ManualSection = {
    id: 'follow-ups',
    title: 'Following up arrears: notes and promises to pay',
    summary: 'Chase arrears early in the term, and write down what was said. In a learner’s fee account, “Follow-ups” keeps each call, message or meeting, and each promise to pay with its amount and date.',
    steps: [
        { title: 'Add a note', body: 'Press Add, choose “Note of a contact”, tap a quick note (Called, no answer; Sent a reminder SMS…) or write what was said, and save.' },
        { title: 'Write down a promise', body: 'Choose “Promise to pay”, enter the amount and the date the family will pay by, and save.' },
    ],
    points: [
        'Skulbase checks each promise against the payments: it shows as Promised until the date, Promise kept once the amount is in, or Promise broken if the date passes short.',
        'Who owes shows the latest promise or contact for every family, and can list only the broken promises.',
        'Accountants and bursars can write follow-ups; the bursar or an administrator can remove one written by mistake.',
    ],
};

export const overviewSection: ManualSection = {
    id: 'fees-overview',
    title: 'The fees overview and health score',
    summary: 'Finance staff open Fees on the Overview: a health score out of 100 for how the school’s money is kept, the three fixes that would lift it most, this term’s collection rate against last term’s, what is owed by class, and how many families have paid nothing this term.',
    figure: shot('fees-overview', 'The fees overview with its health score', 'Fees → Overview: the score, the three fixes to make first, and this term against last term.'),
    points: [
        'The score adds up seven checks: the collection rate (30 points), payments matched to learners (15), a statement checked in the last week (15), each day’s takings signed off (15), families who have paid something (10), promises kept (5) and parents with a phone (10).',
        'Each fix says what was found and what to do, with a Go button to the tab where it is done.',
        'Early in a term the collection target grows with the weeks, and families who have not paid yet do not count against the score.',
    ],
};

export const reconcileSection: ManualSection = {
    id: 'reconcile',
    title: 'Reconcile: matching every payment to a learner',
    summary: 'Parents pay the Paybill with the learner’s admission number as the account. When a payment cannot be matched (a typo, a missing account number, a learner not billed yet) it waits on the Reconcile tab, with the learners it most likely belongs to. Once a week, check the M-Pesa or bank statement against Skulbase there too.',
    figure: shot('fees-reconcile', 'Payments waiting to be matched, with suggestions', 'Fees → Reconcile: each payment shows who it most likely belongs to.'),
    steps: [
        { title: 'Match what is waiting', body: 'Each payment lists likely learners: an admission number typed differently, the parent’s phone, or the payer’s name. Pick one (or “Someone else” to search) and press Assign. For two children in one payment, press “Split between children” and set each share.' },
        { title: 'Set aside what is not fees', body: 'Money paid to the wrong Paybill and refunded, or a supplier’s deposit: press “Not school fees” and say why. It leaves the list and every total, and keeps who did it.' },
        { title: 'Check the statement', body: 'Download the M-Pesa statement (or the bank statement) as Excel or CSV and upload it under “Check a statement”. Skulbase reads every payment in, finds those already in Skulbase by their code, and matches the rest by admission number.' },
        { title: 'Review and save', body: 'Lines matched by admission number are ready; check the others, record them to a learner, leave them unmatched to chase, or mark them not school fees. The totals must agree before you save: the statement total equals what is recorded, already in, left unmatched and set aside.' },
    ],
    points: [
        'Skulbase also lists payments in Skulbase for the statement’s dates that the statement does not show: check each one (a cash payment entered as M-Pesa, or a wrong code).',
        'Each statement checked is kept in the history, with who uploaded it and how its money was accounted for.',
        'Matching unmatched payments the same week, before parents ask, keeps balances and reminders right.',
    ],
};

export const dayBookSection: ManualSection = {
    id: 'day-book',
    title: 'The day book: signing off each day',
    summary: 'The Day book shows one day’s money in: every payment (voided ones too), the totals by method and by who recorded them, money still to match, and payments entered on a later day than they were paid. Someone other than the person who recorded the money looks it over and signs the day off.',
    figure: shot('fees-daybook', 'The day book for one day', 'Fees → Day book: the day’s takings, by method and by who recorded them, and its sign-off.'),
    steps: [
        { title: 'Pick the day', body: 'Today opens first. The strip of recent days shows each day’s takings, with a green dot for a signed-off day and an amber one for a day that changed after it was signed.' },
        { title: 'Look it over', body: 'Compare the cash total with the cash banked and the M-Pesa total with the statement; check the voided and late entries.' },
        { title: 'Sign it off', body: 'Add a note if useful (for example the bank slip number) and press “Mark day as reviewed”. Only the bursar or an administrator can sign.' },
    ],
    points: [
        'If you recorded some of the day’s payments yourself, Skulbase asks you to confirm you are checking your own entries, and the sign-off says so. Better: ask the head or a second person to sign that day.',
        'A payment recorded or voided after the sign-off marks the day as changed, with what it was and what it is now, until it is signed again.',
    ],
};

export const routineSection: ManualSection = {
    id: 'fee-routine',
    title: 'A fee routine that keeps the books right',
    summary: 'The habits behind a clean fees ledger, and where each is done in Skulbase.',
    points: [
        'Tell parents to pay the Paybill with the admission number as the account; the statement and reminders give it.',
        'Every day: sign off the day’s takings in the Day book, ideally by someone who did not record them.',
        'Every week: match what is waiting and check the M-Pesa and bank statements on Reconcile, so Skulbase and the statement agree.',
        'From the first weeks of term: chase families who have paid nothing, and write down every promise to pay.',
        'Give a receipt for every payment, with its reference; void with a reason, never delete.',
        'Watch the health score on the Overview: its three fixes say what to do next.',
    ],
};

/** The Fees chapter; `intro` says who the page is for in this guide. */
export const feesChapter = (intro: string): ManualChapter => ({
    id: 'fees-chapter',
    title: 'Fees',
    intro,
    sections: [
        overviewSection, feeRecordsSection, feeAccountSection, recordPaymentSection, receiptSection, shareSection, batchFeesSection,
        reconcileSection, dayBookSection, whoOwesSection, followUpsSection, collectionsSection, paymentsLogSection, routineSection,
    ],
});
