import type { LucideIcon } from 'lucide-react';
import { MapPin, Package } from 'lucide-react';
import { FEATURE_ICONS as I } from '@/components/ui/featureIcons';
import { MODULE_LIST, type ModuleKey } from '@/lib/platform/modules';

/** Icons for the modules a school switches on as it needs them. */
const ICONS: Partial<Record<ModuleKey, LucideIcon>> = {
    calendar: I.calendar,
    exam_papers: I.examPapers,
    timetable: I.timetable,
    lesson_records: I.lessonRecords,
    cbc_assessment: I.cbc,
    fee_structures: I.billing,
    expenses: I.expenses,
    boarding: I.boarding,
    health: I.health,
    discipline: I.discipline,
    transport: I.transport,
    transport_tracking: MapPin,
    library: I.library,
    inventory: I.inventory,
    parent_portal: I.parents,
    staff_hr: I.leave,
};

export interface OptionalModuleCard { key: ModuleKey; title: string; description: string; icon: LucideIcon }

/** Modules off by default: the marketing site lists them as "switch on what you need". */
export const OPTIONAL_MODULES: readonly OptionalModuleCard[] = MODULE_LIST
    .filter(m => !m.defaultEnabled)
    .map(m => ({ key: m.key, title: m.name, description: m.description, icon: ICONS[m.key] ?? Package }));
