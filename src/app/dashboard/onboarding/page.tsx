"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, Loader2, Calendar, BookOpen, Users, Building, GraduationCap, School, Library } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Wordmark } from '@/components/Wordmark';
import { toast } from 'sonner';
import ClassesStep, { gradesMissingStreams, type ClassPlan, type StandardGrade } from '@/components/onboarding/ClassesStep';
import SubjectsStep from '@/components/onboarding/SubjectsStep';
import { parseStreamNames } from '@/lib/classes';
import { CURRICULA, ONBOARDING_TERMS, type Curriculum, type OnboardingInput } from '@/lib/schemas';

type OnboardingRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | null;

const ADMIN_STEPS = [
  { id: 1, title: 'School Details', icon: Building, description: 'Basic school information' },
  { id: 2, title: 'Calendar', icon: Calendar, description: 'Set your current year and term' },
  { id: 3, title: 'Curriculum', icon: BookOpen, description: 'Select academic levels' },
  { id: 4, title: 'Classes', icon: Users, description: 'Your grades, as one class or streams' },
  { id: 5, title: 'Subjects', icon: Library, description: 'The subjects every learner takes' },
];

const CURRICULUM_OPTIONS: Record<Curriculum, { label: string; description: string }> = {
  CBC: { label: 'CBC', description: 'Competency Based Curriculum' },
  '844': { label: '8-4-4 System', description: 'Traditional Curriculum' },
};

export default function OnboardingWizard() {
  const router = useRouter();
  const { user, role, schoolOnboardingCompleted, loading: authLoading } = useAuth();

  const [selectedRole, setSelectedRole] = useState<OnboardingRole>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Where to go once the account is usable. Set by links that had somewhere
  // specific in mind — a report-card QR sends the student on to their results
  // rather than dumping them on the generic dashboard. Same-site paths only.
  const [nextPath] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('next');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
  });

  // Name of the student a scanned report card identified, shown so they can
  // see whose account they're linking to. Purely informational — the invite
  // code is still what proves the account is theirs.
  const [scannedName, setScannedName] = useState<string | null>(null);

  // Approval state of a school this account already requested. A sign-up is
  // held until the platform owner approves, so someone who already asked must
  // see that they're waiting rather than be offered the wizard again.
  const [approval, setApproval] = useState<{
    status: string | null; schoolName: string | null; note: string | null;
  } | null>(null);
  const [approvalChecked, setApprovalChecked] = useState(false);

  // Onboarding is only for users who haven't joined a school yet: PENDING
  // accounts, or admins whose school setup is unfinished. Anyone who already
  // activated with an invite code has a real role — send them straight to
  // their dashboard instead of asking for an invite code a second time.
  const alreadyOnboarded = !authLoading && !!role && role !== 'PENDING' &&
    !(role === 'ADMIN' && schoolOnboardingCompleted === false);

  useEffect(() => {
    if (alreadyOnboarded) {
      router.replace(nextPath || (role === 'STUDENT' ? '/student/dashboard' : '/dashboard'));
    }
  }, [alreadyOnboarded, role, router, nextPath]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/school/approval-status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled) return;
        if (d?.hasSchool) setApproval({ status: d.status, schoolName: d.schoolName, note: d.note });
      })
      .catch(() => { /* fall through to the normal wizard */ })
      .finally(() => { if (!cancelled) setApprovalChecked(true); });
    return () => { cancelled = true; };
  }, []);

  const awaitingApproval = approval?.status === 'PENDING_APPROVAL';
  const wasRejected = approval?.status === 'REJECTED';

  // --- Admin Form State ---
  const [schoolName, setSchoolName] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [term, setTerm] = useState<OnboardingInput['term']>({ name: 'Term 1', start_date: '', end_date: '' });
  const [curricula, setCurricula] = useState<Curriculum[]>(['CBC']);
  const [standardGrades, setStandardGrades] = useState<StandardGrade[]>([]);
  const [classPlans, setClassPlans] = useState<Record<string, ClassPlan>>({});
  const [offerSubjects, setOfferSubjects] = useState(true);

  // The standard grades, fetched once the admin starts setting a school up.
  useEffect(() => {
    if (selectedRole !== 'ADMIN' || standardGrades.length > 0) return;
    fetch('/api/school/onboarding')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Could not load the grade list'))))
      .then((d: { grades: StandardGrade[] }) => setStandardGrades(d.grades))
      .catch((err: Error) => toast.error(err.message));
  }, [selectedRole, standardGrades.length]);

  /** Ticked grades still inside the chosen curricula (unticking a curriculum drops its grades). */
  const chosenGrades = standardGrades.filter(g => classPlans[g.id] && curricula.includes(g.curriculum));

  /** Why the current step can't continue yet, or null. */
  const stepProblem = (step: number): string | null => {
    if (step === 1 && !schoolName.trim()) return 'School name is required';
    if (step === 2) {
      if (!/^\d{4}$/.test(academicYear)) return 'Enter the academic year, e.g. 2026';
      if (!term.start_date || !term.end_date) return `Enter when ${term.name} starts and ends`;
      if (term.end_date <= term.start_date) return 'The term must end after it starts';
      if (!term.start_date.startsWith(academicYear)) return 'The term should start in the academic year you entered';
    }
    if (step === 3 && curricula.length === 0) return 'Pick at least one curriculum';
    if (step === 4) {
      if (chosenGrades.length === 0) return 'Tick at least one grade';
      const missing = gradesMissingStreams(classPlans).filter(id => chosenGrades.some(g => g.id === id));
      if (missing.length > 0) return `Name the streams for ${standardGrades.find(g => g.id === missing[0])?.name}, or choose "One class"`;
    }
    return null;
  };

  // --- Teacher/Student Form State ---
  const [inviteCode, setInviteCode] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');

  // Allow deep-linking with the invite code (e.g. /dashboard/onboarding?role=TEACHER&code=A7X3K9)
  // so a code the user already provided elsewhere doesn't have to be retyped.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    const roleParam = params.get('role')?.toUpperCase();
    if (codeParam) setInviteCode(codeParam.toUpperCase());
    if (roleParam === 'ADMIN' || roleParam === 'TEACHER' || roleParam === 'STUDENT') {
      setSelectedRole(roleParam);
    }

    // Arrived from a report-card QR: name the student being linked. Reads the
    // same public endpoint the scanned page uses, so no extra data is exposed.
    const scanned = params.get('student');
    if (scanned && /^[0-9a-f-]{32,36}$/i.test(scanned)) {
      fetch(`/api/verify/${scanned}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.student?.name) setScannedName(d.student.name); })
        .catch(() => { /* the name is a nicety; the form works without it */ });
    }
  }, []);

  const progress = selectedRole === 'ADMIN' ? (currentStep / ADMIN_STEPS.length) * 100 : 100;

  const handleNext = () => {
    if (selectedRole === 'ADMIN') {
      const problem = stepProblem(currentStep);
      if (problem) {
        toast.error(problem);
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
          term,
          curricula,
          classes: chosenGrades.map(g => ({
            grade_id: g.id,
            streams: classPlans[g.id].hasStreams ? parseStreamNames(classPlans[g.id].streams) : [],
          })),
          offerCompulsorySubjects: offerSubjects,
        } satisfies OnboardingInput),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save onboarding data');

      // A brand-new school is held for the platform owner, and the account is
      // still PENDING, so the dashboard would have nothing to show. Switch to
      // the waiting screen instead of navigating.
      if (data.awaitingApproval) {
        setApproval({ status: 'PENDING_APPROVAL', schoolName: schoolName.trim(), note: null });
        setLoading(false);
        return;
      }

      window.location.href = '/dashboard';
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
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
      window.location.href = nextPath || '/dashboard';
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  if (authLoading || alreadyOnboarded) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // A school sign-up waits for the platform owner. Show that state instead of
  // the wizard — offering "set up a school" again to someone who already asked
  // just invites duplicate requests the server would reject anyway.
  if (awaitingApproval || wasRejected) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${awaitingApproval ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
            <span className="text-2xl" aria-hidden>{awaitingApproval ? '⏳' : '🚫'}</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {awaitingApproval ? 'Waiting for approval' : 'Request not approved'}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {awaitingApproval ? (
              <>
                Your request to set up <strong className="text-foreground">{approval?.schoolName || 'your school'}</strong> has
                been sent to the <Wordmark /> team. We&apos;ll email you as soon as it&apos;s reviewed —
                your account unlocks the moment it&apos;s approved.
              </>
            ) : (
              <>
                We couldn&apos;t approve the request for{' '}
                <strong className="text-foreground">{approval?.schoolName || 'your school'}</strong>.
              </>
            )}
          </p>
          {wasRejected && approval?.note && (
            <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{approval.note}</p>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            Joining a school that already uses <Wordmark />? Ask your administrator for an invite
            code — you won&apos;t need this request.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => { setApproval(null); setSelectedRole('TEACHER'); }}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold"
            >
              I have an invite code
            </button>
            <a href="/logout" className="rounded-xl px-5 py-2.5 text-sm font-semibold text-muted-foreground no-underline">
              Sign out
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Hold the wizard back until we know whether a request is already pending,
  // so the create-a-school option never flashes up for someone who has one.
  if (!approvalChecked) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- ROLE SELECTION SCREEN ---
  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center py-12 px-4 sm:px-6">
        <div className="w-full max-w-4xl text-center mb-10">
          <h1 className="text-4xl font-extrabold font-display text-foreground mb-4">Welcome to <Wordmark />!</h1>
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
            <p className="text-muted-foreground mb-8 flex-1 relative z-10">I am a principal or administrator looking to set up a new school on <Wordmark />.</p>
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
            {selectedRole === 'ADMIN'
              ? "Let's get your school's configuration ready."
              : scannedName
                ? `Linking to ${scannedName}'s records. Enter the invite code from your school to finish.`
                : 'Enter your invite details to link your account.'}
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
                        className="input-field"
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
                        className="input-field"
                        placeholder="contact@school.edu"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">School Phone</label>
                      <input 
                        type="tel" 
                        value={schoolPhone}
                        onChange={(e) => setSchoolPhone(e.target.value)}
                        className="input-field"
                        placeholder="+254 700 000 000"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">School Address</label>
                      <input 
                        type="text" 
                        value={schoolAddress}
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        className="input-field"
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
                    <p className="text-sm text-muted-foreground mb-4">
                      The current year and term, with the term&apos;s real dates — exams, attendance and report cards are filed under them.
                      Add the other terms later in Settings.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="block text-sm font-semibold">Academic Year</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value.trim())}
                        className="input-field w-full"
                        placeholder="e.g. 2026"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="block text-sm font-semibold">Current Term</span>
                      <select
                        value={term.name}
                        onChange={(e) => setTerm(t => ({ ...t, name: e.target.value as OnboardingInput['term']['name'] }))}
                        className="input-field w-full"
                      >
                        {ONBOARDING_TERMS.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="block text-sm font-semibold">{term.name} starts <span className="text-destructive">*</span></span>
                      <input type="date" value={term.start_date} onChange={(e) => setTerm(t => ({ ...t, start_date: e.target.value }))} className="input-field w-full" />
                    </label>
                    <label className="space-y-2">
                      <span className="block text-sm font-semibold">{term.name} ends <span className="text-destructive">*</span></span>
                      <input type="date" value={term.end_date} min={term.start_date || undefined} onChange={(e) => setTerm(t => ({ ...t, end_date: e.target.value }))} className="input-field w-full" />
                    </label>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Curriculum</h2>
                    <p className="text-sm text-muted-foreground mb-4">Tick every curriculum your school runs — both, if you are still teaching 8-4-4 classes.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {CURRICULA.map(code => {
                      const on = curricula.includes(code);
                      return (
                        <label key={code} className={`cursor-pointer flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${on ? 'border-primary bg-primary/5' : 'border-border'}`}>
                          <input
                            type="checkbox"
                            className="size-5 shrink-0 accent-primary"
                            checked={on}
                            onChange={() => setCurricula(list => on ? list.filter(c => c !== code) : [...list, code])}
                          />
                          <span>
                            <span className="block font-semibold">{CURRICULUM_OPTIONS[code].label}</span>
                            <span className="block text-xs text-muted-foreground">{CURRICULUM_OPTIONS[code].description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {standardGrades.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading grades…</div>
                  ) : (
                    <ClassesStep grades={standardGrades} curricula={curricula} plans={classPlans} onChange={setClassPlans} />
                  )}
                </div>
              )}

              {currentStep === 5 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <SubjectsStep grades={chosenGrades} offer={offerSubjects} onOfferChange={setOfferSubjects} />
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
                      className="input-field input-field-mono uppercase"
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
