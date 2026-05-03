import React from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import DashboardContent from '@/components/layout/DashboardContent';

export default function DashboardLayout({
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
