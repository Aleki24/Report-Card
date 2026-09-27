"use client";

import { useAuth } from '@/components/AuthProvider';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ManualView } from '@/components/manual/ManualView';
import { MANUALS, MANUAL_SLUGS, manualForRole, type ManualSlug } from '@/lib/manual';

/** Guides each role may also want: admins see every guide; teachers the other teaching one. */
const RELATED: Record<ManualSlug, readonly ManualSlug[]> = {
    admin: MANUAL_SLUGS.filter(s => s !== 'admin'),
    'class-teacher': ['subject-teacher', 'student'],
    'subject-teacher': ['class-teacher', 'student'],
    staff: [],
    student: [],
};

/** The in-app Help page: the signed-in user's own guide, inside the app shell. */
export function RoleManual() {
    const { role, loading } = useAuth();
    if (loading || !role) return <ContentSkeleton />;
    const slug = manualForRole(role);
    return <ManualView manual={MANUALS[slug]} otherGuides={RELATED[slug]} />;
}
