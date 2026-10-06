import React from 'react';
import { useCurrentUser } from '@/lib/UserContext';
import { AdminHome } from '@/components/dashboard/AdminHome';
import { TeacherHome } from '@/components/dashboard/TeacherHome';
import { StaffHome } from '@/components/dashboard/StaffHome';

/** The staff home: the web dashboard for this person's role. */
export default function StaffDashboardScreen() {
    const { role, profile } = useCurrentUser();
    const firstName = profile?.first_name ?? '';
    if (role === 'STAFF') return <StaffHome name={firstName} jobTitle={profile?.job_title ?? null} />;
    if (role === 'ADMIN') return <AdminHome name={firstName} />;
    return <TeacherHome name={firstName} variant={role === 'CLASS_TEACHER' ? 'class' : 'subject'} />;
}
