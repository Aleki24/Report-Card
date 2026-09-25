import type { createClerkClient } from '@clerk/nextjs/server';

type ClerkClient = ReturnType<typeof createClerkClient>;

/** Long enough to cover the redirect back to the browser, short enough to be useless if leaked. */
const TICKET_TTL_SECONDS = 120;

/**
 * A one-time Clerk sign-in ticket for a user whose identity the server has
 * just proven — an invite code redeemed, or a password verified. The browser
 * exchanges it with `signIn.create({ strategy: 'ticket' })`, which starts the
 * session without a second round of verification codes.
 */
export async function createSignInTicket(clerk: ClerkClient, userId: string): Promise<string> {
  const token = await clerk.signInTokens.createSignInToken({ userId, expiresInSeconds: TICKET_TTL_SECONDS });
  return token.token;
}
