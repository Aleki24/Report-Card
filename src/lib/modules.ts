import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  Users,
  GraduationCap,
  School,
  BookOpen,
  ClipboardList,
  CalendarCheck,
  Heart,
  LineChart,
  Settings,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────
export type ModuleStatus = 'active' | 'coming-soon';
export type AudienceRole = 'admin' | 'teacher' | 'parent' | 'student';

export interface Module {
  title: string;
  shortTitle: string;
  slug: string;
  description: string;
  longDescription: string;
  icon: LucideIcon;
  featureHref: string;
  dashboardHref: string;
  status: ModuleStatus;
  audience: AudienceRole[];
  features: string[];
  workflow: string[];
  benefits: string[];
}

export interface ComingSoonModule {
  title: string;
  slug: string;
  description: string;
  icon: LucideIcon;
  status: 'coming-soon';
}

// ── Phase One Modules (Active) ───────────────────────────────
export const modules: Module[] = [
  {
    title: 'Report Cards',
    shortTitle: 'Reports',
    slug: 'report-cards',
    description:
      'Generate professional report cards with marks, grades, comments, attendance, and PDF export.',
    longDescription:
      'The Report Cards module helps schools create accurate, branded, and downloadable academic reports for every learner. From bulk generation to individual customization, streamline your end-of-term reporting workflow.',
    icon: FileText,
    featureHref: '/features/report-cards',
    dashboardHref: '/dashboard/reports',
    status: 'active',
    audience: ['admin', 'teacher'],
    features: [
      'Professional report card generation',
      'Teacher and principal comments',
      'PDF download and printing',
      'Bulk report generation',
      'CBC, KCSE, Cambridge, and custom grading support',
      'School logo and identity branding',
      'Attendance summary per student',
      'Ranking and position calculation',
    ],
    workflow: [
      'Set up classes, subjects, academic year, and term',
      'Enter student marks through the marks module',
      'Review grades, rankings, and comments',
      'Generate report cards individually or in bulk',
      'Download or print PDF reports for distribution',
    ],
    benefits: [
      'Saves teachers hours of manual report writing',
      'Reduces calculation and grading errors',
      'Improves parent communication with professional reports',
      'Keeps academic records organized and accessible',
    ],
  },
  {
    title: 'Student Management',
    shortTitle: 'Students',
    slug: 'students',
    description:
      'Manage student biodata, admissions, class assignments, and academic history in one place.',
    longDescription:
      'The Student Management module centralizes all student information — from enrollment and biodata to class assignments and academic records. Track every learner\'s journey through your school.',
    icon: Users,
    featureHref: '/features/students',
    dashboardHref: '/dashboard/people',
    status: 'active',
    audience: ['admin', 'teacher'],
    features: [
      'Complete student biodata profiles',
      'Unique admission number tracking',
      'Class and stream assignment',
      'Parent and guardian contact linking',
      'Academic history and report archive',
      'Student status management (active, transferred, graduated)',
      'Bulk student import via CSV',
      'Student search and filtering',
    ],
    workflow: [
      'Add students individually or import via CSV',
      'Assign each student to a class and stream',
      'Link parent or guardian contacts',
      'Track enrollment status and academic progress',
      'Access complete student records at any time',
    ],
    benefits: [
      'Eliminates paper-based student records',
      'Instant access to any student\'s information',
      'Simplifies class assignments and transfers',
      'Maintains accurate enrollment statistics',
    ],
  },
  {
    title: 'Teacher Management',
    shortTitle: 'Teachers',
    slug: 'teachers',
    description:
      'Manage teacher profiles, assign subjects and classes, and track teacher roles across the school.',
    longDescription:
      'The Teacher Management module helps administrators organize their teaching staff efficiently. Assign subjects, designate class teachers, and maintain comprehensive teacher profiles.',
    icon: GraduationCap,
    featureHref: '/features/teachers',
    dashboardHref: '/dashboard/people?tab=teachers',
    status: 'active',
    audience: ['admin'],
    features: [
      'Complete teacher profile management',
      'Subject assignment to teachers',
      'Class teacher designation',
      'Role-based access (Class Teacher / Subject Teacher)',
      'Teacher workload overview',
      'Contact information management',
      'Teaching history tracking',
      'Invitation and onboarding workflow',
    ],
    workflow: [
      'Add teacher profiles with contact details',
      'Assign each teacher their subjects',
      'Designate class teachers to specific streams',
      'Teachers log in to access their assigned modules',
      'Monitor teacher activity and marks entry progress',
    ],
    benefits: [
      'Clear visibility of teacher assignments',
      'Streamlined subject and class allocation',
      'Reduces administrative overhead',
      'Enables role-specific dashboard access',
    ],
  },
  {
    title: 'Classes & Streams',
    shortTitle: 'Classes',
    slug: 'classes',
    description:
      'Organize your school into academic levels, classes, and streams with teacher and student assignments.',
    longDescription:
      'The Classes & Streams module provides the organizational backbone of your school. Define academic levels, create classes and streams, assign class teachers, and enroll students into their respective groups.',
    icon: School,
    featureHref: '/features/classes',
    dashboardHref: '/dashboard/classes',
    status: 'active',
    audience: ['admin'],
    features: [
      'Academic level management (Primary, Secondary, etc.)',
      'Class and stream creation',
      'Class teacher assignment per stream',
      'Student enrollment per stream',
      'Multi-stream support per class',
      'Class capacity tracking',
      'Academic year and term alignment',
      'Class performance overview',
    ],
    workflow: [
      'Define academic levels for your school',
      'Create classes (e.g., Form 1, Grade 4)',
      'Add streams within each class (e.g., North, South)',
      'Assign a class teacher to each stream',
      'Enroll students into their respective streams',
    ],
    benefits: [
      'Flexible structure for any school type',
      'Clear organizational hierarchy',
      'Easy student and teacher allocation',
      'Foundation for exams, reports, and analytics',
    ],
  },
  {
    title: 'Subjects',
    shortTitle: 'Subjects',
    slug: 'subjects',
    description:
      'Manage subjects, assign them to classes and teachers, and support multiple curriculum frameworks.',
    longDescription:
      'The Subjects module lets you define and organize all subjects offered at your school. Assign subjects to specific academic levels, link them to teachers, and support CBC, 8-4-4, Cambridge, and custom curricula.',
    icon: BookOpen,
    featureHref: '/features/subjects',
    dashboardHref: '/dashboard/subjects',
    status: 'active',
    audience: ['admin'],
    features: [
      'Complete subject catalog management',
      'Curriculum framework support (CBC, KCSE, Cambridge)',
      'Subject categorization (Language, Science, Humanity, etc.)',
      'Compulsory and optional subject designation',
      'Subject-to-class assignment',
      'Subject teacher linking',
      'Display order customization',
      'Subject code management',
    ],
    workflow: [
      'Add subjects with code, name, and category',
      'Assign subjects to academic levels',
      'Mark subjects as compulsory or optional',
      'Link subject teachers to their subjects',
      'Subjects become available for exam creation',
    ],
    benefits: [
      'Supports multiple curriculum frameworks',
      'Clear subject-teacher-class relationships',
      'Simplifies exam and report card setup',
      'Organized academic structure',
    ],
  },
  {
    title: 'Exams & Marks',
    shortTitle: 'Exams',
    slug: 'exams',
    description:
      'Create exams, enter marks, view results, auto-calculate grades, and connect everything to report cards.',
    longDescription:
      'The Exams & Marks module is the academic heart of Matokeo. Create exams, enter student marks efficiently, auto-calculate grades using your school\'s grading system, and feed results directly into report cards and analytics.',
    icon: ClipboardList,
    featureHref: '/features/exams',
    dashboardHref: '/dashboard/exams-marks',
    status: 'active',
    audience: ['admin', 'teacher'],
    features: [
      'Exam creation with type and date',
      'Rapid marks entry interface',
      'Auto-grade calculation',
      'Support for multiple exam types (Midterm, Endterm, Opener)',
      'Real-time auto-save during entry',
      'Subject and class performance analysis',
      'Marks-to-report card pipeline',
      'Exam results broadsheet view',
    ],
    workflow: [
      'Create an exam for a subject, class, and term',
      'Enter student marks through the marks entry interface',
      'Grades are automatically calculated based on your grading system',
      'View exam results and class performance',
      'Results flow into report cards and analytics',
    ],
    benefits: [
      'Fast and accurate marks entry',
      'Eliminates manual grade calculation',
      'Direct connection to report cards',
      'Comprehensive performance analysis',
    ],
  },
  {
    title: 'Attendance',
    shortTitle: 'Attendance',
    slug: 'attendance',
    description:
      'Mark daily attendance, track present, absent, late, and excused status, and generate attendance reports.',
    longDescription:
      'The Attendance module provides a simple, efficient way to track daily student attendance. Mark students as present, absent, late, or excused, generate summaries, and include attendance data in report cards.',
    icon: CalendarCheck,
    featureHref: '/features/attendance',
    dashboardHref: '/dashboard/attendance',
    status: 'active',
    audience: ['admin', 'teacher'],
    features: [
      'Daily attendance marking',
      'Status options: Present, Absent, Late, Excused',
      'Class-wise attendance view',
      'Attendance percentage calculation',
      'Attendance summary for report cards',
      'Date-range attendance reports',
      'Bulk attendance marking',
      'SMS alerts for absent students (coming soon)',
    ],
    workflow: [
      'Select the class and date',
      'Mark each student as Present, Absent, Late, or Excused',
      'Review daily attendance summary',
      'Generate weekly or monthly attendance reports',
      'Attendance data flows into report cards',
    ],
    benefits: [
      'Quick daily attendance tracking',
      'Accurate attendance records for reporting',
      'Early identification of attendance issues',
      'Prepares for SMS notification integration',
    ],
  },
  {
    title: 'Parents & Guardians',
    shortTitle: 'Parents',
    slug: 'parents',
    description:
      'Store parent and guardian contacts, link them to students, and prepare for a parent communication portal.',
    longDescription:
      'The Parents & Guardians module manages parent and guardian information, linking them to their children\'s records. This lays the foundation for parent portals, SMS alerts, fee tracking, and direct report card access.',
    icon: Heart,
    featureHref: '/features/parents',
    dashboardHref: '/dashboard/people?tab=parents',
    status: 'active',
    audience: ['admin'],
    features: [
      'Parent and guardian profile management',
      'Multiple guardians per student',
      'Phone and email contact storage',
      'Relationship type tracking (Father, Mother, Guardian)',
      'Student-parent linking',
      'Communication log preparation',
      'Parent portal readiness (Phase Two)',
      'SMS alert readiness (Phase Two)',
    ],
    workflow: [
      'Add parent profiles with contact information',
      'Link parents to their children (students)',
      'Specify relationship type for each link',
      'Parents become ready for portal and SMS access',
      'Track communication records over time',
    ],
    benefits: [
      'Centralized parent contact database',
      'Quick access to emergency contacts',
      'Foundation for parent communication tools',
      'Improves school-home relationship',
    ],
  },
  {
    title: 'Academic Analytics',
    shortTitle: 'Analytics',
    slug: 'analytics',
    description:
      'Visualize school-wide performance trends, subject analysis, class comparisons, and student progress.',
    longDescription:
      'The Academic Analytics module transforms your school\'s data into actionable insights. Track performance trends, compare classes and subjects, identify at-risk students, and make data-driven decisions for academic improvement.',
    icon: LineChart,
    featureHref: '/features/analytics',
    dashboardHref: '/dashboard/analytics',
    status: 'active',
    audience: ['admin', 'teacher', 'student'],
    features: [
      'School-wide performance dashboard',
      'Subject-wise analysis and comparison',
      'Class and stream performance ranking',
      'Student progress tracking over terms',
      'Performance trend visualization',
      'Top and bottom performer identification',
      'Grade distribution charts',
      'Exportable analytics reports',
    ],
    workflow: [
      'Navigate to the Analytics dashboard',
      'Select the academic year, term, and scope',
      'View performance charts and insights',
      'Compare across classes, subjects, or terms',
      'Export analytics data for presentations',
    ],
    benefits: [
      'Data-driven academic decision making',
      'Early identification of struggling students',
      'Performance benchmarking across classes',
      'Professional analytics for stakeholders',
    ],
  },
  {
    title: 'Settings',
    shortTitle: 'Settings',
    slug: 'settings',
    description:
      'Configure your school profile, academic calendar, curriculum, grading systems, and platform preferences.',
    longDescription:
      'The Settings module is your school\'s command center. Configure your school profile, set up academic years and terms, define grading systems, choose your curriculum framework, and customize the platform to match your school\'s needs.',
    icon: Settings,
    featureHref: '/features',
    dashboardHref: '/dashboard/settings',
    status: 'active',
    audience: ['admin'],
    features: [
      'School profile and branding',
      'Academic year and term setup',
      'Curriculum framework selection',
      'Grading system configuration',
      'Report card template settings',
      'User invitation and access control',
      'Class and stream structure setup',
      'System preferences and defaults',
    ],
    workflow: [
      'Set up your school profile with name and logo',
      'Create academic years and define terms',
      'Select your curriculum (CBC, 8-4-4, Cambridge)',
      'Configure grading scales and thresholds',
      'Customize report card format and branding',
    ],
    benefits: [
      'Complete school customization',
      'Flexible grading system support',
      'One-time setup, term-by-term updates',
      'Centralized platform control',
    ],
  },
];

// ── Phase Two Modules (Coming Soon) ──────────────────────────
// Icon imports are reused from lucide-react; these use placeholder icons
import {
  CreditCard,
  Smartphone,
  MessageSquare,
  Globe,
  Library,
  Bus,
  Building,
  Shield,
  Package,
  Laptop,
} from 'lucide-react';

export const comingSoonModules: ComingSoonModule[] = [
  {
    title: 'Fees & Payments',
    slug: 'fees',
    description: 'Track fee balances, record payments, generate fee statements, and manage school finances.',
    icon: CreditCard,
    status: 'coming-soon',
  },
  {
    title: 'M-Pesa Integration',
    slug: 'mpesa',
    description: 'Accept fee payments via M-Pesa with automatic reconciliation and SMS receipts.',
    icon: Smartphone,
    status: 'coming-soon',
  },
  {
    title: 'SMS Communication',
    slug: 'sms',
    description: 'Send bulk SMS to parents for attendance alerts, fee reminders, and school announcements.',
    icon: MessageSquare,
    status: 'coming-soon',
  },
  {
    title: 'Parent Portal',
    slug: 'parent-portal',
    description: 'Give parents secure access to their children\'s reports, fees, attendance, and communication.',
    icon: Globe,
    status: 'coming-soon',
  },
  {
    title: 'Library',
    slug: 'library',
    description: 'Manage library books, track borrowing, and maintain a digital catalog for your school.',
    icon: Library,
    status: 'coming-soon',
  },
  {
    title: 'Transport',
    slug: 'transport',
    description: 'Manage school transport routes, vehicle assignments, and student transport tracking.',
    icon: Bus,
    status: 'coming-soon',
  },
  {
    title: 'Hostel',
    slug: 'hostel',
    description: 'Manage hostel rooms, bed allocation, and boarding student records.',
    icon: Building,
    status: 'coming-soon',
  },
  {
    title: 'Discipline',
    slug: 'discipline',
    description: 'Track student discipline records, incidents, interventions, and behavioral patterns.',
    icon: Shield,
    status: 'coming-soon',
  },
  {
    title: 'Inventory',
    slug: 'inventory',
    description: 'Track school assets, supplies, and equipment with inventory management tools.',
    icon: Package,
    status: 'coming-soon',
  },
  {
    title: 'LMS / Assignments',
    slug: 'lms',
    description: 'Create and distribute assignments, learning materials, and track student submissions.',
    icon: Laptop,
    status: 'coming-soon',
  },
];

// ── Helper to find a module by slug ──────────────────────────
export function getModuleBySlug(slug: string): Module | ComingSoonModule | undefined {
  return modules.find((m) => m.slug === slug) ?? comingSoonModules.find((m) => m.slug === slug);
}
