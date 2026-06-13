"use client";

import React from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, PenTool, GraduationCap, LineChart } from 'lucide-react';

export default function ReportCardsPage() {
  const links = [
    { title: 'Generate Reports', desc: 'Create, review, and download report cards for your students.', href: '/dashboard/reports', icon: FileText, primary: true },
    { title: 'Exams & Marks', desc: 'Create exams, enter marks, and view results.', href: '/dashboard/exams-marks', icon: PenTool, primary: false },
    { title: 'Analytics', desc: 'Analyze performance trends to inform report card comments.', href: '/dashboard/analytics', icon: LineChart, primary: false },
  ];

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">Report Cards</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Generate professional academic reports with marks, grades, comments, and PDF export.</p>
      </div>

      {/* Info Banner */}
      <div className="my-6" style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <FileText style={{ width: 24, height: 24, color: 'var(--color-accent)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Report Cards Module</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            This module brings together marks, grades, teacher comments, and student data to produce professional PDF report cards. Use the links below to access the full report card workflow.
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid sm:grid-cols-2" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="card group"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', textDecoration: 'none', padding: 'var(--space-6)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <link.icon style={{ width: 24, height: 24, color: link.primary ? 'var(--color-accent)' : 'var(--color-text-muted)' }} />
              <ArrowRight style={{ width: 16, height: 16, color: 'var(--color-text-muted)', transition: 'transform 0.2s' }} className="group-hover:translate-x-1" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{link.title}</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
