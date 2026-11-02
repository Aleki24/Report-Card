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
        { title: 'Save', body: 'The balance updates straight away, and the receipt is in the payment history and the fee account.' },
    ],
    caution: 'An administrator can void a payment recorded by mistake from the payment history. The receipt then shows as voided when anyone checks it.',
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
        { title: 'Record payments now (optional)', body: 'Enter any payment already received in “Payment now”; “Balance after” updates as you type.' },
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
    title: 'The payments log and unmatched payments',
    summary: 'The Payments tab lists every payment received, filtered by date, method (automatic or manual) and status, with Export beside the search. M-Pesa or bank payments that could not be matched to a learner (for example a wrong account number) appear with a button to assign them to the right learner.',
};

/** The Fees chapter; `intro` says who the page is for in this guide. */
export const feesChapter = (intro: string): ManualChapter => ({
    id: 'fees-chapter',
    title: 'Fees',
    intro,
    sections: [
        feeRecordsSection, feeAccountSection, recordPaymentSection, receiptSection, batchFeesSection,
        whoOwesSection, collectionsSection, paymentsLogSection,
    ],
});
