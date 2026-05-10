"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { modules } from '@/lib/modules';

const featureModules = modules.filter(m => m.slug !== 'settings');

interface FeaturesDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

export function FeaturesDropdown({ isOpen, onClose }: FeaturesDropdownProps) {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                width: '380px', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: '16px', padding: '8px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)', zIndex: 100,
            }}
        >
            <div style={{ padding: '8px 12px 12px', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Platform Modules
                </span>
            </div>
            {featureModules.map((mod) => {
                const IconComponent = mod.icon;
                return (
                    <Link
                        key={mod.slug} href={mod.featureHref} onClick={onClose}
                        className="rounded-lg transition-all duration-150 hover:bg-[var(--color-surface-raised)]"
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', textDecoration: 'none', color: 'var(--color-text-primary)' }}
                    >
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '8px', background: 'var(--color-accent-glow)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <IconComponent style={{ width: '16px', height: '16px', color: 'var(--color-accent)' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.3 }}>{mod.title}</div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', lineHeight: 1.4, marginTop: '1px' }}>
                                {mod.description.slice(0, 60) + '…'}
                            </div>
                        </div>
                    </Link>
                );
            })}
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: '4px', paddingTop: '4px' }}>
                <Link
                    href="/features" onClick={onClose}
                    className="rounded-lg transition-all duration-150 hover:bg-[var(--color-surface-raised)]"
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', textDecoration: 'none', color: 'var(--color-accent)',
                        fontSize: '0.8125rem', fontWeight: 600,
                    }}
                >
                    View All Features
                    <ArrowRight style={{ width: '14px', height: '14px' }} />
                </Link>
            </div>
        </div>
    );
}
