"use client";

import React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { modules } from '@/lib/modules';

const featureModules = modules.filter(m => m.slug !== 'settings');

interface MobileNavMenuProps {
    isOpen: boolean;
    onClose: () => void;
    mobileFeaturesOpen: boolean;
    setMobileFeaturesOpen: (val: boolean) => void;
}

export function MobileNavMenu({ isOpen, onClose, mobileFeaturesOpen, setMobileFeaturesOpen }: MobileNavMenuProps) {
    const { isSignedIn } = useAuth();
    if (!isOpen) return null;

    const mobileLinkStyle = {
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-body)',
        fontSize: '0.9375rem',
        fontWeight: 500 as const,
        padding: '12px 16px',
        display: 'block' as const,
        textDecoration: 'none',
    };

    return (
        <div
            className="sm:hidden"
            style={{
                marginTop: '16px', padding: '12px', background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', gap: '4px',
                maxHeight: '70vh', overflowY: 'auto',
            }}
        >
            <Link href="/" onClick={onClose} className="rounded-lg transition-all duration-200" style={mobileLinkStyle}>Home</Link>

            {/* Features (Expandable) */}
            <button
                onClick={() => setMobileFeaturesOpen(!mobileFeaturesOpen)}
                style={{
                    ...mobileLinkStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', background: mobileFeaturesOpen ? 'var(--color-surface-raised)' : 'transparent',
                    border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                }}
            >
                Features
                <ChevronDown style={{ width: '16px', height: '16px', transition: 'transform 0.2s', transform: mobileFeaturesOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
            </button>

            {mobileFeaturesOpen && (
                <div style={{ paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {featureModules.map((mod) => {
                        const IconComponent = mod.icon;
                        return (
                            <Link
                                key={mod.slug} href={mod.featureHref}
                                onClick={() => { onClose(); setMobileFeaturesOpen(false); }}
                                className="rounded-lg transition-all duration-150 hover:bg-muted"
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', textDecoration: 'none', color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 500 }}
                            >
                                <IconComponent style={{ width: '16px', height: '16px', color: 'var(--color-accent)', flexShrink: 0 }} />
                                {mod.title}
                            </Link>
                        );
                    })}
                    <Link
                        href="/features"
                        onClick={() => { onClose(); setMobileFeaturesOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', textDecoration: 'none', color: 'var(--color-accent)', fontSize: '0.8125rem', fontWeight: 600 }}
                    >
                        View All Features
                        <ChevronRight style={{ width: '14px', height: '14px' }} />
                    </Link>
                </div>
            )}

            <Link href="/contact" onClick={onClose} className="rounded-lg transition-all duration-200" style={mobileLinkStyle}>Contact</Link>
            <Link href="/pricing" onClick={onClose} className="rounded-lg transition-all duration-200" style={mobileLinkStyle}>Pricing</Link>

            <div style={{ height: '1px', background: 'var(--color-border-subtle)', margin: '4px 0' }} />

            <Link href="/login" onClick={onClose} className="rounded-lg transition-all duration-200" style={mobileLinkStyle}>Sign In</Link>
            <Link href="/activate" onClick={onClose} className="rounded-lg transition-all duration-200" style={mobileLinkStyle}>Activate with Invite Code</Link>
            {/* Signed-out visitors get guided into joining; signed-in users keep their dashboard shortcut */}
            <Link
                href={isSignedIn ? '/dashboard' : '/signup'} onClick={onClose}
                className="rounded-lg transition-all duration-200 text-center"
                style={{
                    background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
                    color: '#1A1816', fontFamily: 'var(--font-body)', fontSize: '0.9375rem',
                    fontWeight: 600, padding: '12px 16px', display: 'block', textDecoration: 'none',
                }}
            >
                {isSignedIn ? 'Dashboard' : 'Get Started'}
            </Link>
        </div>
    );
}
