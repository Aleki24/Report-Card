import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { ChevronRight, KeyRound, UserPlus } from 'lucide-react-native';
import { publicPost } from '@/lib/api';
import { fonts, radius, spacing } from '@/lib/theme';
import { describeAuthError, useGoogleSignIn } from '@/lib/useGoogleSignIn';
import { useSignInCodeVerification } from '@/lib/useSignInCodeVerification';
import {
    AuthDivider, AuthError, AuthField, AuthFootnote, AuthLink, AuthPrimaryButton, AuthShell, AuthStack, GoogleButton, Wordmark, authColors,
} from '@/components/auth/AuthShell';
import { VerificationCodeStep } from '@/components/auth/VerificationCodeStep';

const MIN_PASSWORD = 8;

/**
 * The web's /signup: the account is created server-side (POST /api/auth/signup)
 * and then signed in, finishing Clerk's new-device code here if it asks. New
 * accounts start PENDING, so the app moves on to onboarding by itself, where
 * they register a school or join one with a code.
 */
export default function SignUpScreen() {
    const router = useRouter();
    const { isLoaded, signIn } = useSignIn();
    const verification = useSignInCodeVerification();
    const google = useGoogleSignIn();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const problem =
        !firstName.trim() || !lastName.trim() ? 'Enter your first and last name.'
        : !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Enter a valid email address.'
        : password.length < MIN_PASSWORD ? `Password must be at least ${MIN_PASSWORD} characters.`
        : null;

    const submit = async () => {
        if (problem) { setError(problem); return; }
        setError(null);
        google.clearError();
        setLoading(true);
        const identifier = email.trim();
        try {
            await publicPost('/api/auth/signup', { email: identifier, password, first_name: firstName.trim(), last_name: lastName.trim() });
            if (!isLoaded || !signIn) {
                router.replace({ pathname: '/(auth)/sign-in', params: { created: '1' } });
                return;
            }
            const result = await signIn.create({ identifier, password });
            const outcome = await verification.continueSignIn(result, { identifier, password });
            if (outcome === 'unsupported') router.replace({ pathname: '/(auth)/sign-in', params: { created: '1' } });
        } catch (err) {
            setError(describeAuthError(err, 'Failed to create account.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell
            title={verification.pending ? 'Check your inbox' : 'Create your account'}
            subtitle={verification.pending ? 'Confirm it’s you to finish setting up.' : <>Get started with <Wordmark /> today</>}
            footer={verification.pending ? null : (
                <>
                    <AuthFootnote>Already have an account? <AuthLink label="Sign in" onPress={() => router.replace('/(auth)/sign-in')} /></AuthFootnote>
                    <AuthFootnote>Setting up a new school? Create your account here, then register the school.</AuthFootnote>
                </>
            )}
        >
            {verification.pending ? (
                <VerificationCodeStep
                    pending={verification.pending}
                    cooldown={verification.cooldown}
                    onVerify={verification.verifyCode}
                    onResend={verification.resendCode}
                    onBack={() => {
                        // The account exists already; finishing later happens on sign-in.
                        verification.reset();
                        router.replace({ pathname: '/(auth)/sign-in', params: { created: '1' } });
                    }}
                />
            ) : (
                <AuthStack>
                    {/* Teachers and students already have an account waiting; signing up would only lead to a second code. */}
                    <Pressable
                        onPress={() => router.push('/(auth)/activate')}
                        accessibilityRole="link"
                        style={({ pressed }) => [styles.activateCard, pressed && { opacity: 0.8 }]}
                    >
                        <KeyRound size={20} color={authColors.accent} />
                        <Text style={styles.activateText}>
                            <Text style={styles.activateTitle}>Teacher or student?{'\n'}</Text>
                            Got an invite code or link from your school? Activate your account instead.
                        </Text>
                        <ChevronRight size={16} color={authColors.accent} />
                    </Pressable>

                    <AuthError message={error ?? google.error} />

                    <View style={styles.nameRow}>
                        <View style={styles.nameField}>
                            <AuthField label="First Name" value={firstName} onChangeText={setFirstName} placeholder="John" autoComplete="given-name" textContentType="givenName" autoCapitalize="words" />
                        </View>
                        <View style={styles.nameField}>
                            <AuthField label="Last Name" value={lastName} onChangeText={setLastName} placeholder="Doe" autoComplete="family-name" textContentType="familyName" autoCapitalize="words" />
                        </View>
                    </View>
                    <AuthField
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@school.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                    />
                    <AuthField
                        label="Password"
                        password
                        value={password}
                        onChangeText={setPassword}
                        placeholder={`At least ${MIN_PASSWORD} characters`}
                        autoComplete="new-password"
                        textContentType="newPassword"
                        returnKeyType="go"
                        onSubmitEditing={() => void submit()}
                    />
                    <AuthPrimaryButton label="Create Account" icon={UserPlus} onPress={() => void submit()} loading={loading} disabled={google.loading} />
                    <AuthDivider />
                    <GoogleButton label="Sign up with Google" onPress={() => void google.start()} loading={google.loading} disabled={loading} />
                </AuthStack>
            )}
        </AuthShell>
    );
}

const styles = StyleSheet.create({
    activateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: 'rgba(99,102,241,0.2)',
        backgroundColor: 'rgba(99,102,241,0.05)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    activateText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: fonts.regular, color: authColors.label },
    activateTitle: { fontFamily: fonts.semibold, color: authColors.heading },
    nameRow: { flexDirection: 'row', gap: spacing.md },
    nameField: { flex: 1 },
});
