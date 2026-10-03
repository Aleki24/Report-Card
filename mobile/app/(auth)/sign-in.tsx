import React, { useCallback, useState } from 'react';
import { useSignIn } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import { publicPost, webUrl } from '@/lib/api';
import { describeAuthError, useGoogleSignIn } from '@/lib/useGoogleSignIn';
import { useSignInCodeVerification } from '@/lib/useSignInCodeVerification';
import {
    AuthDivider, AuthError, AuthField, AuthFootnote, AuthLink, AuthPrimaryButton, AuthShell, AuthStack, GoogleButton, Wordmark,
} from '@/components/auth/AuthShell';
import { VerificationCodeStep } from '@/components/auth/VerificationCodeStep';
import { Notice } from '@/components/ui';

WebBrowser.maybeCompleteAuthSession();

/**
 * Teachers and students sign in with the username their school gave them.
 * Username may not be an enabled Clerk identifier, so resolve it to the
 * account's email first — the same step the web login takes. Falls back to
 * the raw value if the lookup fails, letting Clerk report "not found".
 */
async function resolveIdentifier(value: string): Promise<string> {
    if (value.includes('@')) return value;
    try {
        const { email } = await publicPost<{ email?: string | null }>('/api/auth/resolve-identifier', { identifier: value });
        return email || value;
    } catch {
        return value;
    }
}

/** The web's /login. A completed sign-in moves the app on by itself (root layout). */
export default function SignInScreen() {
    const router = useRouter();
    const { created } = useLocalSearchParams<{ created?: string }>();
    const { isLoaded, signIn } = useSignIn();
    const verification = useSignInCodeVerification();
    const google = useGoogleSignIn();

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignIn = useCallback(async () => {
        if (!isLoaded || !signIn) return;
        setError(null);
        google.clearError();
        setLoading(true);
        try {
            const resolved = await resolveIdentifier(identifier.trim());
            const result = await signIn.create({ identifier: resolved, password });
            const outcome = await verification.continueSignIn(result, { identifier: resolved, password });
            if (outcome === 'unsupported') {
                setError('This account needs a verification method the app doesn’t support yet. Please sign in on the web.');
            }
        } catch (err) {
            setError(describeAuthError(err, 'Sign in failed.'));
        } finally {
            setLoading(false);
        }
    }, [isLoaded, signIn, identifier, password, verification, google]);

    const canSubmit = identifier.trim().length > 0 && password.length > 0;

    return (
        <AuthShell
            title={verification.pending ? 'Check your inbox' : 'Welcome back'}
            subtitle={verification.pending ? 'Confirm it’s you to finish signing in.' : <>Sign in to your <Wordmark /> account to continue</>}
            footer={verification.pending ? null : (
                <>
                    <AuthFootnote>Don’t have an account? <AuthLink label="Create one" onPress={() => router.push('/(auth)/sign-up')} /></AuthFootnote>
                    <AuthFootnote>First time? <AuthLink label="Activate your account" onPress={() => router.push('/(auth)/activate')} /></AuthFootnote>
                    <AuthFootnote>Need help? <AuthLink label="Read the user guides" onPress={() => router.push('/help')} /></AuthFootnote>
                </>
            )}
        >
            {verification.pending ? (
                <VerificationCodeStep
                    pending={verification.pending}
                    cooldown={verification.cooldown}
                    onVerify={verification.verifyCode}
                    onResend={verification.resendCode}
                    onBack={verification.reset}
                />
            ) : (
                <AuthStack>
                    {created ? <Notice tone="success" message="Account created! Sign in with your credentials." /> : null}
                    <AuthError message={error ?? google.error} />
                    <AuthField
                        label="Email or username"
                        value={identifier}
                        onChangeText={setIdentifier}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        textContentType="username"
                        autoComplete="username"
                        placeholder="Enter your email or username"
                        returnKeyType="next"
                    />
                    <AuthField
                        label="Password"
                        password
                        value={password}
                        onChangeText={setPassword}
                        textContentType="password"
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        returnKeyType="go"
                        onSubmitEditing={() => { if (canSubmit) void handleSignIn(); }}
                        hint={<AuthLink label="Forgot password?" onPress={() => void WebBrowser.openBrowserAsync(webUrl('/forgot-password'))} />}
                    />
                    <AuthPrimaryButton label="Sign In" icon={LogIn} onPress={() => void handleSignIn()} loading={loading} disabled={!canSubmit || google.loading} />
                    <AuthDivider />
                    <GoogleButton onPress={() => void google.start()} loading={google.loading} disabled={loading} />
                </AuthStack>
            )}
        </AuthShell>
    );
}
