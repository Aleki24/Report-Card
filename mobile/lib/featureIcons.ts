import {
    BedDouble, BookOpen, Bus, CalendarCheck, CalendarClock, CalendarDays, ChartLine, CircleUserRound, ClipboardList,
    FileLock2, FileText, GraduationCap, HandCoins, HeartHandshake, HeartPulse, LayoutDashboard, Library, LifeBuoy,
    Megaphone, NotebookText, Package, PencilRuler, ReceiptText, School, Settings, ShieldAlert, Target, TreePalm,
    Trophy, UserCog, Users, Wallet, type LucideIcon,
} from 'lucide-react-native';

/**
 * One icon per feature, the same as the web's FEATURE_ICONS
 * (src/components/ui/featureIcons.ts): the tab bar, More, each screen's
 * header, dashboard tiles and quick actions. Keep the two lists in step, and
 * pick from here instead of importing an icon for a feature directly.
 */
export const FEATURE_ICONS = {
    dashboard: LayoutDashboard,
    // Academics
    examsMarks: ClipboardList,
    reports: FileText,
    results: Trophy,
    attendance: CalendarCheck,
    analytics: ChartLine,
    calendar: CalendarDays,
    timetable: CalendarClock,
    examPapers: FileLock2,
    lessonRecords: NotebookText,
    assignments: PencilRuler,
    cbc: Target,
    subjects: BookOpen,
    classes: School,
    // People
    people: Users,
    teachers: GraduationCap,
    parents: HeartHandshake,
    users: UserCog,
    profile: CircleUserRound,
    // Money
    fees: HandCoins,
    billing: ReceiptText,
    expenses: Wallet,
    // School life
    announcements: Megaphone,
    boarding: BedDouble,
    health: HeartPulse,
    discipline: ShieldAlert,
    transport: Bus,
    library: Library,
    inventory: Package,
    leave: TreePalm,
    // Account
    settings: Settings,
    help: LifeBuoy,
} as const satisfies Record<string, LucideIcon>;

export type FeatureKey = keyof typeof FEATURE_ICONS;
