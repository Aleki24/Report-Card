"use client";

import React, { useState } from 'react';
import { Settings, UserCircle } from 'lucide-react';

type Tab = 'users' | 'settings';

export default function AdministrationPage() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">Administration</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Manage users and school configuration</p>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-muted/50 border border-border rounded-lg w-fit">
        {([{ id: 'users' as const, label: 'User Management', icon: <UserCircle size={16} /> },
          { id: 'settings' as const, label: 'Settings', icon: <Settings size={16} /> }]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.id ? 'bg-[var(--color-surface)] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' ? <UsersTab /> : <SettingsTabInner />}
    </div>
  );
}

/* ───── Users Tab (from /dashboard/users) ───── */
import { InfoGuide } from '@/components/ui/InfoGuide';
import { UsersTable } from '@/components/users/UsersTable';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { EditUserModal } from '@/components/users/EditUserModal';
import { InviteResultModal, ResetPasswordResultModal } from '@/components/users/UserResultModals';
import { useUsersPage } from '@/hooks/useUsersPage';

function UsersTab() {
  const h = useUsersPage();

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Add teachers and students by phone number</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => { h.resetForm(); h.setShowModal(true); }}>+ Add User</button>
      </div>

      <InfoGuide title="How your users log in:">
        <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2">
          <li><strong>Admins &amp; Principals:</strong> Log in using their <strong>Email Address</strong>.</li>
          <li><strong>Teachers &amp; Students:</strong> Log in using their unique auto-generated <strong>Username</strong> (listed in the table below).</li>
          <li><strong>Default Passwords:</strong> Old users have password <strong>password123</strong>. New users get an exact password shown at creation.</li>
          <li><strong>Creating Users:</strong> Click <strong>+ Add User</strong>. After providing their details, the system will generate a username and password.</li>
        </ul>
      </InfoGuide>

      <UsersTable
        loading={h.loading}
        users={h.users}
        paginatedUsers={h.paginatedUsers}
        filteredUsers={h.filteredUsers}
        totalPages={h.totalPages}
        currentPage={h.currentPage}
        setCurrentPage={h.setCurrentPage}
        usersPerPage={h.usersPerPage}
        roleFilter={h.roleFilter}
        setRoleFilter={h.setRoleFilter}
        searchQuery={h.searchQuery}
        setSearchQuery={h.setSearchQuery}
        resettingPasswordId={h.resettingPasswordId}
        onEdit={h.handleEditClick}
        onResetPassword={h.resetUserPassword}
      />

      {h.showModal && (
        <InviteUserModal
          onClose={() => h.setShowModal(false)}
          onSubmit={h.handleInviteUser}
          formError={h.formError}
          submitting={h.submitting}
          formFirstName={h.formFirstName}
          setFormFirstName={h.setFormFirstName}
          formLastName={h.formLastName}
          setFormLastName={h.setFormLastName}
          formPhone={h.formPhone}
          setFormPhone={h.setFormPhone}
          formRole={h.formRole}
          setFormRole={h.setFormRole}
          formSequenceNumber={h.formSequenceNumber}
          setFormSequenceNumber={h.setFormSequenceNumber}
          formAdmissionNumber={h.formAdmissionNumber}
          setFormAdmissionNumber={h.setFormAdmissionNumber}
          formGradeStreamId={h.formGradeStreamId}
          setFormGradeStreamId={h.setFormGradeStreamId}
          formAcademicLevelId={h.formAcademicLevelId}
          setFormAcademicLevelId={h.setFormAcademicLevelId}
          formClassTeacherStreamId={h.formClassTeacherStreamId}
          setFormClassTeacherStreamId={h.setFormClassTeacherStreamId}
          formSubjectTeacherSubjects={h.formSubjectTeacherSubjects}
          setFormSubjectTeacherSubjects={h.setFormSubjectTeacherSubjects}
          gradeStreams={h.gradeStreams}
          academicLevels={h.academicLevels}
          subjects={h.subjects}
          grades={h.grades}
        />
      )}

      {h.showEditModal && h.editingUser && (
        <EditUserModal
          editingUser={h.editingUser}
          onClose={() => h.setShowEditModal(false)}
          onSubmit={h.handleUpdateUser}
          formError={h.formError}
          submitting={h.submitting}
          editFirstName={h.editFirstName}
          setEditFirstName={h.setEditFirstName}
          editLastName={h.editLastName}
          setEditLastName={h.setEditLastName}
          editPhone={h.editPhone}
          setEditPhone={h.setEditPhone}
          editRole={h.editRole}
          setEditRole={h.setEditRole}
          editIsActive={h.editIsActive}
          setEditIsActive={h.setEditIsActive}
          editClassTeacherStreamId={h.editClassTeacherStreamId}
          setEditClassTeacherStreamId={h.setEditClassTeacherStreamId}
          editSubjectTeacherSubjects={h.editSubjectTeacherSubjects}
          setEditSubjectTeacherSubjects={h.setEditSubjectTeacherSubjects}
          gradeStreams={h.gradeStreams}
          subjects={h.subjects}
          grades={h.grades}
        />
      )}

      {h.showInviteResult && (
        <InviteResultModal
          invitedName={h.invitedName}
          invitedUsername={h.invitedUsername}
          invitedCode={h.invitedCode}
          onClose={() => h.setShowInviteResult(false)}
        />
      )}

      {h.showResetResult && (
        <ResetPasswordResultModal
          inviteCode={h.resetResultInviteCode}
          onClose={() => h.setShowResetResult(false)}
        />
      )}
    </div>
  );
}

/* ───── Settings Tab (from /dashboard/settings) ───── */
import { SchoolForm } from '@/components/settings/SchoolForm';
import { AcademicStructureTab } from '@/components/settings/AcademicStructureTab';
import { GradingSystemsTab } from '@/components/settings/GradingSystemsTab';
import { AcademicCalendarTab } from '@/components/settings/AcademicCalendarTab';
import { Card, CardContent, Button } from '@/components/ui';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { useSettingsPage } from '@/hooks/useSettingsPage';

type SettingsTab = 'profile' | 'academic' | 'grading' | 'calendar';

function SettingsTabInner() {
  const h = useSettingsPage();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const tabs = [
    { id: 'profile' as const, label: 'School Profile' },
    { id: 'academic' as const, label: 'Academic Structure' },
    { id: 'grading' as const, label: 'Grading Systems' },
    { id: 'calendar' as const, label: 'Academic Calendar' },
  ];

  return (
    <div>
      <div className="flex gap-1 mb-6 p-1 bg-muted/50 border border-border rounded-lg w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === t.id ? 'bg-[var(--color-surface)] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {h.loading && activeTab !== 'profile' ? (
        <ContentSkeleton message="Loading settings..." />
      ) : (
        <>
          {activeTab === 'profile' && (
            <div className="max-w-[560px]">
              {h.schoolLoading ? (
                <ContentSkeleton message="Loading school profile..." />
              ) : !h.school.id ? (
                <Card>
                  <CardContent className="p-8">
                    <div className="text-center mb-6">
                      <img src="https://em-content.zobj.net/source/apple/354/school_1f3eb.png" alt="School" className="w-16 h-16 object-contain mx-auto mb-4" />
                      <h2 className="text-xl font-bold font-display mb-2">Setup Your School</h2>
                      <p className="text-sm text-muted-foreground">Add your school details.</p>
                    </div>
                    <form onSubmit={h.handleSchoolSave}>
                      <SchoolForm school={h.school} setSchool={h.setSchool} />
                      {h.saveMsg && <div className="mt-4 text-sm font-medium">{h.saveMsg}</div>}
                      <Button type="submit" variant="primary" className="w-full mt-6" disabled={h.saving || !h.school.name.trim()}>
                        {h.saving ? '⏳ Creating...' : '🚀 Create School'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8">
                    <h3 className="font-bold text-lg font-display mb-6">School Profile</h3>
                    <form onSubmit={h.handleSchoolSave}>
                      <SchoolForm school={h.school} setSchool={h.setSchool} />
                      {h.saveMsg && <div className="mt-4 text-sm font-medium">{h.saveMsg}</div>}
                      <Button type="submit" variant="primary" className="w-full mt-6" disabled={h.saving || !h.school.name.trim()}>
                        {h.saving ? '⏳ Saving...' : 'Save Changes'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          {activeTab === 'academic' && <AcademicStructureTab academicLevels={h.academicLevels} grades={h.grades} />}
          {activeTab === 'grading' && <GradingSystemsTab academicLevels={h.academicLevels} gradingSystems={h.gradingSystems} gradingScales={h.gradingScales} />}
          {activeTab === 'calendar' && (
            <AcademicCalendarTab
              academicYears={h.academicYears} terms={h.terms} selectedCalYearId={h.selectedCalYearId}
              setSelectedCalYearId={h.setSelectedCalYearId} calMsg={h.calMsg} calSaving={h.calSaving}
              newYear={h.newYear} setNewYear={h.setNewYear} newTerm={h.newTerm} setNewTerm={h.setNewTerm}
              onAddYear={h.onAddYear} onAddTerm={h.onAddTerm} onDelete={h.onDelete}
            />
          )}
        </>
      )}
    </div>
  );
}
