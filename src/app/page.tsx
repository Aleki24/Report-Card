"use client";

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  LayoutDashboard,
  MonitorSmartphone,
  PieChart,
  Settings,
  ShieldCheck,
  Users,
  Sun,
  Moon,
  FileText,
  TrendingUp,
  Zap,
  Download,
  ListChecks,
  Printer
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function Home() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen my-5 mx-20 relative overflow-hidden transition-colors duration-300">

      {/* BACKGROUND ELEMENTS */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div
          className="absolute top-[-10%] w-[80%] h-[60%] sm:w-[50%] sm:h-[50%] rounded-full blur-[140px]"
          style={{ backgroundColor: 'var(--color-accent-glow)', opacity: theme === 'dark' ? 0.3 : 0.5 }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] sm:w-[40%] sm:h-[40%] rounded-full blur-[120px]"
          style={{ backgroundColor: 'var(--color-success)', opacity: theme === 'dark' ? 0.05 : 0.1 }}
        />
      </div>

      {/* NAVBAR */}
      <nav className="relative z-10 px-3 lg:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-light))' }}
            >
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <span className="font-bold text-xl sm:text-2xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Matokeo
            </span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 text-lg">
            <button
              onClick={toggleTheme}
              className="p-3 rounded-xl transition-colors hover:bg-[var(--color-surface-raised)]"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </button>

            <Link
              href="/login"
              className="font-semibold transition-colors hidden sm:inline-block hover:text-[var(--color-accent)]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Sign In
            </Link>

            <Link
              href="/dashboard"
              className="bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity font-semibold py-4 px-8 rounded-xl shadow-md inline-flex items-center"
            >
              Dashboard
              <ArrowRight className="w-5 h-5 ml-2 inline-block" />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <main className="relative z-10">
        <section className="px-6 lg:px-8 py-24 max-w-5xl mx-auto flex flex-col items-center text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-base font-semibold mb-8 border backdrop-blur-sm shadow-sm"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-accent)' }}
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--color-accent)' }}></span>
              <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: 'var(--color-accent)' }}></span>
            </span>
            Precision Academic Reporting
          </div>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.15] max-w-5xl"
            style={{ color: 'var(--color-text-primary)' }}
          >
            The Ultimate Engine for {' '}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-light))' }}
            >
              School Results
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-xl sm:text-2xl max-w-3xl mx-auto mb-12 leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Matokeo centralizes marks entry, automates deep calculations, and elegantly formats comprehensive report cards for thousands of students instantly.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-6 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="py-4 px-8 text-lg rounded-xl shadow-lg transition-all hover:-translate-y-1 inline-flex items-center justify-center font-bold"
              style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
            >
              Open Dashboard
              <ArrowRight className="w-6 h-6 ml-3" />
            </Link>
            <Link
              href="/login"
              className="py-4 px-8 text-lg rounded-xl transition-all border inline-flex items-center justify-center font-semibold hover:bg-[var(--color-surface-raised)]"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Login to Portal
            </Link>
          </div>
        </section>

        {/* QUICK STATS */}
        <section className="px-6 lg:px-8 py-12">
          <div className="max-w-5xl mx-auto text-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Users, value: 'Role-Based', label: 'Secure Access & Control', color: 'var(--color-accent)' },
                { icon: Zap, value: 'Real-Time', label: 'Instant Calculations', color: 'var(--color-success)' },
                { icon: FileText, value: 'PDF Export', label: 'Elegant Report Cards', color: 'var(--color-warning)' },
                { icon: LayoutDashboard, value: 'Intuitive', label: 'Clear Dashboard View', color: 'var(--color-purple-500)' },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="p-6 sm:p-8 rounded-3xl border text-center shadow-sm hover:shadow-md transition-shadow"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
                >
                  <stat.icon className="w-8 h-8 mx-auto mb-4" style={{ color: stat.color }} />
                  <div className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>{stat.value}</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section className="px-6 lg:px-8 py-24 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16 max-w-4xl mx-auto">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                How to Use Matokeo
              </h2>
              <p className="text-xl sm:text-2xl" style={{ color: 'var(--color-text-secondary)' }}>
                Follow a logical, streamlined workflow to go from blank sheets to finalized academic reports.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-12">
              {[
                {
                  step: '01',
                  icon: Settings,
                  title: 'Configure Structure',
                  desc: 'Admins set up the academic year, terms, classes, subjects, and grading criteria reflecting the school’s curriculum.',
                  color: 'var(--color-accent)'
                },
                {
                  step: '02',
                  icon: ListChecks,
                  title: 'Enter Marks',
                  desc: 'Teachers log in to quickly enter exam scores for their respective subjects. Auto-save ensures no data is ever lost.',
                  color: 'var(--color-success)'
                },
                {
                  step: '03',
                  icon: Printer,
                  title: 'Generate Reports',
                  desc: 'With one click, the system compiles subject scores, calculates rankings, and generates beautifully formatted PDFs.',
                  color: 'var(--color-warning)'
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-8 rounded-[1.5rem] border relative group transition-all duration-300 hover:shadow-xl hover:-translate-y-2 text-center"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div className="absolute top-4 left-6 right-6 flex justify-between items-start pointer-events-none">
                    <span className="text-5xl font-extrabold opacity-5 group-hover:opacity-10 transition-opacity" style={{ color: item.color }}>
                      {item.step}
                    </span>
                  </div>

                  <div
                    className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 relative z-10 shadow-sm"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    <item.icon className="w-8 h-8" style={{ color: item.color }} />
                  </div>
                  <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>{item.title}</h3>
                  <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ROLES SECTION */}
        <section
          className="px-6 lg:px-8 py-24 border-y"
          style={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-border-subtle)' }}
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16 max-w-4xl mx-auto">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                Dedicated Role Portals
              </h2>
              <p className="text-xl sm:text-2xl" style={{ color: 'var(--color-text-secondary)' }}>
                Matokeo automatically scopes access and tools to fit the responsibilities of each user.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-12 max-w-5xl mx-auto">
              {/* ADMIN */}
              <div
                className="p-8 rounded-[1.5rem] border transition-all duration-300 hover:shadow-lg text-center bg-[var(--color-surface)]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div
                  className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}
                >
                  <ShieldCheck className="w-8 h-8" style={{ color: 'var(--color-accent)' }} />
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>Administrator</h3>
                <p className="text-base mb-6 leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                  Complete academic oversight, user management, and system-wide configurations.
                </p>
                <div className="inline-block text-left">
                  <ul className="space-y-3 text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> School Structure & Grading Config</li>
                    <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Global Insights & Analytics</li>
                  </ul>
                </div>
              </div>

              {/* CLASS TEACHER & SUBJECT TEACHER */}
              <div
                className="p-8 rounded-[1.5rem] border transition-all duration-300 hover:shadow-lg text-center bg-[var(--color-surface)]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex justify-center gap-4 mb-6">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center bg-indigo-500/15"
                  >
                    <BookOpen className="w-8 h-8 text-indigo-500" />
                  </div>
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center bg-teal-500/15"
                  >
                    <Users className="w-8 h-8 text-teal-500" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>Teachers</h3>
                <p className="text-base mb-6 leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                  Dedicated interface for rapid exam score entry and class overview management.
                </p>
                <div className="inline-block text-left">
                  <ul className="space-y-3 text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Hassle-Free Marks Input</li>
                    <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-teal-500" /> Generate Broadsheets & Reports</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="px-6 lg:px-8 py-24">
          <div className="max-w-5xl mx-auto">
            <div
              className="relative rounded-[3rem] border p-12 sm:p-20 text-center overflow-hidden shadow-2xl"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              {/* Background glow */}
              <div
                className="absolute inset-0 opacity-40"
                style={{ background: 'linear-gradient(135deg, var(--color-accent-glow), transparent)' }}
              />

              <div className="relative z-10">
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-8" style={{ color: 'var(--color-text-primary)' }}>
                  Streamline Your Academic Processing
                </h2>
                <p className="text-xl sm:text-2xl mb-12 max-w-3xl mx-auto leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Dive straight into the dashboard, configure your school structure, and begin managing grades securely and efficiently.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-6">
                  <Link
                    href="/dashboard"
                    className="py-5 px-10 text-xl rounded-2xl shadow-xl transition-transform hover:-translate-y-1 font-bold inline-flex justify-center items-center"
                    style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
                  >
                    Go to Dashboard
                    <ArrowRight className="w-6 h-6 ml-3 inline-block" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer
        className="border-t py-12 px-6 lg:px-8"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-light))' }}
            >
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Matokeo</span>
          </div>
          <div className="text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>
            © {new Date().getFullYear()} Matokeo Academic System. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
