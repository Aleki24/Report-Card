import type { SubjectCombination } from '@/types';

/** Shapes the Subjects page reads from /api/admin/academic-structure. */

export interface AcademicLevel { id: string; code: string; name: string }
export interface GradeRow { id: string; name_display: string; code: string; academic_level_id: string; numeric_order: number }
export interface GradingSystem { id: string; name: string; academic_level_id: string }
export interface StreamRow { id: string; full_name: string; grade_id: string }

export interface OfferedSubject {
    id: string;
    name: string;
    code: string;
    category?: string | null;
    academic_level_id?: string;
    subject_type?: 'CORE' | 'ESSENTIAL' | 'OPTIONAL';
    grading_system_id?: string | null;
}

export interface SubjectsData {
    subjects: OfferedSubject[];
    grading_systems: GradingSystem[];
    academic_levels: AcademicLevel[];
    grades: GradeRow[];
    grade_streams: StreamRow[];
    subject_combinations: SubjectCombination[];
}
