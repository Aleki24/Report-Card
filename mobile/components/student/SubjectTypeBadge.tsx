import React from 'react';
import { Badge } from '@/components/ui';
import type { Subject } from '@/lib/types';

/** Core / Essential / Optional, shared by the subject list and detail screens. */
export function SubjectTypeBadge({ type }: { type: Subject['subject_type'] }) {
    if (type === 'CORE') return <Badge label="Core" variant="success" />;
    if (type === 'ESSENTIAL') return <Badge label="Essential" variant="info" />;
    return <Badge label="Optional" />;
}
