import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HelpShell } from '@/components/manual/HelpShell';
import { ManualView } from '@/components/manual/ManualView';
import { MANUALS, MANUAL_SLUGS, isManualSlug } from '@/lib/manual';

export const dynamicParams = false;

export function generateStaticParams() {
    return MANUAL_SLUGS.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    if (!isManualSlug(slug)) return {};
    const manual = MANUALS[slug];
    return { title: `${manual.title} · Skulbase`, description: manual.summary };
}

/** One user guide, public. Printing this page is how the downloadable PDF is made. */
export default async function HelpGuidePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    if (!isManualSlug(slug)) notFound();
    return (
        <HelpShell>
            <ManualView manual={MANUALS[slug]} otherGuides={MANUAL_SLUGS.filter(s => s !== slug)} />
        </HelpShell>
    );
}
