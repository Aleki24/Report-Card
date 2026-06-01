"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, Loader2, Calendar, BookOpen, Layers, Users } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, title: 'Academic Calendar', icon: Calendar, description: 'Set your current year and term' },
  { id: 2, title: 'Curriculum', icon: BookOpen, description: 'Select academic levels' },
  { id: 3, title: 'Classes', icon: Users, description: 'Create your classes and streams' },
  { id: 4, title: 'Subjects', icon: Layers, description: 'Add subjects offered' },
];

export default function OnboardingWizard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [termName, setTermName] = useState('Term 1');
  const [curriculum, setCurriculum] = useState({ cbc: true, '844': false });
  
  const [classes, setClasses] = useState([{ grade: 'Grade 1', streams: '1A, 1B' }]);
  const [subjects, setSubjects] = useState('Mathematics, English, Kiswahili, Science');

  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicYear,
          termName,
          curriculum,
          classes,
          subjects
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save onboarding data');

      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold font-display text-foreground mb-2">Welcome to your School Dashboard!</h1>
          <p className="text-muted-foreground text-lg">Let's set up your school configuration to get started.</p>
        </div>

        {/* Progress Bar */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-primary">Step {currentStep} of {STEPS.length}</span>
            <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}% Completed</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-6">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isPast = step.id < currentStep;
              return (
                <div key={step.id} className={`flex flex-col items-center text-center ${isActive ? 'text-primary' : isPast ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border-2 transition-colors ${
                    isActive ? 'border-primary bg-primary/10' : 
                    isPast ? 'border-emerald-500 bg-emerald-500/10' : 
                    'border-muted bg-muted/50'
                  }`}>
                    {isPast ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                  </div>
                  <span className="text-xs font-semibold hidden sm:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-xl font-bold mb-1">Academic Calendar</h2>
                <p className="text-sm text-muted-foreground mb-4">Set up the current academic year and term. You can change this later in settings.</p>
              </div>
              
              <div className="grid gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Academic Year</label>
                  <input 
                    type="text" 
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-input bg-transparent"
                    placeholder="e.g. 2026"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Current Term</label>
                  <select 
                    value={termName}
                    onChange={(e) => setTermName(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-input bg-transparent"
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-xl font-bold mb-1">Curriculum</h2>
                <p className="text-sm text-muted-foreground mb-4">Select the academic levels offered at your school.</p>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={`cursor-pointer flex items-center p-4 rounded-xl border-2 transition-all ${curriculum.cbc ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <input type="checkbox" className="hidden" checked={curriculum.cbc} onChange={() => setCurriculum({...curriculum, cbc: !curriculum.cbc})} />
                  <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${curriculum.cbc ? 'bg-primary border-primary' : 'border-input'}`}>
                    {curriculum.cbc && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                  <div>
                    <div className="font-semibold">CBC</div>
                    <div className="text-xs text-muted-foreground">Competency Based Curriculum</div>
                  </div>
                </label>

                <label className={`cursor-pointer flex items-center p-4 rounded-xl border-2 transition-all ${curriculum['844'] ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <input type="checkbox" className="hidden" checked={curriculum['844']} onChange={() => setCurriculum({...curriculum, '844': !curriculum['844']})} />
                  <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${curriculum['844'] ? 'bg-primary border-primary' : 'border-input'}`}>
                    {curriculum['844'] && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                  <div>
                    <div className="font-semibold">8-4-4 System</div>
                    <div className="text-xs text-muted-foreground">Traditional Curriculum</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-xl font-bold mb-1">Classes & Streams</h2>
                <p className="text-sm text-muted-foreground mb-4">Add your grades and their respective streams (e.g., Grade 1: East, West).</p>
              </div>
              
              <div className="space-y-4">
                {classes.map((cls, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div className="flex-1 space-y-1">
                      <input 
                        type="text" 
                        value={cls.grade}
                        onChange={(e) => {
                          const newC = [...classes];
                          newC[idx].grade = e.target.value;
                          setClasses(newC);
                        }}
                        placeholder="Grade Name (e.g. Grade 1)"
                        className="w-full h-11 px-3 rounded-lg border border-input text-sm"
                      />
                    </div>
                    <div className="flex-[2] space-y-1">
                      <input 
                        type="text" 
                        value={cls.streams}
                        onChange={(e) => {
                          const newC = [...classes];
                          newC[idx].streams = e.target.value;
                          setClasses(newC);
                        }}
                        placeholder="Streams (comma separated e.g. 1A, 1B)"
                        className="w-full h-11 px-3 rounded-lg border border-input text-sm"
                      />
                    </div>
                    {classes.length > 1 && (
                      <button 
                        onClick={() => setClasses(classes.filter((_, i) => i !== idx))}
                        className="h-11 px-3 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                
                <button 
                  onClick={() => setClasses([...classes, { grade: '', streams: '' }])}
                  className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline"
                >
                  + Add another grade
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-xl font-bold mb-1">Subjects</h2>
                <p className="text-sm text-muted-foreground mb-4">Enter the subjects offered at your school, separated by commas.</p>
              </div>
              
              <div className="space-y-2">
                <textarea 
                  value={subjects}
                  onChange={(e) => setSubjects(e.target.value)}
                  className="w-full h-32 p-4 rounded-xl border border-input bg-transparent resize-none leading-relaxed"
                  placeholder="Mathematics, English, Kiswahili, Science, Social Studies..."
                />
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={handleBack}
              disabled={currentStep === 1 || loading}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-foreground hover:bg-muted'
              }`}
            >
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={loading}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {currentStep === STEPS.length ? 'Complete Setup' : 'Continue'}
              {!loading && currentStep !== STEPS.length && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
