import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Redirect, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGate() {
    const { isLoaded } = useAuth();

    useEffect(() => {
        if (isLoaded) SplashScreen.hideAsync().catch(() => {});
    }, [isLoaded]);

    if (!isLoaded) return null;

    return (
        <>
            <SignedIn>
                <Slot />
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
