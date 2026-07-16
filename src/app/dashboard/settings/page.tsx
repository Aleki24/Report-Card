"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import PageHeader from '@/components/dashboard/PageHeader';
import { Card, CardContent, Button } from '@/components/ui';
import { AcademicStructureTab } from '@/components/settings/AcademicStructureTab';
import { GradingSystemsTab } from '@/components/settings/GradingSystemsTab';
import { AcademicCalendarTab } from '@/components/settings/AcademicCalendarTab';
import { SchoolForm } from '@/components/settings/SchoolForm';
import { toast } from 'sonner';

interface AcademicLevel { id: string; code: string; name: string; }
interface Grade { id: string; code: string; name_display: string; numeric_order: number; academic_level_id: string; }
interface GradingSystem { id: string; name: string; description: string | null; academic_level_id: string; }
interface GradingScale { id: string; grading_system_id: string; min_percentage: number; max_percentage: number; symbol: string; label: string; points: number | null; order_index: number; }
interface SchoolProfile { id?: string; name: string; address: string; phone: string; email: string; logo_url?: string; teacher_invite_code?: string; student_invite_code?: string; min_combination_group_size?: number; }
interface AcademicYear { id: string; name: string; start_date: string; end_date: string; }
interface Term { id: string; academic_year_id: string; name: string; start_date: string; end_date: string; is_current: boolean; }

export default function SettingsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'academic' | 'grading' | 'calendar'>('profile');

  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradingSystems, setGradingSystems] = useState<GradingSystem[]>([]);
  const [gradingScales, setGradingScales] = useState<GradingScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedCalYearId, setSelectedCalYearId] = useState('');

  const [school, setSchool] = useState<SchoolProfile>({ name: '', address: '', phone: '', email: '', logo_url: '' });
  const [schoolLoading, setSchoolLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [calSaving, setCalSaving] = useState(false);
  const [newYear, setNewYear] = useState({ name: '', start_date: '', end_date: '' });
  const [newTerm, setNewTerm] = useState({ name: '', start_date: '', end_date: '' });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setSchoolLoading(true);
    try {
      const [structureRes, schoolRes, yearsRes, termsRes] = await Promise.all([
        fetch('/api/admin/academic-structure'),
        fetch('/api/school/data?type=school_profile'),
        fetch('/api/school/data?type=academic_years'),
        fetch('/api/school/data?type=terms'),
      ]);
      const [structureData, schoolData, yearsData, termsData] = await Promise.all([
        structureRes.json(), schoolRes.json(), yearsRes.json(), termsRes.json(),
      ]);

      setAcademicLevels(structureData.academic_levels || []);
      setGrades(structureData.grades || []);
      setGradingSystems(structureData.grading_systems || []);
      setGradingScales(structureData.grading_scales || []);

      const years = yearsData.data || [];
      setAcademicYears(years);
      setTerms(termsData.data || []);
      if (years.length > 0 && !selectedCalYearId) setSelectedCalYearId(years[0].id);

      if (schoolData.data) {
        setSchool({
          id: schoolData.data.id, name: schoolData.data.name || '', address: schoolData.data.address || '',
          phone: schoolData.data.phone || '', email: schoolData.data.email || '', logo_url: schoolData.data.logo_url || '',
          teacher_invite_code: schoolData.data.teacher_invite_code || '',
          student_invite_code: schoolData.data.student_invite_code || '',
          min_combination_group_size: schoolData.data.min_combination_group_size ?? 15,
        });
      }
    } catch (err) {
      console.error('Error fetching settings data:', err);
    } finally {
      setLoading(false);
      setSchoolLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (profile?.id) fetchAllData(); }, [profile?.id, fetchAllData]);

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/school', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: school.name.trim(), address: school.address.trim() || null, phone: school.phone.trim() || null, email: school.email.trim() || null, logo_url: school.logo_url || null, min_combination_group_size: school.min_combination_group_size ?? null, school_id: school.id || null, user_id: profile?.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); }
      else if (data.school_id) {
        setSchool(prev => ({ ...prev, id: data.school_id }));
        toast.success(school.id ? 'School profile updated!' : 'School created!');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setSaving(false); }
  };

  const postStructure = async (type: string, payload: Record<string, unknown>) => {
    setCalSaving(true);
    try {
      const res = await fetch('/api/admin/academic-structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...payload }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`${type.replace('_', ' ')} added successfully`);
      await fetchAllData();
      return data.data;
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Unknown error'); return null; }
    finally { setCalSaving(false); }
  };

  const deleteStructure = async (type: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    setCalSaving(true);
    try {
      const res = await fetch(`/api/admin/academic-structure?type=${type}&id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Deleted successfully');
      await fetchAllData();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setCalSaving(false); }
  };

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYear.name.trim() || !newYear.start_date || !newYear.end_date) return;
    const result = await postStructure('academic_year', newYear);
    if (result) { setNewYear({ name: '', start_date: '', end_date: '' }); setSelectedCalYearId(result.id); }
  };

  const handleAddTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCalYearId || !newTerm.name.trim() || !newTerm.start_date || !newTerm.end_date) return;
    const result = await postStructure('term', { academic_year_id: selectedCalYearId, ...newTerm });
    if (result) setNewTerm({ name: '', start_date: '', end_date: '' });
  };

  const handleSetCurrentTerm = async (term: Term) => {
    if (term.is_current) return;
    setCalSaving(true);
    try {
      // Only one term should be current at a time — clear the others in the same year first.
      const siblings = terms.filter(t => t.academic_year_id === term.academic_year_id && t.is_current && t.id !== term.id);
      for (const s of siblings) {
        await fetch('/api/admin/academic-structure', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'term', id: s.id, is_current: false }),
        });
      }
      const res = await fetch('/api/admin/academic-structure', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'term', id: term.id, is_current: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update term');
      toast.success(`${term.name} is now the current term`);
      await fetchAllData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCalSaving(false);
    }
  };

  const tabs = [
    { key: 'profile' as const, label: 'School Profile' },
    { key: 'academic' as const, label: 'Academic Structure' },
    { key: 'grading' as const, label: 'Grading Systems' },
    { key: 'calendar' as const, label: '📅 Academic Calendar' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <PageHeader 
        title="School Settings" 
        description="System configuration and academic setup" 
      />

      <div className="flex border-b border-border mb-8 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading && activeTab !== 'profile' ? (
        <div className="p-12 text-center text-muted-foreground">Loading configuration...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {activeTab === 'profile' && (
            <div className="lg:col-span-3">
              {schoolLoading ? (
                <ContentSkeleton message="Loading school profile..." />
              ) : !school.id ? (
                <Card className="max-w-[560px] mx-auto">
                  <CardContent className="p-8">
                    <div className="text-center mb-6">
                      <img src="https://em-content.zobj.net/source/apple/354/school_1f3eb.png" alt="School" className="w-16 h-16 object-contain mx-auto mb-4" />
                      <h2 className="text-xl font-bold font-display mb-2">Setup Your School</h2>
                      <p className="text-sm text-muted-foreground">Add your school details. This will appear in reports across the app.</p>
                    </div>
                    <form onSubmit={handleSaveSchool}>
                      <SchoolForm school={school} setSchool={setSchool} />
                      <Button type="submit" variant="primary" className="w-full mt-6" disabled={saving || !school.name.trim()}>
                        {saving ? '⏳ Creating...' : '🚀 Create School'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card className="max-w-[560px] mx-auto">
                  <CardContent className="p-8">
                    <h3 className="font-bold text-lg font-display mb-6">School Profile</h3>
                    <form onSubmit={handleSaveSchool}>
                      <SchoolForm school={school} setSchool={setSchool} />
                      <Button type="submit" variant="primary" className="w-full mt-6" disabled={saving || !school.name.trim()}>
                        {saving ? '⏳ Saving...' : 'Save Changes'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          {activeTab === 'academic' && <AcademicStructureTab academicLevels={academicLevels} grades={grades} />}
          {activeTab === 'grading' && <GradingSystemsTab academicLevels={academicLevels} gradingSystems={gradingSystems} gradingScales={gradingScales} />}
          {activeTab === 'calendar' && (
            <AcademicCalendarTab
              academicYears={academicYears} terms={terms} selectedCalYearId={selectedCalYearId}
              setSelectedCalYearId={setSelectedCalYearId} calMsg={''} calSaving={calSaving}
              newYear={newYear} setNewYear={setNewYear} newTerm={newTerm} setNewTerm={setNewTerm}
              onAddYear={handleAddYear} onAddTerm={handleAddTerm} onDelete={deleteStructure}
              onSetCurrentTerm={handleSetCurrentTerm}
            />
          )}
        </div>
      )}
    </div>
  );
}
