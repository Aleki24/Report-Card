import { SignedIn } from '@clerk/clerk-expo';
import { Redirect, Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <>
            <SignedIn>
                <Redirect href="/(tabs)" />
            </SignedIn>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="sign-in" />
            </Stack>
        </>
    );
}
