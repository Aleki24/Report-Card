import {
  BedDouble, BookOpen, Bus, CalendarCheck, CalendarClock, CalendarDays, ChartLine, CircleUserRound, ClipboardList,
  FileLock2, FileText, GraduationCap, HandCoins, HeartHandshake, HeartPulse, LayoutDashboard, Library, LifeBuoy,
  Megaphone, NotebookText, Package, PencilRuler, ReceiptText, School, Settings, ShieldAlert, Target, TreePalm,
  Trophy, UserCog, Users, Wallet, type LucideIcon,
} from 'lucide-react';

/**
 * One icon per feature, wherever the feature appears: the sidebar, its page
 * header, dashboard tiles and quick actions, and the marketing site. Fees used
 * to be a dollar sign in the menu, a wallet on its page and a credit card on
 * the homepage, while the wallet also meant Expenses; announcements were a
 * bell, a chat bubble and a megaphone. Pick from here instead of importing an
 * icon for a feature directly.
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
