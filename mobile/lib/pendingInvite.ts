/**
 * An invite code verified on the activation screen, kept for onboarding when
 * the person chooses Google instead of a password. Signing in with Google
 * swaps the auth screens for the signed-in app at once, so the code can't
 * stay on the activation screen; onboarding takes it and joins the school
 * with it (POST /api/school/join), as the web's /activate/callback does.
 * In memory only: it is needed for the next few seconds, within one launch.
 */
let pendingInviteCode: string | null = null;

export function setPendingInviteCode(code: string | null): void {
    pendingInviteCode = code;
}

/** The code, once; later calls get null. */
export function takePendingInviteCode(): string | null {
    const code = pendingInviteCode;
    pendingInviteCode = null;
    return code;
}
