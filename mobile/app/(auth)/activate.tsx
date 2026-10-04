import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, CircleCheck, KeyRound } from 'lucide-react-native';
import { extractInviteCode, INVITE_CODE_LENGTH } from '@shared/activation-link';
import { ApiError, publicPost } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import { fonts, radius, spacing, makeStyles, useTheme } from '@/lib/theme';
import { useGoogleSignIn } from '@/lib/useGoogleSignIn';
import { setPendingInviteCode } from '@/lib/pendingInvite';
import {
    AuthDivider, AuthError, AuthField, AuthFootnote, AuthLink, AuthPrimaryButton, AuthShell, AuthStack, GoogleButton,
} from '@/components/auth/AuthShell';

const MIN_PASSWORD_LENGTH = 8;
const MIN_USERNAME_LENGTH = 3;
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

/** What /api/auth/activate says about a valid code (verify_only). */
interface InviteDetails {
    name: string;
    role: string | null;
    username: string;
    /** The code resets an existing account's password rather than creating one. */
    reset: boolean;
}

interface ActivateResponse {
    ticket?: string | null;
}

type Stage = 'code' | 'details' | 'done';

/** Why the chosen username can't be used yet, or null. */
function usernameProblem(username: string): string | null {
    if (username.length < MIN_USERNAME_LENGTH) return `Username must be at least ${MIN_USERNAME_LENGTH} characters.`;
    if (!USERNAME_PATTERN.test(username)) return 'Username can only contain letters, numbers, dots, dashes and underscores.';
    return null;
}

function initials(name: string): string {
    return name.split(' ').map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();
}

/**
 * The web's /activate: redeem an invite (or admin password-reset) code, then
 * confirm who you are and choose a username and password — or Google — and
 * land signed in. skulbase://activate?code=A7X3K9 skips typing the code.
 */
export default function ActivateScreen() {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const params = useLocalSearchParams<{ code?: string }>();
    const { isLoaded, signIn, setActive } = useSignIn();
    const google = useGoogleSignIn();

    const [stage, setStage] = useState<Stage>('code');
    const [code, setCode] = useState('');
    const [invite, setInvite] = useState<InviteDetails | null>(null);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [doneMessage, setDoneMessage] = useState('');

    const verifyCode = useCallback(async (value: string) => {
        if (value.length !== INVITE_CODE_LENGTH) return;
        setError(null);
        setVerifying(true);
        try {
            const data = await publicPost<{ name?: string; role?: string; username?: string; reset?: boolean }>('/api/auth/activate', { code: value, verify_only: true });
            setInvite({ name: data.name?.trim() || '', role: data.role ?? null, username: data.username || '', reset: !!data.reset });
            setUsername(data.username || '');
            setStage('details');
        } catch (err) {
            setError(errorMessage(err, 'That invite code wasn’t recognised.'));
        } finally {
            setVerifying(false);
        }
    }, []);

    // An activation link fills the code in and checks it on arrival.
    const linkChecked = useRef(false);
    useEffect(() => {
        if (linkChecked.current || !params.code) return;
        linkChecked.current = true;
        const fromLink = extractInviteCode(params.code);
        setCode(fromLink);
        void verifyCode(fromLink);
    }, [params.code, verifyCode]);

    const handleCodeChange = (raw: string) => {
        const next = extractInviteCode(raw);
        setCode(next);
        setError(null);
        // Typing or pasting the last character checks it — no extra tap needed.
        if (next.length === INVITE_CODE_LENGTH && next !== code) void verifyCode(next);
    };

    const startOver = () => {
        setStage('code');
        setInvite(null);
        setCode('');
        setPassword('');
        setEmail('');
        setError(null);
    };

    const handleGoogle = () => {
        // Onboarding joins the school with this code once Google has signed the person in.
        setPendingInviteCode(code);
        void google.start().then(() => setPendingInviteCode(null), () => setPendingInviteCode(null));
    };

    /** Signs in with the username and password just chosen; false if that fails. */
    const signInWithPassword = async (): Promise<boolean> => {
        if (!isLoaded || !signIn) return false;
        try {
            const result = await signIn.create({ identifier: username, password });
            if (result.status !== 'complete') return false;
            await setActive?.({ session: result.createdSessionId });
            return true;
        } catch {
            return false;
        }
    };

    const submit = async () => {
        const problem = usernameProblem(username)
            ?? (password.length < MIN_PASSWORD_LENGTH ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` : null);
        if (problem) { setError(problem); return; }
        setError(null);
        setSubmitting(true);
        let data: ActivateResponse;
        try {
            data = await publicPost<ActivateResponse>('/api/auth/activate', { code, username, password, email: email.trim() || undefined });
        } catch (err) {
            // A dropped connection can lose the answer to an activation that
            // went through; the retry then finds the code used. The account
            // exists with what was just chosen, so sign in with it.
            if (err instanceof ApiError && /already been used/i.test(err.message) && (await signInWithPassword())) {
                setDoneMessage('Your account is ready.');
                setStage('done');
                setSubmitting(false);
                return;
            }
            setError(errorMessage(err, 'Activation failed. Please try again.'));
            setSubmitting(false);
            return;
        }
        setDoneMessage(invite?.reset ? 'Your password has been updated.' : 'Your account is ready.');
        setStage('done');
        setSubmitting(false);
        // The server issues a one-time ticket, so there's no second login. If it
        // can't be used, the done screen's "Go to sign in" is the way on.
        if (!data.ticket || !isLoaded || !signIn) return;
        try {
            const result = await signIn.create({ strategy: 'ticket', ticket: data.ticket });
            if (result.status === 'complete') await setActive?.({ session: result.createdSessionId });
        } catch {
            // Fall back to signing in by hand.
        }
    };

    const firstName = invite?.name.split(' ')[0] || '';
    const title = stage === 'code' ? 'Activate your account'
        : stage === 'done' ? 'You’re all set'
        : invite?.reset ? 'Reset your password'
        : firstName ? `Welcome, ${firstName}!` : 'Welcome!';
    const subtitle = stage === 'code' ? 'Enter the invite code from your school to get started.'
        : stage === 'done' ? doneMessage
        : invite?.reset ? 'Choose a new password for your account.'
        : 'Choose how you’ll sign in. It takes less than a minute.';

    return (
        <AuthShell
            title={title}
            subtitle={subtitle}
            footer={stage === 'done' ? null : (
                <>
                    <AuthFootnote>Already activated? <AuthLink label="Sign in" onPress={() => router.replace('/(auth)/sign-in')} /></AuthFootnote>
                    {!invite?.reset ? (
                        <AuthFootnote>Setting up a new school? <AuthLink label="Create an account" onPress={() => router.replace('/(auth)/sign-up')} /></AuthFootnote>
                    ) : null}
                    <AuthFootnote>Need help? <AuthLink label="Read the user guides" onPress={() => router.push('/help')} /></AuthFootnote>
                </>
            )}
        >
            {stage === 'code' ? (
                <AuthStack>
                    <AuthError message={error} />
                    <AuthField
                        label="Invite code"
                        value={code}
                        onChangeText={handleCodeChange}
                        placeholder="A7X3K9"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        autoComplete="one-time-code"
                        autoFocus
                        editable={!verifying}
                        invalid={error !== null}
                        hint="6 letters and numbers from your school. You can also paste the link you were sent."
                    />
                    <AuthPrimaryButton
                        label={verifying ? 'Checking your code…' : 'Continue'}
                        icon={ArrowRight}
                        onPress={() => void verifyCode(code)}
                        loading={verifying}
                        disabled={code.length !== INVITE_CODE_LENGTH}
                    />
                    <AuthFootnote>No code yet? Ask your school administrator. They can send it to you as a link.</AuthFootnote>
                </AuthStack>
            ) : null}

            {stage === 'details' && invite ? (
                <AuthStack>
                    <View style={styles.inviteCard}>
                        <View style={styles.avatar}>
                            {initials(invite.name) ? <Text style={styles.avatarText}>{initials(invite.name)}</Text> : <KeyRound size={20} color={colors.white} />}
                        </View>
                        <View style={styles.inviteBody}>
                            <Text style={styles.inviteName} numberOfLines={1}>{invite.name || 'Your account'}</Text>
                            <Text style={styles.inviteMeta} numberOfLines={1}>
                                {invite.role ? `${roleLabel(invite.role)} · ` : ''}
                                <Text style={styles.inviteCode}>{code}</Text>
                            </Text>
                        </View>
                        <AuthLink label="Not you?" onPress={startOver} />
                    </View>

                    <AuthError message={error ?? google.error} />

                    <AuthField
                        label="Username"
                        value={username}
                        onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))}
                        placeholder="Choose a username"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username"
                        textContentType="username"
                        editable={!submitting}
                        hint={
                            <>
                                You’ll use this to sign in.
                                {invite.username && username !== invite.username ? (
                                    <> Suggested: <AuthLink label={invite.username} onPress={() => setUsername(invite.username)} /></>
                                ) : null}
                            </>
                        }
                    />
                    <AuthField
                        label={invite.reset ? 'New password' : 'Password'}
                        password
                        value={password}
                        onChangeText={setPassword}
                        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                        autoComplete="new-password"
                        textContentType="newPassword"
                        editable={!submitting}
                        hint={
                            <Text style={password.length >= MIN_PASSWORD_LENGTH ? styles.passwordOk : undefined}>
                                {password.length >= MIN_PASSWORD_LENGTH ? '✓ ' : ''}At least {MIN_PASSWORD_LENGTH} characters
                            </Text>
                        }
                    />
                    {!invite.reset ? (
                        <AuthField
                            label={<>Email <Text style={styles.optional}>(optional)</Text></>}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="you@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            editable={!submitting}
                            hint="Lets you reset your password yourself if you forget it."
                        />
                    ) : null}
                    <AuthPrimaryButton
                        label={submitting ? (invite.reset ? 'Updating…' : 'Activating…') : invite.reset ? 'Update password & sign in' : 'Activate & sign in'}
                        onPress={() => void submit()}
                        loading={submitting}
                        disabled={google.loading}
                    />
                    {!invite.reset ? (
                        <>
                            <AuthDivider label="or" />
                            <GoogleButton onPress={handleGoogle} loading={google.loading} disabled={submitting} />
                        </>
                    ) : null}
                </AuthStack>
            ) : null}

            {stage === 'done' ? (
                <AuthStack>
                    <View style={styles.doneIcon}>
                        <CircleCheck size={28} color={colors.success} />
                    </View>
                    <AuthFootnote>
                        Signing you in… If nothing happens, sign in with your username <Text style={styles.inviteCode}>{username}</Text> and the password you just chose.
                    </AuthFootnote>
                    <AuthPrimaryButton label="Go to sign in" icon={ArrowRight} onPress={() => router.replace('/(auth)/sign-in')} />
                </AuthStack>
            ) : null}
        </AuthShell>
    );
}

const useStyles = makeStyles((colors) => ({
    inviteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: 'rgba(99,102,241,0.15)',
        backgroundColor: 'rgba(99,102,241,0.05)',
        padding: spacing.md,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.auth.accent, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.white, fontSize: 14, fontFamily: fonts.bold },
    inviteBody: { flex: 1, minWidth: 0 },
    inviteName: { fontSize: 14, fontFamily: fonts.semibold, color: colors.auth.heading },
    inviteMeta: { fontSize: 12, fontFamily: fonts.regular, color: colors.auth.body, marginTop: 2 },
    inviteCode: { fontFamily: fonts.semibold, letterSpacing: 1, color: colors.auth.label },
    passwordOk: { color: colors.success },
    optional: { fontFamily: fonts.regular, color: colors.auth.faint },
    doneIcon: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
}));
