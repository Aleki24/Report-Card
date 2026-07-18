"use client";

import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit3, Trash2, Bell } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import { Drawer } from '@/components/ui/Drawer';

interface Announcement {
    id: string;
    title: string;
    content: string;
    isImportant: boolean;
    createdAt: string;
    postedBy: string;
}

export default function AnnouncementsPage() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [saving, setSaving] = useState(false);

    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formImportant, setFormImportant] = useState(false);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/school/announcements');
            const json = await res.json();
            if (json.data) setAnnouncements(json.data);
        } catch (err) {
            console.error('Failed to load announcements:', err);
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = announcements.filter(a =>
        !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = () => {
        setEditing(null);
        setFormTitle('');
        setFormContent('');
        setFormImportant(false);
        setShowModal(true);
    };

    const openEdit = (a: Announcement) => {
        setEditing(a);
        setFormTitle(a.title);
        setFormContent(a.content);
        setFormImportant(a.isImportant);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formTitle || !formContent) return;
        setSaving(true);
        try {
            if (editing) {
                await fetch(`/api/school/announcements/${editing.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: formTitle, content: formContent, is_important: formImportant }),
                });
            } else {
                await fetch('/api/school/announcements', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: formTitle, content: formContent, is_important: formImportant }),
                });
            }
            setShowModal(false);
            await fetchData();
        } catch (err) {
            console.error('Save failed:', err);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this announcement?')) return;
        try {
            await fetch(`/api/school/announcements/${id}`, { method: 'DELETE' });
            await fetchData();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    return (
        <div>
            <PageHeader
                title="Announcements"
                description="Create and manage school-wide announcements"
                breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Announcements' }]}
                action={
                    <button className="btn-primary" onClick={openAdd}>
                        <Plus size={14} /> New Announcement
                    </button>
                }
            />

            <div className="flex items-center input-field w-full max-w-md overflow-hidden px-0 mb-6">
                <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0">
                    <Search size={16} />
                </span>
                <input
                    type="text"
                    placeholder="Search announcements..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-sm"
                />
            </div>

            {loading ? (
                <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
                    <Bell size={28} className="opacity-40" />
                    {search ? 'No matching announcements.' : 'No announcements yet. Click "New Announcement" to create one.'}
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {filtered.map(a => (
                        <div
                            key={a.id}
                            className="card flex items-start gap-4 p-4"
                            style={a.isImportant ? { borderColor: 'color-mix(in srgb, var(--viz-bad) 45%, transparent)' } : undefined}
                        >
                            <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                                style={{
                                    background: `color-mix(in srgb, ${a.isImportant ? 'var(--viz-bad)' : 'var(--viz-info)'} 12%, transparent)`,
                                    color: a.isImportant ? 'var(--viz-bad)' : 'var(--viz-info)',
                                }}
                            >
                                <Bell size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-bold text-foreground">{a.title}</span>
                                    {a.isImportant && (
                                        <span
                                            className="rounded px-2 py-0.5 text-[10px] font-bold"
                                            style={{ background: 'color-mix(in srgb, var(--viz-bad) 12%, transparent)', color: 'var(--viz-bad)' }}
                                        >
                                            IMPORTANT
                                        </span>
                                    )}
                                </div>
                                <p className="mb-1.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                                <div className="text-[11px] text-muted-foreground">
                                    Posted by {a.postedBy} · {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                                <button className="btn-icon" onClick={() => openEdit(a)} title="Edit"><Edit3 size={14} /></button>
                                <button className="btn-icon" style={{ color: 'var(--viz-bad)' }} onClick={() => handleDelete(a.id)} title="Delete"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Side drawer rather than a centered popup, so the announcement
                list stays visible while writing. */}
            <Drawer
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editing ? 'Edit Announcement' : 'New Announcement'}
                footer={
                    <>
                        <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Title *</label>
                        <input
                            type="text"
                            value={formTitle}
                            onChange={e => setFormTitle(e.target.value)}
                            placeholder="Announcement title"
                            className="input-field w-full"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Content *</label>
                        <textarea
                            value={formContent}
                            onChange={e => setFormContent(e.target.value)}
                            rows={10}
                            placeholder="Announcement content..."
                            className="input-field w-full resize-y"
                        />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={formImportant}
                            onChange={e => setFormImportant(e.target.checked)}
                            className="h-4 w-4"
                        />
                        Mark as important
                    </label>
                </div>
            </Drawer>
        </div>
    );
}
