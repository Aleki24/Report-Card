import React from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import StudentPortalContent from '@/components/student/StudentPortalContent';

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <StudentPortalContent>{children}</StudentPortalContent>
        </AuthProvider>
    );
}
