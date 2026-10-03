import React from 'react';
import { LoadingView } from '@/components/ui';

/**
 * Where Google returns the browser (skulbase://sso-callback, see
 * lib/useGoogleSignIn.ts). The SSO hook finishes the sign-in itself; this
 * only gives the deep link a route to land on while it does.
 */
export default function SsoCallbackScreen() {
    return <LoadingView />;
}
