"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, Loader2, Calendar, BookOpen, Layers, Users, Building, GraduationCap, School } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

type OnboardingRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | null;

const ADMIN_STEPS = [
  { id: 1, title: 'School Details', icon: Building, description: 'Basic school information' },
  { id: 2, title: 'Calendar', icon: Calendar, description: 'Set your current year and term' },
  { id: 3, title: 'Curriculum', icon: BookOpen, description: 'Select academic levels' },
  { id: 4, title: 'Classes', icon: Users, description: 'Create your classes and streams' },
  { id: 5, title: 'Subjects', icon: Layers, description: 'Add subjects offered' },
];

export default function OnboardingWizard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // --- Admin Form State ---
  const [schoolName, setSchoolName] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [termName, setTermName] = useState('Term 1');
  const [curriculum, setCurriculum] = useState({ cbc: true, '844': false });
  const [classes, setClasses] = useState([{ grade: 'Grade 1', streams: '1A, 1B' }]);
  const [subjects, setSubjects] = useState('Mathematics, English, Kiswahili, Science');

  // --- Teacher/Student Form State ---
  const [inviteCode, setInviteCode] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');

  const progress = selectedRole === 'ADMIN' ? (currentStep / ADMIN_STEPS.length) * 100 : 100;

  const handleNext = () => {
    if (selectedRole === 'ADMIN') {
      if (currentStep === 1 && !schoolName) {
        toast.error('School name is required');
        return;
      }
      if (currentStep < ADMIN_STEPS.length) {
        setCurrentStep(prev => prev + 1);
      } else {
        handleAdminSubmit();
      }
    } else {
      handleJoinSubmit();
    }
  };

  const handleBack = () => {
    if (selectedRole === 'ADMIN' && currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      setSelectedRole(null);
      setCurrentStep(1);
    }
  };

  const handleAdminSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName,
          schoolEmail,
          schoolPhone,
          schoolAddress,
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

  const handleJoinSubmit = async () => {
    if (!inviteCode) {
      toast.error('Invite code is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/school/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join school');

      toast.success('Successfully joined the school!');
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

  // --- ROLE SELECTION SCREEN ---
  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center py-12 px-4 sm:px-6">
        <div className="w-full max-w-4xl text-center mb-10">
          <h1 className="text-4xl font-extrabold font-display text-foreground mb-4">Welcome to Matokeo!</h1>
          <p className="text-muted-foreground text-xl">How would you like to use the platform?</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 w-full max-w-5xl">
          {/* Admin Option */}
          <button 
            onClick={() => setSelectedRole('ADMIN')}
            className="group relative bg-card border-2 border-border rounded-3xl p-8 hover:border-primary hover:shadow-xl transition-all text-left overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 relative z-10">
              <School className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold mb-3 relative z-10">Register a School</h3>
            <p className="text-muted-foreground mb-8 flex-1 relative z-10">I am a principal or administrator looking to set up a new school on Matokeo.</p>
            <div className="text-primary font-semibold flex items-center gap-2 mt-auto">
              Get Started <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Teacher Option */}
          <button 
            onClick={() => setSelectedRole('TEACHER')}
            className="group relative bg-card border-2 border-border rounded-3xl p-8 hover:border-emerald-500 hover:shadow-xl transition-all text-left overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-6 relative z-10">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold mb-3 relative z-10">Join as Teacher</h3>
            <p className="text-muted-foreground mb-8 flex-1 relative z-10">I am a teacher and have an invite code from my school administrator.</p>
            <div className="text-emerald-500 font-semibold flex items-center gap-2 mt-auto">
              Join School <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Student Option */}
          <button 
            onClick={() => setSelectedRole('STUDENT')}
            className="group relative bg-card border-2 border-border rounded-3xl p-8 hover:border-blue-500 hover:shadow-xl transition-all text-left overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6 relative z-10">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold mb-3 relative z-10">Join as Student</h3>
            <p className="text-muted-foreground mb-8 flex-1 relative z-10">I am a student and have an invite code from my school administrator.</p>
            <div className="text-blue-500 font-semibold flex items-center gap-2 mt-auto">
              Join School <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // --- ONBOARDING FORMS ---
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold font-display text-foreground mb-2">
            {selectedRole === 'ADMIN' ? 'Set up your School' : `Join as a ${selectedRole === 'TEACHER' ? 'Teacher' : 'Student'}`}
          </h1>
          <p className="text-muted-foreground text-lg">
            {selectedRole === 'ADMIN' ? "Let's get your school's configuration ready." : "Enter your invite details to link your account."}
          </p>
        </div>

        {/* Progress Bar (Only for Admin) */}
        {selectedRole === 'ADMIN' && (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-primary">Step {currentStep} of {ADMIN_STEPS.length}</span>
              <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}% Completed</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="grid grid-cols-5 gap-2 mt-6">
              {ADMIN_STEPS.map((step) => {
                const Icon = step.icon;
                const isActive = step.id === currentStep;
                const isPast = step.id < currentStep;
                return (
                  <div key={step.id} className={`flex flex-col items-center text-center ${isActive ? 'text-primary' : isPast ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 border-2 transition-colors ${
                      isActive ? 'border-primary bg-primary/10' : 
                      isPast ? 'border-emerald-500 bg-emerald-500/10' : 
                      'border-muted bg-muted/50'
                    }`}>
                      {isPast ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold">{step.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
          
          {/* ==== ADMIN STEPS ==== */}
          {selectedRole === 'ADMIN' && (
            <>
              {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <h2 className="text-xl font-bold mb-1">School Information</h2>
                    <p className="text-sm text-muted-foreground mb-4">Enter the basic details for your school.</p>
                  </div>
                  
                  <div className="grid gap-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">School Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-input bg-transparent"
                        placeholder="e.g. Nairobi Primary School"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">School Email</label>
                      <input 
                        type="email" 
                        value={schoolEmail}
                        onChange={(e) => setSchoolEmail(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-input bg-transparent"
                        placeholder="contact@school.edu"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">School Phone</label>
                      <input 
                        type="tel" 
                        value={schoolPhone}
                        onChange={(e) => setSchoolPhone(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-input bg-transparent"
                        placeholder="+254 700 000 000"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">School Address</label>
                      <input 
                        type="text" 
                        value={schoolAddress}
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-input bg-transparent"
                        placeholder="P.O. Box 1234, Nairobi"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
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

              {currentStep === 3 && (
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

              {currentStep === 4 && (
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
                            className="h-11 px-3 text-red-500 hover:bg-destructive/10 rounded-lg text-sm font-medium"
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

              {currentStep === 5 && (
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
            </>
          )}

          {/* ==== TEACHER / STUDENT STEPS ==== */}
          {(selectedRole === 'TEACHER' || selectedRole === 'STUDENT') && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div>
                  <h2 className="text-xl font-bold mb-1">Invite Code</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Please enter the invite code provided by your school administrator.
                  </p>
                </div>
                
                <div className="grid gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">School Invite Code <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-input bg-transparent uppercase tracking-widest font-mono"
                      placeholder="e.g. T-A1B2C3"
                      required
                    />
                  </div>
                </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={handleBack}
              disabled={loading}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors text-foreground hover:bg-muted`}
            >
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={loading}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectedRole === 'ADMIN' 
                ? (currentStep === ADMIN_STEPS.length ? 'Complete Setup' : 'Continue') 
                : 'Join School'
              }
              {!loading && (selectedRole === 'ADMIN' && currentStep !== ADMIN_STEPS.length) && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
