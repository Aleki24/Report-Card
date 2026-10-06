import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { UserProvider, useCurrentUser } from '@/lib/UserContext';
import { ToastProvider } from '@/components/Toast';
import { Onboarding } from '@/components/Onboarding';
import { ErrorBanner } from '@/components/ui';
import { BrandLoader } from '@/components/Loader';
import { clearCache } from '@/lib/queryCache';
import { radius, spacing, fonts, makeStyles, useTheme, ThemeProvider } from '@/lib/theme';
import { STAFF_ROLES, isRoleIn } from '@/lib/roles';
import { describeError } from '@/lib/fatalErrorAlert';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Expo inlines EXPO_PUBLIC_* only in app code, not inside node_modules, so
// Clerk cannot read this itself in a release build: pass it explicitly.
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// The families named in `fonts` (lib/theme.tsx); the keys are the family names.
const FONT_FILES = { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold };

const SUPPORTED_ROLES = [...STAFF_ROLES, 'STUDENT', 'PARENT'] as const;

function UnsupportedAccountScreen({ title = 'Account not ready', reason }: { title?: string; reason: string }) {
    const styles = useStyles();
    const { signOut } = useAuth();
    return (
        <View style={styles.centered}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{reason}</Text>
            <Pressable onPress={() => signOut()} style={styles.signOutButton}>
                <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
        </View>
    );
}

/**
 * The one navigator for the whole app, always mounted while it is shown.
 * Protected groups send signed-out users to (auth) and signed-in users away
 * from it; redirecting from a layout that renders no navigator loops forever.
 */
function RootStack({ signedIn }: { signedIn: boolean }) {
    const { colors } = useTheme();
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Protected guard={signedIn}>
                <Stack.Screen name="index" />
                <Stack.Screen name="staff" />
                <Stack.Screen name="student" />
                <Stack.Screen name="parent" />
                <Stack.Screen name="account/delete" options={{ animation: 'slide_from_right' }} />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
                <Stack.Screen name="(auth)" />
            </Stack.Protected>
            {/* Open signed in or out, as on the web: user guides, support and result verification. */}
            <Stack.Screen name="help/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="help/[slug]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="help/contact" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="verify/[studentId]" options={{ animation: 'slide_from_right' }} />
        </Stack>
    );
}

function RoleGate() {
    const styles = useStyles();
    const { loading, error, deactivated, role, needsOnboarding, reload } = useCurrentUser();

    useEffect(() => {
        if (!loading) SplashScreen.hideAsync().catch(() => {});
    }, [loading]);

    if (loading) return <BrandLoader />;

    if (deactivated) {
        return <UnsupportedAccountScreen title="Account deactivated" reason={error ?? 'Your account has been deactivated. Please contact your administrator.'} />;
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <ErrorBanner message={error} onRetry={reload} />
            </View>
        );
    }

    if (needsOnboarding) return <Onboarding />;

    if (!isRoleIn(role, SUPPORTED_ROLES)) {
        return (
            <UnsupportedAccountScreen reason="Your account is pending setup with your school administrator. Once your role is assigned, sign out and back in here." />
        );
    }

    return <RootStack signedIn />;
}

function AuthGate() {
    const { isLoaded, isSignedIn } = useAuth();

    useEffect(() => {
        if (isLoaded) SplashScreen.hideAsync().catch(() => {});
    }, [isLoaded]);

    // Signed out (or never signed in): nothing of an earlier account stays cached on the phone.
    useEffect(() => {
        if (isLoaded && !isSignedIn) void clearCache();
    }, [isLoaded, isSignedIn]);

    if (!isLoaded) return null;

    if (!isSignedIn) return <RootStack signedIn={false} />;

    return (
        <UserProvider>
            <RoleGate />
        </UserProvider>
    );
}

function MissingConfigScreen() {
    const styles = useStyles();
    useEffect(() => {
        SplashScreen.hideAsync().catch(() => {});
    }, []);

    return (
        <View style={styles.centered}>
            <Text style={styles.title}>App not configured</Text>
            <Text style={styles.body}>This build is missing its sign-in key. Please install the latest version of the app.</Text>
        </View>
    );
}

/** Shown instead of closing the app when rendering throws, so the error can be reported. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const styles = useStyles();
    useEffect(() => {
        SplashScreen.hideAsync().catch(() => {});
    }, []);

    return (
        <ScrollView contentContainerStyle={styles.errorScroll}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text selectable style={styles.errorDetail}>{describeError(error)}</Text>
            <Pressable onPress={() => void retry()} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
            </Pressable>
        </ScrollView>
    );
}

function ThemedStatusBar() {
    const { scheme } = useTheme();
    return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} animated />;
}

export default function RootLayout() {
    // A font that fails to load falls back to the system font rather than blocking the app.
    const [fontsLoaded, fontError] = useFonts(FONT_FILES);
    if (!fontsLoaded && !fontError) return null;
    if (!CLERK_PUBLISHABLE_KEY) return <MissingConfigScreen />;

    return (
        <ThemeProvider>
            <KeyboardProvider>
                <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
                    <ThemedStatusBar />
                    <ToastProvider>
                        <AuthGate />
                    </ToastProvider>
                </ClerkProvider>
            </KeyboardProvider>
        </ThemeProvider>
    );
}

const useStyles = makeStyles((colors) => ({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background, gap: spacing.md },
    title: { fontSize: 18, fontFamily: fonts.display, color: colors.foreground },
    body: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center' },
    signOutButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xl, marginTop: spacing.md },
    signOutText: { color: colors.danger, fontFamily: fonts.bold },
    errorScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background, gap: spacing.md },
    errorDetail: { fontSize: 12, color: colors.foreground, fontFamily: 'monospace' },
    retryButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xl },
    retryText: { color: colors.white, fontFamily: fonts.bold },
}));
