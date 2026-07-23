"use client";

import React, { useState } from 'react';
import { useUsersPage } from '@/hooks/useUsersPage';
import { useAuth } from '@/components/AuthProvider';
import { InfoGuide } from '@/components/ui/InfoGuide';
import { UsersTable } from '@/components/users/UsersTable';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { EditUserModal } from '@/components/users/EditUserModal';
import { InviteResultModal, ResetPasswordResultModal } from '@/components/users/UserResultModals';
import { InviteCodesPrintModal } from '@/components/users/InviteCodesPrintModal';

export default function UsersPage() {
  const h = useUsersPage();
  const { role } = useAuth();
  const [showPrintModal, setShowPrintModal] = useState(false);

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
        <div>
          <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">User Management</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Add teachers and students by phone number</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {role === 'ADMIN' && (
            <button className="btn-secondary" onClick={() => setShowPrintModal(true)} title="Download a printable PDF of invitation codes grouped by category">🖨️ Print Invite Codes</button>
          )}
          <button className="btn-primary" onClick={() => { h.resetForm(); h.setShowModal(true); }}>+ Add User</button>
        </div>
      </div>

      <InfoGuide title="How your users log in:">
        <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2 text-[var(--color-text)]">
          <li><strong>Admins &amp; Principals:</strong> Must log in using their <strong>Email Address</strong>.</li>
          <li><strong>Teachers &amp; Students:</strong> Must log in using their unique auto-generated <strong>Username</strong> (listed in the table below).</li>
          <li><strong>Passwords:</strong> Each new user is assigned a one-time password shown to you at creation. If a user forgets theirs, use the 🔑 reset button in the table below to issue a new one.</li>
          <li><strong>Creating Users:</strong> Click <strong>+ Add User</strong>. After providing their details, the system will instantly generate a username and password for them. Simply share those details so they can log in!</li>
        </ul>
      </InfoGuide>

      <UsersTable
        loading={h.loading} users={h.users} paginatedUsers={h.paginatedUsers}
        filteredUsers={h.filteredUsers} totalPages={h.totalPages}
        currentPage={h.currentPage} setCurrentPage={h.setCurrentPage} usersPerPage={h.usersPerPage}
        roleFilter={h.roleFilter} setRoleFilter={h.setRoleFilter}
        searchQuery={h.searchQuery} setSearchQuery={h.setSearchQuery}
        resettingPasswordId={h.resettingPasswordId}
        onEdit={h.handleEditClick} onResetPassword={h.resetUserPassword}
      />

      {h.showModal && (
        <InviteUserModal
          onClose={() => { h.setShowModal(false); h.resetForm(); }}
          onSubmit={h.handleInviteUser}
          formError={h.formError} submitting={h.submitting}
          formFirstName={h.formFirstName} setFormFirstName={h.setFormFirstName}
          formLastName={h.formLastName} setFormLastName={h.setFormLastName}
          formPhone={h.formPhone} setFormPhone={h.setFormPhone}
          formRole={h.formRole} setFormRole={h.setFormRole}
          formSequenceNumber={h.formSequenceNumber} setFormSequenceNumber={h.setFormSequenceNumber}
          formAdmissionNumber={h.formAdmissionNumber} setFormAdmissionNumber={h.setFormAdmissionNumber}
          formGradeStreamId={h.formGradeStreamId} setFormGradeStreamId={h.setFormGradeStreamId}
          formAcademicLevelId={h.formAcademicLevelId} setFormAcademicLevelId={h.setFormAcademicLevelId}
          formClassTeacherStreamId={h.formClassTeacherStreamId} setFormClassTeacherStreamId={h.setFormClassTeacherStreamId}
          formSubjectTeacherSubjects={h.formSubjectTeacherSubjects} setFormSubjectTeacherSubjects={h.setFormSubjectTeacherSubjects}
          gradeStreams={h.gradeStreams} academicLevels={h.academicLevels} subjects={h.subjects} grades={h.grades}
          classTeacherAssignments={h.classTeacherAssignments}
        />
      )}

      {h.showEditModal && h.editingUser && (
        <EditUserModal
          editingUser={h.editingUser}
          onClose={() => h.setShowEditModal(false)}
          onSubmit={h.handleUpdateUser}
          formError={h.formError} submitting={h.submitting}
          editFirstName={h.editFirstName} setEditFirstName={h.setEditFirstName}
          editLastName={h.editLastName} setEditLastName={h.setEditLastName}
          editPhone={h.editPhone} setEditPhone={h.setEditPhone}
          editRole={h.editRole} setEditRole={h.setEditRole}
          editIsActive={h.editIsActive} setEditIsActive={h.setEditIsActive}
          editClassTeacherStreamId={h.editClassTeacherStreamId} setEditClassTeacherStreamId={h.setEditClassTeacherStreamId}
          editSubjectTeacherSubjects={h.editSubjectTeacherSubjects} setEditSubjectTeacherSubjects={h.setEditSubjectTeacherSubjects}
          gradeStreams={h.gradeStreams} subjects={h.subjects} grades={h.grades}
          classTeacherAssignments={h.classTeacherAssignments}
        />
      )}

      {h.showInviteResult && (
        <InviteResultModal invitedName={h.invitedName} invitedUsername={h.invitedUsername} invitedCode={h.invitedCode} notified={h.invitedNotified} onClose={() => h.setShowInviteResult(false)} />
      )}

      {h.showResetResult && (
        <ResetPasswordResultModal inviteCode={h.resetResultInviteCode} notified={h.resetResultNotified} onClose={() => h.setShowResetResult(false)} />
      )}

      {showPrintModal && <InviteCodesPrintModal onClose={() => setShowPrintModal(false)} />}
    </div>
  );
}
