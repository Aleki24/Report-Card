import { Redirect } from 'expo-router';
import { useCurrentUser } from '@/lib/UserContext';
import { LoadingView } from '@/components/ui';

export default function RootIndex() {
    const { role, loading } = useCurrentUser();

    if (loading) return <LoadingView />;

    if (role === 'STUDENT') return <Redirect href="/student" />;
    if (role === 'ADMIN' || role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER') return <Redirect href="/staff" />;

    // RoleGate in the root layout already handles PENDING/unsupported roles
    // before this ever renders; this is just a safe fallback.
    return <LoadingView />;
}
