"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';


interface AcademicLevel { id: string; code: string; name: string; }
interface Grade { id: string; code: string; name_display: string; numeric_order: number; academic_level_id: string; }
interface GradingSystem { id: string; name: string; description: string | null; academic_level_id: string; }
interface GradingScale { id: string; grading_system_id: string; min_percentage: number; max_percentage: number; symbol: string; label: string; points: number | null; order_index: number; }
interface SchoolProfile { id?: string; name: string; address: string; phone: string; email: string; logo_url?: string; }
interface AcademicYear { id: string; name: string; start_date: string; end_date: string; }
interface Term { id: string; academic_year_id: string; name: string; start_date: string; end_date: string; is_current: boolean; }

export function useSettingsPage() {
  const { profile } = useAuth();
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
  const [saveMsg, setSaveMsg] = useState('');

  const [calMsg, setCalMsg] = useState('');
  const [calSaving, setCalSaving] = useState(false);
  const [newYear, setNewYear] = useState({ name: '', start_date: '', end_date: '' });
  const [newTerm, setNewTerm] = useState({ name: '', start_date: '', end_date: '' });

  const fetchAllData = useCallback(async () => {
    setLoading(true); setSchoolLoading(true);
    try {
      const [structureRes, schoolRes, yearsRes, termsRes] = await Promise.all([
        fetch('/api/admin/academic-structure'), fetch('/api/school/data?type=school_profile'),
        fetch('/api/school/data?type=academic_years'), fetch('/api/school/data?type=terms'),
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
        });
      }
    } catch (err) { console.error('Error fetching settings data:', err); }
    finally { setLoading(false); setSchoolLoading(false); }
  }, []);

  useEffect(() => { if (profile?.id) fetchAllData(); }, [profile?.id, fetchAllData]);

  const handleSchoolSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school.name.trim()) return;
    setSaving(true); setSaveMsg('');
    try {
      const res = await fetch('/api/admin/school', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: school.name.trim(), address: school.address.trim() || null, phone: school.phone.trim() || null, email: school.email.trim() || null, logo_url: school.logo_url || null, school_id: school.id || null, user_id: profile?.id }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveMsg(`❌ ${data.error}`); }
      else if (data.school_id) {
        setSchool(prev => ({ ...prev, id: data.school_id }));
        setSaveMsg(school.id ? '✅ School profile updated!' : '✅ School created!');
        window.location.reload();
      }
    } catch (err) { setSaveMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setSaving(false); }
  };

  const postStructure = async (type: string, payload: Record<string, unknown>) => {
    setCalSaving(true); setCalMsg('');
    try {
      const res = await fetch('/api/admin/academic-structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...payload }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCalMsg(`✅ ${type.replace('_', ' ')} added successfully`);
      await fetchAllData();
      return data.data;
    } catch (err) { setCalMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`); return null; }
    finally { setCalSaving(false); }
  };

  const onDelete = async (type: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    setCalSaving(true); setCalMsg('');
    try {
      const res = await fetch(`/api/admin/academic-structure?type=${type}&id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCalMsg('✅ Deleted successfully');
      await fetchAllData();
    } catch (err) { setCalMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setCalSaving(false); }
  };

  const onAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYear.name.trim() || !newYear.start_date || !newYear.end_date) return;
    const result = await postStructure('academic_year', newYear);
    if (result) { setNewYear({ name: '', start_date: '', end_date: '' }); setSelectedCalYearId(result.id); }
  };

  const onAddTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCalYearId || !newTerm.name.trim() || !newTerm.start_date || !newTerm.end_date) return;
    await postStructure('term', { academic_year_id: selectedCalYearId, ...newTerm });
    if (!calMsg.startsWith('❌')) setNewTerm({ name: '', start_date: '', end_date: '' });
  };

  return {
    loading, schoolLoading,
    academicLevels, grades, gradingSystems, gradingScales,
    academicYears, terms, selectedCalYearId, setSelectedCalYearId,
    calMsg, calSaving, newYear, setNewYear, newTerm, setNewTerm,
    onAddYear, onAddTerm, onDelete,
    school, setSchool, saving, saveMsg, handleSchoolSave,
  };
}
