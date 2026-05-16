"use client";

import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit3, Trash2, Bell } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import { Modal } from '@/components/ui/Modal';

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
                action={<button className="btn-primary" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> New Announcement</button>}
            />

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                        type="text"
                        placeholder="Search announcements..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none' }}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
            ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                    {search ? 'No matching announcements.' : 'No announcements yet. Click "New Announcement" to create one.'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(a => (
                        <div key={a.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 16,
                            padding: 16, background: '#fff', borderRadius: 12,
                            border: a.isImportant ? '2px solid #EF4444' : '1px solid #E2E8F0',
                        }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: a.isImportant ? '#FEF2F2' : '#EFF6FF',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: a.isImportant ? '#EF4444' : '#3B82F6', flexShrink: 0,
                            }}>
                                <Bell size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{a.title}</span>
                                    {a.isImportant && (
                                        <span style={{
                                            background: '#FEF2F2', color: '#EF4444', padding: '2px 8px',
                                            borderRadius: 4, fontSize: 10, fontWeight: 700,
                                        }}>IMPORTANT</span>
                                    )}
                                </div>
                                <p style={{ fontSize: 13, color: '#475569', margin: '0 0 6px', lineHeight: 1.5 }}>{a.content}</p>
                                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                                    Posted by {a.postedBy} · {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <button className="btn-icon" onClick={() => openEdit(a)} title="Edit"><Edit3 size={14} /></button>
                                <button className="btn-icon" onClick={() => handleDelete(a.id)} title="Delete" style={{ color: '#EF4444' }}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Announcement' : 'New Announcement'}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Title *</label>
                        <input
                            type="text"
                            value={formTitle}
                            onChange={e => setFormTitle(e.target.value)}
                            placeholder="Announcement title"
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Content *</label>
                        <textarea
                            value={formContent}
                            onChange={e => setFormContent(e.target.value)}
                            rows={4}
                            placeholder="Announcement content..."
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, resize: 'vertical' }}
                        />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={formImportant}
                            onChange={e => setFormImportant(e.target.checked)}
                            style={{ width: 16, height: 16 }}
                        />
                        Mark as important
                    </label>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
