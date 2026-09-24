import { Redirect } from 'expo-router';
import { useCurrentUser } from '@/lib/UserContext';
import { LoadingView } from '@/components/ui';
import { STAFF_ROLES, isRoleIn } from '@/lib/roles';

export default function RootIndex() {
    const { role, loading } = useCurrentUser();

    if (loading) return <LoadingView />;

    if (role === 'STUDENT') return <Redirect href="/student" />;
    if (isRoleIn(role, STAFF_ROLES)) return <Redirect href="/staff" />;

    // RoleGate in the root layout already handles PENDING/unsupported roles
    // before this ever renders; this is just a safe fallback.
    return <LoadingView />;
}
