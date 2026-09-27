import type { LucideIcon } from 'lucide-react';
import {
    BedDouble, Bus, CalendarDays, Clock, FileLock2, HeartHandshake, HeartPulse, Library,
    MapPin, NotebookPen, Package, Plane, Receipt, ShieldAlert, Target, Wallet,
} from 'lucide-react';
import { MODULE_LIST, type ModuleKey } from '@/lib/platform/modules';

/** Icons for the modules a school switches on as it needs them. */
const ICONS: Partial<Record<ModuleKey, LucideIcon>> = {
    calendar: CalendarDays,
    exam_papers: FileLock2,
    timetable: Clock,
    lesson_records: NotebookPen,
    cbc_assessment: Target,
    fee_structures: Receipt,
    expenses: Wallet,
    boarding: BedDouble,
    health: HeartPulse,
    discipline: ShieldAlert,
    transport: Bus,
    transport_tracking: MapPin,
    library: Library,
    inventory: Package,
    parent_portal: HeartHandshake,
    staff_hr: Plane,
};

export interface OptionalModuleCard { key: ModuleKey; title: string; description: string; icon: LucideIcon }

/** Modules off by default: the marketing site lists them as "switch on what you need". */
export const OPTIONAL_MODULES: readonly OptionalModuleCard[] = MODULE_LIST
    .filter(m => !m.defaultEnabled)
    .map(m => ({ key: m.key, title: m.name, description: m.description, icon: ICONS[m.key] ?? Package }));
