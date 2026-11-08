/**
 * Why a payment is voided: the reasons a bursar gives most, offered as
 * one-tap choices, and the rule that a reason is required. Client-safe and
 * shared with the app.
 */
export const VOID_REASONS = ['M-Pesa reversal', 'Entered twice', 'Wrong learner', 'Wrong amount', 'Cheque bounced'] as const;

/** Why a void reason can't be sent, or null. */
export function voidReasonProblem(reason: string): string | null {
    return reason.trim().length < 3 ? 'Say why the payment is being voided.' : null;
}
