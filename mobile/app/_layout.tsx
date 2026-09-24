import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Redirect, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { UserProvider, useCurrentUser } from '@/lib/UserContext';
import { ErrorBanner, LoadingView } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import { STAFF_ROLES, isRoleIn } from '@/lib/roles';

SplashScreen.preventAutoHideAsync().catch(() => {});

const SUPPORTED_ROLES = [...STAFF_ROLES, 'STUDENT'] as const;

function UnsupportedAccountScreen({ title = 'Account not ready', reason }: { title?: string; reason: string }) {
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

function RoleGate() {
    const { loading, error, deactivated, role, reload } = useCurrentUser();

    useEffect(() => {
        if (!loading) SplashScreen.hideAsync().catch(() => {});
    }, [loading]);

    if (loading) return <LoadingView />;

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

    if (!isRoleIn(role, SUPPORTED_ROLES)) {
        return (
            <UnsupportedAccountScreen reason="Your account is pending setup with your school administrator. Once your role is assigned, sign out and back in here." />
        );
    }

    return <Slot />;
}

function AuthGate() {
    const { isLoaded } = useAuth();

    useEffect(() => {
        if (isLoaded) SplashScreen.hideAsync().catch(() => {});
    }, [isLoaded]);

    if (!isLoaded) return null;

    return (
        <>
            <SignedIn>
                <UserProvider>
                    <RoleGate />
                </UserProvider>
            </SignedIn>
            <SignedOut>
                <Redirect href="/(auth)/sign-in" />
            </SignedOut>
        </>
    );
}

export default function RootLayout() {
    return (
        <ClerkProvider tokenCache={tokenCache}>
            <StatusBar style="dark" />
            <AuthGate />
        </ClerkProvider>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background, gap: spacing.md },
    title: { fontSize: 18, fontWeight: '800', color: colors.foreground },
    body: { fontSize: 13, color: colors.muted, textAlign: 'center' },
    signOutButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xl, marginTop: spacing.md },
    signOutText: { color: colors.danger, fontWeight: '700' },
});
