import { createClerkClient } from '@clerk/nextjs/server';
import { platformOwnerEmails } from '@/lib/school-approval';

/**
 * Ways Clerk marks an email address as verified that prove the person
 * controls the inbox: a code or link sent to it, an invitation sent to it,
 * or a Google (or other OAuth) sign-in for it. Addresses the server created
 * itself (sign-up, invite activation) are marked verified with the "admin"
 * strategy without any proof, so they are not enough.
 */
function provesInbox(strategy: string): boolean {
    return strategy === 'email_code' || strategy === 'email_link' || strategy === 'ticket' || strategy.startsWith('from_oauth_');
}

/** Clerk user ids listed in PLATFORM_OWNER_USER_IDS (comma separated). */
function ownerUserIds(): string[] {
    return (process.env.PLATFORM_OWNER_USER_IDS ?? '').split(',').map(v => v.trim()).filter(Boolean);
}

/**
 * Whether this signed-in Clerk user is the platform owner, who approves new
 * schools. Either their user id is listed in PLATFORM_OWNER_USER_IDS, or one
 * of the owner's email addresses is on their Clerk account and was proven to
 * be theirs (see provesInbox). Matching the email stored in our users table
 * is not enough: anyone can type an address when signing up or activating.
 */
export async function isPlatformOwner(userId: string): Promise<boolean> {
    if (ownerUserIds().includes(userId)) return true;
    const owners = new Set(platformOwnerEmails().map(e => e.trim().toLowerCase()));
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const user = await clerk.users.getUser(userId);
    return user.emailAddresses.some(address =>
        owners.has(address.emailAddress.trim().toLowerCase())
        && address.verification?.status === 'verified'
        && provesInbox(address.verification.strategy),
    );
}
