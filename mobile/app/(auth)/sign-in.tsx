import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { isClerkAPIResponseError } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { colors, radius, spacing } from '@/lib/theme';
import { describeCodeError, useSignInCodeVerification } from '@/lib/useSignInCodeVerification';

const CODE_LENGTH = 6;

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
    const { isLoaded, signIn } = useSignIn();
    const { startSSOFlow } = useSSO();
    const verification = useSignInCodeVerification();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [notice, setNotice] = useState<string | null>(null);

    const handleSignIn = useCallback(async () => {
        if (!isLoaded || !signIn) return;
        setError(null);
        setLoading(true);
        try {
            const result = await signIn.create({ identifier: email.trim(), password });
            const outcome = await verification.continueSignIn(result);
            if (outcome === 'verify') {
                setCode('');
            } else if (outcome === 'unsupported') {
                setError('This account needs a verification method the app doesn’t support yet. Please sign in on the web.');
            }
        } catch (err) {
            if (isClerkAPIResponseError(err)) {
                setError(err.errors[0]?.longMessage ?? err.errors[0]?.message ?? 'Sign in failed.');
            } else {
                setError(err instanceof Error ? err.message : 'Sign in failed.');
            }
        } finally {
            setLoading(false);
        }
    }, [isLoaded, signIn, email, password, verification]);

    const handleVerify = useCallback(async () => {
        setError(null);
        setNotice(null);
        setLoading(true);
        try {
            if (!(await verification.verifyCode(code))) {
                setError('Verification could not be completed. Request a new code and try again.');
            }
        } catch (err) {
            setError(describeCodeError(err));
        } finally {
            setLoading(false);
        }
    }, [verification, code]);

    const handleResend = useCallback(async () => {
        setError(null);
        setNotice(null);
        try {
            await verification.resendCode();
            setCode('');
            setNotice('A new code is on its way.');
        } catch (err) {
            setError(describeCodeError(err));
        }
    }, [verification]);

    const handleBack = useCallback(() => {
        verification.reset();
        setCode('');
        setError(null);
        setNotice(null);
    }, [verification]);

    const handleGoogleSignIn = useCallback(async () => {
        setError(null);
        setGoogleLoading(true);
        try {
            const { createdSessionId, setActive: setActiveSSO } = await startSSOFlow({ strategy: 'oauth_google' });
            if (createdSessionId && setActiveSSO) {
                await setActiveSSO({ session: createdSessionId });
            }
        } catch (err) {
            if (isClerkAPIResponseError(err)) {
                setError(err.errors[0]?.longMessage ?? err.errors[0]?.message ?? 'Google sign-in failed.');
            } else {
                setError(err instanceof Error ? err.message : 'Google sign-in failed.');
            }
        } finally {
            setGoogleLoading(false);
        }
    }, [startSSOFlow]);

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <View style={styles.hero}>
                        <View style={styles.logoDot} />
                        <Text style={styles.title}>Report Card</Text>
                        <Text style={styles.subtitle}>Sign in to view your results, attendance and more.</Text>
                    </View>

                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {notice ? <Text style={styles.notice}>{notice}</Text> : null}

                    {verification.pending ? (
                        <>
                            <Text style={styles.codeHeading}>
                                Check your {verification.pending.strategy === 'email_code' ? 'email' : 'phone'}
                            </Text>
                            <Text style={styles.codeHint}>
                                We sent a {CODE_LENGTH}-digit verification code to{' '}
                                <Text style={styles.codeTarget}>{verification.pending.safeIdentifier}</Text>.
                            </Text>

                            <View style={styles.field}>
                                <Text style={styles.label}>Verification code</Text>
                                <TextInput
                                    value={code}
                                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                                    keyboardType="number-pad"
                                    textContentType="oneTimeCode"
                                    autoComplete="one-time-code"
                                    maxLength={CODE_LENGTH}
                                    autoFocus
                                    placeholder="••••••"
                                    placeholderTextColor={colors.muted}
                                    style={[styles.input, styles.codeInput]}
                                />
                            </View>

                            <Pressable
                                onPress={handleVerify}
                                disabled={loading || code.length !== CODE_LENGTH}
                                style={[styles.primaryButton, (loading || code.length !== CODE_LENGTH) && styles.buttonDisabled]}
                            >
                                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Verify and continue</Text>}
                            </Pressable>

                            <View style={styles.codeActions}>
                                <Pressable onPress={handleBack} hitSlop={8}>
                                    <Text style={styles.linkMuted}>Back</Text>
                                </Pressable>
                                <Pressable onPress={handleResend} disabled={verification.cooldown > 0} hitSlop={8}>
                                    <Text style={verification.cooldown > 0 ? styles.linkMuted : styles.link}>
                                        {verification.cooldown > 0 ? `Resend code in ${verification.cooldown}s` : 'Resend code'}
                                    </Text>
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.field}>
                                <Text style={styles.label}>Email</Text>
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="email-address"
                                    textContentType="emailAddress"
                                    placeholder="you@example.com"
                                    placeholderTextColor={colors.muted}
                                    style={styles.input}
                                />
                            </View>

                            <View style={styles.field}>
                                <Text style={styles.label}>Password</Text>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    textContentType="password"
                                    placeholder="••••••••"
                                    placeholderTextColor={colors.muted}
                                    style={styles.input}
                                />
                            </View>

                            <Pressable
                                onPress={handleSignIn}
                                disabled={loading || !email || !password}
                                style={[styles.primaryButton, (loading || !email || !password) && styles.buttonDisabled]}
                            >
                                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Sign In</Text>}
                            </Pressable>

                            <View style={styles.divider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>or</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            <Pressable
                                onPress={handleGoogleSignIn}
                                disabled={googleLoading}
                                style={[styles.secondaryButton, googleLoading && styles.buttonDisabled]}
                            >
                                {googleLoading ? (
                                    <ActivityIndicator color={colors.foreground} />
                                ) : (
                                    <Text style={styles.secondaryButtonText}>Continue with Google</Text>
                                )}
                            </Pressable>

                            <Text style={styles.footnote}>
                                New here? Ask your school admin for an invite, then finish setting up your account on the web app first.
                            </Text>
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
    hero: { alignItems: 'center', marginBottom: spacing.xl },
    logoDot: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primary, marginBottom: spacing.md },
    title: { fontSize: 26, fontWeight: '800', color: colors.foreground },
    subtitle: { fontSize: 14, color: colors.muted, marginTop: spacing.xs, textAlign: 'center' },
    errorBox: {
        backgroundColor: colors.dangerBg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.danger,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    errorText: { color: colors.danger, fontSize: 13 },
    field: { marginBottom: spacing.md },
    label: { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 6 },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        fontSize: 15,
        color: colors.foreground,
        backgroundColor: colors.card,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    buttonDisabled: { opacity: 0.6 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { marginHorizontal: spacing.sm, color: colors.muted, fontSize: 12 },
    secondaryButton: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
        backgroundColor: colors.card,
    },
    secondaryButtonText: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
    notice: { color: colors.muted, fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
    codeHeading: { fontSize: 18, fontWeight: '800', color: colors.foreground, textAlign: 'center' },
    codeHint: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
    codeTarget: { fontWeight: '700', color: colors.foreground },
    codeInput: { fontSize: 22, letterSpacing: 8, textAlign: 'center' },
    codeActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
    link: { color: colors.primary, fontSize: 14, fontWeight: '700' },
    linkMuted: { color: colors.muted, fontSize: 14, fontWeight: '600' },
    footnote: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
});
