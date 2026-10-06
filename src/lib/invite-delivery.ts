/**
 * Whether an invite (or password-reset) code reached the person, and what to
 * tell the admin. Client-safe, shared by the web and the app, so a failed SMS
 * is never reported as sent.
 */
export interface InviteDelivery {
  sms: boolean;
  email: boolean;
  /** Why the SMS didn't go, when it was tried. */
  smsError?: string | null;
  /** No phone number to text. */
  noPhone?: boolean;
}

export function inviteDeliveryMessage(d: InviteDelivery | null | undefined): { sent: boolean; text: string } | null {
  if (!d) return null;
  if (d.sms || d.email) {
    const channels = [d.sms && 'SMS', d.email && 'email'].filter(Boolean).join(' and ');
    return { sent: true, text: `Invite code sent by ${channels}.` };
  }
  const why = d.noPhone
    ? 'There is no phone number on file to text it to.'
    : d.smsError && /credentials|AT_API_KEY|AT_USERNAME/i.test(d.smsError)
      ? 'The school’s SMS service isn’t working right now (its account settings need fixing).'
      : d.smsError === 'Invalid phone number'
        ? 'The phone number on file isn’t a valid Kenyan number.'
        : d.smsError ? `The SMS failed: ${d.smsError}.` : '';
  return { sent: false, text: `The code was not sent. ${why} Share it yourself, by WhatsApp or in person.`.replace(/\s+/g, ' ').trim() };
}
