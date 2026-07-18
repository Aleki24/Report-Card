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

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const { startSSOFlow } = useSSO();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignIn = useCallback(async () => {
        if (!isLoaded || !signIn) return;
        setError(null);
        setLoading(true);
        try {
            const result = await signIn.create({ identifier: email.trim(), password });
            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
            } else if (result.status === 'needs_second_factor') {
                setError('This account requires extra verification (MFA). Please sign in on the web for now.');
            } else {
                setError(`Sign in incomplete: ${result.status}`);
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
    }, [isLoaded, signIn, email, password, setActive]);

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
    footnote: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
});
