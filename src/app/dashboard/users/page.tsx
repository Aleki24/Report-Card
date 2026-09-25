"use client";

import React, { useState } from 'react';
import { Printer, UserPlus } from 'lucide-react';
import { useUsersPage, type UserRow } from '@/hooks/useUsersPage';
import { UsersStats } from '@/components/users/UsersStats';
import { UsersDirectory } from '@/components/users/UsersDirectory';
import { UserProfileDialog } from '@/components/users/UserProfileDialog';
import type { DirectoryView } from '@/components/users/userMeta';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { EditUserModal } from '@/components/users/EditUserModal';
import { InviteResultModal, ResetPasswordResultModal } from '@/components/users/UserResultModals';
import { InviteCodesPrintModal } from '@/components/users/InviteCodesPrintModal';

export default function UsersPage() {
  const h = useUsersPage();
  const [view, setView] = useState<DirectoryView>('grid');
  const [showPrintModal, setShowPrintModal] = useState(false);

  const openAddUser = () => { h.resetForm(); h.setShowModal(true); };
  // Actions started from the profile dialog close it first, so two dialogs never stack.
  const editFromProfile = (user: UserRow) => { h.setViewingUser(null); h.handleEditClick(user); };
  const resetFromProfile = (user: UserRow) => { h.setViewingUser(null); h.resetUserPassword(user); };

  return (
    <div className="mx-auto w-full max-w-7xl pb-10">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-widest text-primary uppercase">People</p>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">User Management</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Everyone with an account at your school. Open anyone to see their full profile.
          </p>
        </div>
        <div className="flex w-full shrink-0 md:w-auto">
          <button type="button" className="btn-primary w-full md:w-auto" onClick={openAddUser}>
            <UserPlus className="size-4" aria-hidden="true" />Add user
          </button>
        </div>
      </header>

      <UsersStats
        loading={h.loading} roleCounts={h.roleCounts} inactiveCount={h.inactiveCount}
        roleFilter={h.roleFilter} statusFilter={h.statusFilter}
        onSelectRole={h.setRoleFilter} onSelectStatus={h.setStatusFilter}
      />

      {/* Only where it is useful: people who have not activated yet need their codes handed out. */}
      {h.statusFilter === 'INACTIVE' && h.inactiveCount > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold">{h.inactiveCount} account{h.inactiveCount === 1 ? '' : 's'} not active.</span>{' '}
            <span className="text-muted-foreground">People who haven&apos;t activated yet need their activation code to sign in.</span>
          </p>
          <button type="button" className="btn-secondary w-full shrink-0 sm:w-auto" onClick={() => setShowPrintModal(true)}>
            <Printer className="size-4" aria-hidden="true" />Print activation codes
          </button>
        </div>
      )}

      <UsersDirectory
        loading={h.loading} totalUsers={h.users.length} paginatedUsers={h.paginatedUsers}
        filteredCount={h.filteredUsers.length} roleCounts={h.roleCounts} totalPages={h.totalPages}
        currentPage={h.currentPage} setCurrentPage={h.setCurrentPage} usersPerPage={h.usersPerPage}
        roleFilter={h.roleFilter} setRoleFilter={h.setRoleFilter}
        statusFilter={h.statusFilter} setStatusFilter={h.setStatusFilter}
        sortBy={h.sortBy} setSortBy={h.setSortBy}
        classFilter={h.classFilter} setClassFilter={h.setClassFilter} gradeGroups={h.gradeGroups}
        searchQuery={h.searchQuery} setSearchQuery={h.setSearchQuery}
        view={view} setView={setView}
        resettingPasswordId={h.resettingPasswordId}
        onView={h.setViewingUser} onEdit={h.handleEditClick} onResetPassword={h.resetUserPassword} onAddUser={openAddUser}
      />

      <UserProfileDialog
        user={h.viewingUser}
        onClose={() => h.setViewingUser(null)}
        onEdit={editFromProfile}
        onResetPassword={resetFromProfile}
        resetting={h.viewingUser !== null && h.resettingPasswordId === h.viewingUser.id}
        onUpdated={h.refreshUsers}
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
          formJobTitle={h.formJobTitle} setFormJobTitle={h.setFormJobTitle}
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
          editJobTitle={h.editJobTitle} setEditJobTitle={h.setEditJobTitle}
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

      {showPrintModal && <InviteCodesPrintModal onClose={() => setShowPrintModal(false)} />}

      {h.showResetResult && (
        <ResetPasswordResultModal inviteCode={h.resetResultInviteCode} notified={h.resetResultNotified} onClose={() => h.setShowResetResult(false)} />
      )}

    </div>
  );
}
