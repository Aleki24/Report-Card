import { Stack } from 'expo-router';

// Signed-in users are kept out of this group by the root layout's Stack.Protected.
export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="activate" />
        </Stack>
    );
}
