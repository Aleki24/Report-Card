"use client";

import React, { useEffect, useState } from 'react';
import { User, Phone, Mail, Calendar, Shield, Users, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Editable state
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/school/student/profile').then(r => r.json()).then(j => {
            setProfile(j.data);
            setPhone(j.data?.users?.phone || '');
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handleSavePhone = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/school/student/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || 'Failed to update phone number');
            toast.success('Phone number updated');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update phone number');
        }
        setSaving(false);
    };

    if (loading) return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><div className="skeleton-spinner" style={{ margin: '0 auto' }} /></div>;

    const user = profile?.users;
    const stream = profile?.grade_streams;
    const level = profile?.academic_levels;
    const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}` : 'ST';

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: 4 }}>
                    Profile
                </h1>
                <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                    View your academic information and update your personal details.
                </p>
            </div>

            {/* Masonry / Grid layout for cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 'var(--space-5)', alignItems: 'start' }}>
                
                {/* 1. Account Information */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <div className="premium-icon-box" style={{ background: 'var(--muted)', color: 'var(--viz-info)', width: 32, height: 32, borderRadius: 8 }}><Shield size={16} /></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 14 }}>Account Information</span>
                                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>View your account details and school information.</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                        <InfoRow label="Student ID" value={profile?.admission_number} />
                        <InfoRow label="School" value={user?.school_id ? 'Bright Future School' : 'Your School'} />
                        <InfoRow label="Class & Section" value={stream?.full_name || '—'} />
                        <InfoRow label="Academic Level" value={level?.name || '—'} />
                        <InfoRow label="Status" value={profile?.status} />
                    </div>
                </div>

                {/* 2. Profile & Personal Details */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <div className="premium-icon-box" style={{ background: 'var(--muted)', color: 'var(--viz-info)', width: 32, height: 32, borderRadius: 8 }}><User size={16} /></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 14 }}>Personal Details</span>
                                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>Update your contact information.</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
                        {/* Avatar */}
                        <div style={{ position: 'relative' }}>
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-foreground)', fontSize: 28, fontWeight: 800, boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 20%, transparent)' }}>
                                {initials}
                            </div>
                        </div>
                        
                        {/* Info Fields */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, display: 'block', marginBottom: 2 }}>Full Name</label>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', padding: '6px 12px', background: 'var(--muted)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                    {user?.first_name} {user?.last_name}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, display: 'block', marginBottom: 2 }}>Date of Birth</label>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', padding: '6px 12px', background: 'var(--muted)', borderRadius: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Calendar size={14} color="var(--muted-foreground)" /> {profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, display: 'block', marginBottom: 2 }}>Email Address</label>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', padding: '6px 12px', background: 'var(--muted)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                    {user?.email || '—'}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, display: 'block', marginBottom: 2 }}>Phone Number</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input 
                                        type="tel" 
                                        value={phone} 
                                        onChange={e => setPhone(e.target.value)}
                                        style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--foreground)', padding: '6px 12px', background: 'var(--card)', borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }}
                                    />
                                    <button onClick={handleSavePhone} disabled={saving} style={{ padding: '0 12px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Connected Parent */}
                <div className="premium-card" style={{ gridColumn: '1 / -1', marginTop: 'var(--space-2)' }}>
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <div className="premium-icon-box" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)', width: 32, height: 32, borderRadius: 8 }}><Users size={16} /></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 14 }}>Connected Parent / Guardian</span>
                                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>Primary contact for school communications.</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 24, padding: 20, background: 'var(--muted)', borderRadius: 12, border: '1px solid var(--border)', marginTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-foreground)', fontWeight: 700, fontSize: 16 }}>
                                {profile?.guardian_name ? profile.guardian_name[0] : 'G'}
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{profile?.guardian_name || 'Guardian Not Set'}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Primary Contact</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                            <Mail size={16} color="var(--muted-foreground)" />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{profile?.guardian_email || '—'}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Email Address</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 150 }}>
                            <Phone size={16} color="var(--muted-foreground)" />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{profile?.guardian_phone || '—'}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Phone</div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            
            <div style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Shield size={14} /> Your privacy and security are important to us.
            </div>
        </div>
    );
}

// ── UI Helper Components ────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{value || '—'}</span>
        </div>
    );
}
