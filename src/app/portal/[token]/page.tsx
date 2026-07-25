import type { Metadata } from 'next';
import { lookupPortalStudent } from '@/lib/student/portal-access';
import { PortalWelcome } from '@/components/student/PortalWelcome';
import { PortalNotFound } from '@/components/student/PortalNotFound';

// The token is a bearer credential, so this page must never be cached or
// prerendered — and search engines have no business indexing it.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Your student portal — Skulbase',
    robots: { index: false, follow: false },
};

/**
 * Landing page for the QR code printed on a learner's report card.
 *
 * Public by design: the whole point is that a learner who has never logged in
 * can scan the code and reach their own sign-up screen. It sits outside the
 * `/dashboard` and `/student` matchers in middleware.ts for that reason.
 */
export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const student = await lookupPortalStudent(token);

    if (!student) {
        return <PortalNotFound />;
    }

    return (
        <PortalWelcome
            token={token}
            firstName={student.firstName}
            fullName={student.fullName}
            schoolName={student.schoolName}
            admissionNumber={student.admissionNumber}
            suggestedUsername={student.username ?? ''}
            isClaimed={student.isClaimed}
        />
    );
}
