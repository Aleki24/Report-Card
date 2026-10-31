import { ArrowUpRight, GraduationCap, LogOut, Repeat2, Route, type LucideIcon } from 'lucide-react';
import type { PromotionOutcome, StepTone } from '@/lib/promotion';

/** The web's icon for each outcome; wording and colour come from `OUTCOME_COPY`. */
export const OUTCOME_ICONS: Record<PromotionOutcome, LucideIcon> = {
    PROMOTE: ArrowUpRight,
    GRADUATE: GraduationCap,
    REPEAT: Repeat2,
    TRANSFER: LogOut,
};

/** The web's icon for each kind of grade card; wording and colour come from `stepCopy`. */
export const STEP_ICONS: Record<StepTone, LucideIcon> = {
    MOVES_UP: ArrowUpRight,
    DECIDE: Route,
    LEAVES: GraduationCap,
};
