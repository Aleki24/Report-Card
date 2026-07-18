import React from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import DashboardContent from '@/components/layout/DashboardContent';

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <DashboardContent>{children}</DashboardContent>
        </AuthProvider>
    );
}
