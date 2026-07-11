"use client";

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface SetupNotifierProps {
  hasLogo: boolean;
  totalTeachers: number;
  totalStudents: number;
  totalUsers: number;
  role: string | null;
}

export function SetupNotifier({ hasLogo, totalTeachers, totalStudents, totalUsers, role }: SetupNotifierProps) {
  const router = useRouter();
  const hasNotified = useRef(false);

  useEffect(() => {
    // Only show to admins and only once per mount
    if (role !== 'ADMIN' || hasNotified.current) return;
    
    // Slight delay so it appears nicely after dashboard loads
    const timer = setTimeout(() => {
      let triggered = false;

      if (!hasLogo) {
        toast('Action Required: Upload School Logo', {
          description: 'Your school logo is missing from reports.',
          action: {
            label: 'Settings',
            onClick: () => router.push('/dashboard/settings'),
          },
          duration: 8000,
          id: 'setup-logo'
        });
        triggered = true;
      }

      if (totalTeachers === 0) {
        toast('Next Step: Add Teachers', {
          description: 'Your school currently has no teachers.',
          action: {
            label: 'Add Teachers',
            onClick: () => router.push('/dashboard/people?tab=teachers'),
          },
          duration: 10000,
          id: 'setup-teachers'
        });
        triggered = true;
      } else if (totalUsers <= totalTeachers + 1) {
        toast('Next Step: Add Other Users', {
          description: 'Add support staff, administrators, and other users.',
          action: {
            label: 'Add Users',
            onClick: () => router.push('/dashboard/users'),
          },
          duration: 10000,
          id: 'setup-users'
        });
        triggered = true;
      } else if (totalStudents === 0) {
        toast('Next Step: Enroll Students', {
          description: 'Ready to bring in the students?',
          action: {
            label: 'Add Students',
            onClick: () => router.push('/dashboard/people'),
          },
          duration: 10000,
          id: 'setup-students'
        });
        triggered = true;
      }

      if (triggered) {
        hasNotified.current = true;
      } else {
        // Everything is done
        toast.success('🎉 Setup Complete!', {
          description: 'Your school configuration is fully complete. Great job!',
          duration: 5000,
          id: 'setup-complete'
        });
        hasNotified.current = true;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [hasLogo, totalTeachers, totalStudents, totalUsers, role, router]);

  return null; // This component doesn't render any visible DOM on its own
}
