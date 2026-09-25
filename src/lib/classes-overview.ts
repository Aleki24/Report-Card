/**
 * The Classes page's view of the school: every grade it teaches and the
 * classes in each. Served by /api/admin/classes. Client-safe.
 */

export interface ClassUsage {
  /** Students currently placed in the class, whatever their status. */
  students: number;
  /** Of those, the ones still enrolled. */
  activeStudents: number;
  exams: number;
  reportCards: number;
}

export interface ClassSummary {
  id: string;
  grade_id: string;
  name: string;
  full_name: string;
  /** Names of the class's class teacher(s). */
  class_teachers: string[];
  usage: ClassUsage;
}

export interface GradeOption {
  id: string;
  name_display: string;
  numeric_order: number;
  academic_level_id: string;
}

export interface CurriculumOption {
  id: string;
  code: string;
  name: string;
}

export interface ClassesOverview {
  curricula: CurriculumOption[];
  grades: GradeOption[];
  classes: ClassSummary[];
}

export const CLASSES_OVERVIEW_URL = '/api/admin/classes';

/**
 * Grades a school can pick. The national list still carries 8-4-4's
 * Standard 1–8 and Form 1–2, which no longer run; only Forms 3 and 4 remain
 * until that curriculum's last cohort leaves.
 */
export function isOfferedGrade(nameDisplay: string | null | undefined): boolean {
  const name = nameDisplay?.trim() ?? '';
  if (name.startsWith('Standard ')) return false;
  if (name.startsWith('Form ')) return name === 'Form 3' || name === 'Form 4';
  return true;
}

/** Why a class can't be deleted, or null when nothing depends on it. */
export function classDeleteBlocker(u: ClassUsage): string | null {
  const held: string[] = [];
  if (u.students > 0) held.push(`${u.students} student${u.students === 1 ? '' : 's'}`);
  if (u.exams > 0) held.push(`${u.exams} exam${u.exams === 1 ? '' : 's'} with their marks`);
  if (u.reportCards > 0) held.push(`${u.reportCards} report card${u.reportCards === 1 ? '' : 's'}`);
  if (held.length === 0) return null;
  const list = held.length === 1 ? held[0] : `${held.slice(0, -1).join(', ')} and ${held[held.length - 1]}`;
  return `This class has ${list}, so it can't be deleted. Move its students to another class first; a class with exam history or report cards can be renamed, but deleting it would erase that history.`;
}
