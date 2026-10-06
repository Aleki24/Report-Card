import React, { useState } from 'react';
import { Text } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { fonts } from '@/lib/theme';
import { clerkMessage } from '@/lib/useGoogleSignIn';
import {
    AuthError, AuthField, AuthFootnote, AuthLink, AuthPrimaryButton, AuthShell, AuthStack,
} from '@/components/auth/AuthShell';

const CODE_LENGTH = 6;
const MIN_PASSWORD = 8;

type Step = 'request' | 'reset';

/**
 * The web's /forgot-password: email a code, then set a new password. Also how
 * a Google-first account adds a password — Clerk links them by verified email.
 * Completing it signs the person in, which moves the app on by itself.
 */
export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { isLoaded, signIn, setActive } = useSignIn();
    const [step, setStep] = useState<Step>('request');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const requestCode = async () => {
        if (!isLoaded || !signIn) return;
        setLoading(true);
        setError(null);
        try {
            await signIn.create({ strategy: 'reset_password_email_code', identifier: email.trim() });
            setStep('reset');
        } catch (err) {
            setError(clerkMessage(err, { form_identifier_not_found: 'No account uses this email address.' }, 'We couldn’t send a code. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async () => {
        if (!isLoaded || !signIn) return;
        if (password.length < MIN_PASSWORD) { setError(`Use at least ${MIN_PASSWORD} characters.`); return; }
        setLoading(true);
        setError(null);
        try {
            const attempt = await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code });
            const result = attempt.status === 'needs_new_password'
                ? await signIn.resetPassword({ password, signOutOfOtherSessions: true })
                : attempt;
            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                return;
            }
            setError('We couldn’t finish resetting your password. Request a new code and try again.');
        } catch (err) {
            setError(clerkMessage(err, {
                form_code_incorrect: 'That code is wrong or has expired.',
                form_password_pwned: 'This password has appeared in a data breach. Choose a different one.',
                form_password_length_too_short: `Use at least ${MIN_PASSWORD} characters.`,
            }, 'We couldn’t reset your password. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    const backToRequest = () => {
        setStep('request');
        setCode('');
        setPassword('');
        setError(null);
    };

    return (
        <AuthShell
            title={step === 'request' ? 'Reset your password' : 'Choose a new password'}
            subtitle={step === 'request'
                ? 'We’ll email you a code. This also works if you’ve only ever signed in with Google.'
                : <>Enter the code sent to <Text style={{ fontFamily: fonts.semibold }}>{email.trim()}</Text> and your new password.</>}
            footer={<AuthFootnote>Remembered it? <AuthLink label="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} /></AuthFootnote>}
        >
            {step === 'request' ? (
                <AuthStack>
                    <AuthError message={error} />
                    <AuthField
                        label="Email address"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@school.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        autoFocus
                        invalid={error !== null}
                        returnKeyType="send"
                        onSubmitEditing={() => { if (email.trim()) void requestCode(); }}
                    />
                    <AuthPrimaryButton label="Send reset code" icon={KeyRound} onPress={() => void requestCode()} loading={loading} disabled={!isLoaded || !email.trim()} />
                </AuthStack>
            ) : (
                <AuthStack>
                    <AuthError message={error} />
                    <AuthField
                        label="Verification code"
                        value={code}
                        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoComplete="one-time-code"
                        maxLength={CODE_LENGTH}
                        placeholder="123456"
                        autoFocus
                        hint="It can take a minute to arrive. Check your spam folder too."
                    />
                    <AuthField
                        label="New password"
                        password
                        value={password}
                        onChangeText={setPassword}
                        placeholder={`At least ${MIN_PASSWORD} characters`}
                        autoComplete="new-password"
                        textContentType="newPassword"
                        returnKeyType="go"
                        onSubmitEditing={() => void resetPassword()}
                    />
                    <AuthPrimaryButton
                        label="Save password & sign in"
                        icon={ShieldCheck}
                        onPress={() => void resetPassword()}
                        loading={loading}
                        disabled={code.length !== CODE_LENGTH || !password}
                    />
                    <AuthFootnote>Wrong email? <AuthLink label="Use a different one" onPress={backToRequest} /></AuthFootnote>
                </AuthStack>
            )}
        </AuthShell>
    );
}
