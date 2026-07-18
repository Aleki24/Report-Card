"use client";

import React, { useEffect, useState } from 'react';
import { User, Phone, Mail, Calendar, Shield, Users, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import PageHeader from '@/components/dashboard/PageHeader';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { FormField, InputField } from '@/components/ui/FormField';

interface StudentProfile {
    admission_number: string | null;
    status: string | null;
    date_of_birth: string | null;
    guardian_name: string | null;
    guardian_email: string | null;
    guardian_phone: string | null;
    users: { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
    grade_streams: { name: string; full_name: string } | null;
    academic_levels: { name: string } | null;
}

export default function StudentProfilePage() {
    const { schoolName } = useAuth();
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return (
            <div className="mx-auto max-w-[1100px] py-10 text-center">
                <div className="skeleton-spinner mx-auto" />
            </div>
        );
    }

    const user = profile?.users;
    const stream = profile?.grade_streams;
    const level = profile?.academic_levels;
    const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}` : 'ST';

    return (
        <div className="mx-auto max-w-[1100px] pb-10">
            <PageHeader title="Profile" description="View your academic information and update your personal details." />

            <div className="grid grid-cols-1 items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
                {/* 1. Account Information */}
                <DashboardCard>
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                            <Shield size={16} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">Account Information</span>
                            <span className="text-[11px] font-medium text-muted-foreground">View your account details and school information.</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <InfoRow label="Student ID" value={profile?.admission_number} />
                        <InfoRow label="School" value={schoolName} />
                        <InfoRow label="Class & Section" value={stream?.full_name} />
                        <InfoRow label="Academic Level" value={level?.name} />
                        <InfoRow label="Status" value={profile?.status} />
                    </div>
                </DashboardCard>

                {/* 2. Profile & Personal Details */}
                <DashboardCard>
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                            <User size={16} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">Personal Details</span>
                            <span className="text-[11px] font-medium text-muted-foreground">Update your contact information.</span>
                        </div>
                    </div>

                    <div className="flex gap-5">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-[28px] font-extrabold text-primary-foreground shadow-[0_4px_12px_color-mix(in_srgb,var(--primary)_20%,transparent)]">
                            {initials}
                        </div>

                        <div className="flex flex-1 flex-col gap-3">
                            <FormField label="Full Name">
                                <div className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-semibold text-foreground">
                                    {user?.first_name} {user?.last_name}
                                </div>
                            </FormField>
                            <FormField label="Date of Birth">
                                <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-[13px] font-semibold text-foreground">
                                    <Calendar size={14} className="text-muted-foreground" />
                                    {profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                </div>
                            </FormField>
                            <FormField label="Email Address">
                                <div className="rounded-md border border-border bg-muted px-3 py-1.5 text-[13px] font-semibold text-foreground">
                                    {user?.email || '—'}
                                </div>
                            </FormField>
                            <FormField label="Phone Number">
                                <div className="flex gap-2">
                                    <InputField type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="flex-1" />
                                    <button onClick={handleSavePhone} disabled={saving} className="btn-primary inline-flex shrink-0 items-center gap-1.5 px-3 text-xs">
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </FormField>
                        </div>
                    </div>
                </DashboardCard>

                {/* 3. Connected Parent */}
                <DashboardCard className="mt-2 [grid-column:1/-1]">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Users size={16} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">Connected Parent / Guardian</span>
                            <span className="text-[11px] font-medium text-muted-foreground">Primary contact for school communications.</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-muted p-5">
                        <div className="flex min-w-[200px] items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                                {profile?.guardian_name ? profile.guardian_name[0] : 'G'}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-foreground">{profile?.guardian_name || 'Guardian Not Set'}</div>
                                <div className="text-xs text-muted-foreground">Primary Contact</div>
                            </div>
                        </div>

                        <div className="flex min-w-[200px] flex-1 items-center gap-2">
                            <Mail size={16} className="text-muted-foreground" />
                            <div>
                                <div className="text-[13px] font-semibold text-foreground">{profile?.guardian_email || '—'}</div>
                                <div className="text-[11px] text-muted-foreground">Email Address</div>
                            </div>
                        </div>

                        <div className="flex min-w-[150px] flex-1 items-center gap-2">
                            <Phone size={16} className="text-muted-foreground" />
                            <div>
                                <div className="text-[13px] font-semibold text-foreground">{profile?.guardian_phone || '—'}</div>
                                <div className="text-[11px] text-muted-foreground">Phone</div>
                            </div>
                        </div>
                    </div>
                </DashboardCard>
            </div>

            <div className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Shield size={14} /> Your privacy and security are important to us.
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex justify-between border-b border-border pb-2.5">
            <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
            <span className="text-[13px] font-bold text-foreground">{value || '—'}</span>
        </div>
    );
}
