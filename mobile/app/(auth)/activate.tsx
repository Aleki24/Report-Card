import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorBanner, Notice, TextField } from '@/components/ui';
import { publicPost } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import { colors, spacing } from '@/lib/theme';

interface Invite { username: string; name: string; role: string; reset: boolean }
interface Activated { username: string; ticket?: string | null; reset?: boolean }

const MIN_PASSWORD = 8;

/**
 * Activate an account with the invite code the school sent (parents get
 * theirs by SMS), or set a new password with a reset code — the web's
 * /activate page. The server answers with a one-time ticket, so there is no
 * second sign-in afterwards.
 */
export default function ActivateScreen() {
    const router = useRouter();
    const { signIn, setActive, isLoaded } = useSignIn();
    const [code, setCode] = useState('');
    const [invite, setInvite] = useState<Invite | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const check = async () => {
        setBusy(true);
        setError(null);
        try {
            const r = await publicPost<Invite>('/api/auth/activate', { code: code.trim(), verify_only: true });
            setInvite(r);
            setUsername(r.username);
        } catch (err) {
            setError(errorMessage(err, 'That code did not work.'));
        } finally {
            setBusy(false);
        }
    };

    const activate = async () => {
        if (password.length < MIN_PASSWORD) { setError(`Use at least ${MIN_PASSWORD} characters.`); return; }
        if (password !== confirm) { setError('The passwords do not match.'); return; }
        setBusy(true);
        setError(null);
        try {
            const r = await publicPost<Activated>('/api/auth/activate', { code: code.trim(), password, username: username.trim() });
            if (r.ticket && isLoaded && signIn) {
                const result = await signIn.create({ strategy: 'ticket', ticket: r.ticket });
                if (result.status === 'complete') {
                    await setActive?.({ session: result.createdSessionId });
                    return;
                }
            }
            setDone(`${r.reset ? 'Password updated' : 'Account activated'}. Sign in as ${r.username}.`);
        } catch (err) {
            setError(errorMessage(err, 'Activation failed. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <View style={styles.content}>
                        <Text style={styles.title}>Activate your account</Text>
                        <Text style={styles.subtitle}>Enter the invite code from your school. A reset code from your administrator works here too.</Text>
                        {error ? <ErrorBanner message={error} /> : null}
                        {done ? (
                            <>
                                <Notice tone="success" message={done} />
                                <Button label="Go to sign in" onPress={() => router.replace('/(auth)/sign-in')} block />
                            </>
                        ) : !invite ? (
                            <Card>
                                <TextField label="Invite code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" placeholder="e.g. 7KD2QX" />
                                <Button label="Continue" onPress={() => void check()} loading={busy} disabled={!code.trim()} block />
                            </Card>
                        ) : (
                            <Card>
                                <Text style={styles.name}>{invite.name}</Text>
                                <Text style={styles.subtitle}>{roleLabel(invite.role)}{invite.reset ? ' · setting a new password' : ''}</Text>
                                <TextField label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
                                <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder={`At least ${MIN_PASSWORD} characters`} />
                                <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry />
                                <Button label={invite.reset ? 'Set password' : 'Activate'} onPress={() => void activate()} loading={busy} block />
                            </Card>
                        )}
                        <View style={{ marginTop: spacing.lg }}>
                            <Button variant="ghost" label="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} />
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
    content: { width: '100%', maxWidth: 440, alignSelf: 'center' },
    title: { fontSize: 24, fontWeight: '800', color: colors.foreground, textAlign: 'center' },
    subtitle: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
    name: { fontSize: 18, fontWeight: '800', color: colors.foreground, textAlign: 'center' },
});
