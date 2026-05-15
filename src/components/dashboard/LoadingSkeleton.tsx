"use client";

import React from 'react';

/* ── Shimmer Pulse Block ─────────────────────────────────── */
function Bone({ width = '100%', height = 16, radius = 6, style }: {
  width?: string | number; height?: number; radius?: number; style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton-bone"
      style={{
        width, height, borderRadius: radius,
        ...style,
      }}
    />
  );
}

/* ── Stat Card Skeleton ──────────────────────────────────── */
function StatCardSkeleton() {
  return (
    <div className="stat-card" style={{ opacity: 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Bone width={100} height={12} />
        <Bone width={40} height={40} radius={10} />
      </div>
      <Bone width={60} height={28} style={{ marginTop: 12 }} />
      <Bone width={80} height={10} style={{ marginTop: 8 }} />
    </div>
  );
}

/* ── Table Row Skeleton ──────────────────────────────────── */
function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
      padding: 'var(--space-4) var(--space-5)',
      borderBottom: '1px solid var(--color-border-subtle)',
    }}>
      {/* Avatar */}
      <Bone width={32} height={32} radius={999} />
      {/* Name col — wider */}
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Bone width="70%" height={12} />
        <Bone width="40%" height={9} />
      </div>
      {/* Other columns */}
      {Array.from({ length: columns - 1 }).map((_, i) => (
        <div key={i} style={{ flex: 1, display: 'none', ...(i < columns - 1 ? { display: 'block' } : {}) }}>
          <Bone width="60%" height={11} />
        </div>
      ))}
    </div>
  );
}

/* ── Card Skeleton ───────────────────────────────────────── */
function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" style={{ opacity: 0.6, padding: 'var(--space-5)' }}>
      <Bone width={120} height={14} style={{ marginBottom: 16 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Bone
          key={i}
          width={`${85 - i * 15}%`}
          height={11}
          style={{ marginBottom: 10 }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/* PRESETS — drop-in loading screens for each page type     */
/* ══════════════════════════════════════════════════════════ */

/** Full dashboard overview skeleton */
export function DashboardSkeleton() {
  return (
    <div className="dashboard-grid" style={{ gap: 'var(--space-6)', alignItems: 'start' }}>
      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Header */}
        <div>
          <Bone width={200} height={22} style={{ marginBottom: 8 }} />
          <Bone width={300} height={12} />
        </div>
        {/* Stat cards */}
        <div className="dashboard-section-card">
          <Bone width={80} height={14} style={{ marginBottom: 16 }} />
          <div className="overview-stat-grid">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        </div>
        {/* Quick actions */}
        <div className="dashboard-section-card">
          <Bone width={110} height={14} style={{ marginBottom: 16 }} />
          <div className="quick-actions-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <Bone width={36} height={36} radius={6} />
                  <div style={{ flex: 1 }}>
                    <Bone width="60%" height={12} style={{ marginBottom: 6 }} />
                    <Bone width="40%" height={9} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <Bone width={130} height={16} />
        <CardSkeleton lines={2} />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={2} />
      </div>
    </div>
  );
}

/** Table page skeleton (teachers, students, parents, etc.) */
export function TablePageSkeleton({ statCards = 3, columns = 4 }: {
  statCards?: number; columns?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page header */}
      <div>
        <Bone width={180} height={20} style={{ marginBottom: 6 }} />
        <Bone width={260} height={11} />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: 'var(--space-4)' }}>
        {Array.from({ length: statCards }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Bone width={200} height={36} radius={10} />
        <Bone width={120} height={36} radius={10} />
        <Bone width={120} height={36} radius={10} />
      </div>
      {/* Table */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-5)',
          borderBottom: '2px solid var(--color-border)',
        }}>
          <Bone width={32} height={12} radius={999} />
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} style={{ flex: i === 0 ? 2 : 1 }}>
              <Bone width="50%" height={10} />
            </div>
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <TableRowSkeleton key={i} columns={columns} />
        ))}
      </div>
    </div>
  );
}

/** Simple centered content skeleton (subjects, attendance, marks, etc.) */
export function ContentSkeleton({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page header */}
      <div>
        <Bone width={180} height={20} style={{ marginBottom: 6 }} />
        <Bone width={280} height={11} />
      </div>
      {/* Content area */}
      <div className="card" style={{ padding: 'var(--space-8)' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 'var(--space-8) 0', gap: 'var(--space-4)',
        }}>
          <div className="skeleton-spinner" />
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>{message}</p>
        </div>
      </div>
      {/* Placeholder cards below */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-4)' }}>
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}

/** Inline loading for when content is loading within a card/section */
export function InlineLoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          padding: 'var(--space-3) 0',
          borderBottom: i < rows - 1 ? '1px solid var(--color-border-subtle)' : 'none',
        }}>
          <Bone width={28} height={28} radius={999} />
          <div style={{ flex: 1 }}>
            <Bone width={`${70 - (i % 3) * 10}%`} height={11} style={{ marginBottom: 6 }} />
            <Bone width={`${40 + (i % 2) * 15}%`} height={9} />
          </div>
          <Bone width={50} height={24} radius={12} />
        </div>
      ))}
    </div>
  );
}

export { Bone, StatCardSkeleton, TableRowSkeleton, CardSkeleton };
