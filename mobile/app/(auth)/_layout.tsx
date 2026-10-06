import { Stack } from 'expo-router';

// Signed-in users are kept out of this group by the root layout's Stack.Protected.
export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="activate" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="sso-callback" options={{ animation: 'fade' }} />
        </Stack>
    );
}
