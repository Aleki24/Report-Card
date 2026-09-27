import type { Metadata } from 'next';
import { HelpShell } from '@/components/manual/HelpShell';
import { GuidePicker } from '@/components/manual/GuidePicker';

export const metadata: Metadata = {
    title: 'User guides · Skulbase',
    description: 'Illustrated step-by-step guides for administrators, teachers, staff, learners and parents.',
};

/** Every user guide, public so it can be read before signing in or while setting up. */
export default function HelpIndexPage() {
    return (
        <HelpShell>
            <div className="mx-auto max-w-4xl">
                <p className="text-xs font-semibold tracking-widest text-primary uppercase">Help</p>
                <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">User guides</h1>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                    Step-by-step guides with pictures of every screen. Read one online, or download the PDF to keep, print or share.
                </p>
                <div className="mt-8"><GuidePicker /></div>
            </div>
        </HelpShell>
    );
}
