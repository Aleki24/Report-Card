import type { Metadata } from 'next';
import { HelpShell } from '@/components/manual/HelpShell';
import { GuidePicker } from '@/components/manual/GuidePicker';
import { DUTY_MANUAL_SLUGS, ROLE_MANUAL_SLUGS } from '@/lib/manual';

export const metadata: Metadata = {
    title: 'User guides · Skulbase',
    description: 'Illustrated step-by-step guides for administrators, teachers, staff, learners and parents, and for every duty from bursar to driver.',
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
                <h2 className="mt-10 font-display text-lg font-bold text-foreground">By account</h2>
                <p className="mt-1 text-sm text-muted-foreground">Start with the guide for the kind of account you have.</p>
                <div className="mt-4"><GuidePicker slugs={ROLE_MANUAL_SLUGS} /></div>
                <h2 className="mt-12 font-display text-lg font-bold text-foreground">By duty</h2>
                <p className="mt-1 text-sm text-muted-foreground">If your school has given you a duty, such as bursar, matron or DOS, read its guide as well.</p>
                <div className="mt-4"><GuidePicker slugs={DUTY_MANUAL_SLUGS} /></div>
            </div>
        </HelpShell>
    );
}
