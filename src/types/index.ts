export type Role = 'admin' | 'teacher' | 'parent';
export type ExamTerm = 'mid_term' | 'end_term' | 'annual';

export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: Role;
}

export interface ClassRoom {
    id: string;
    name: string;
    academic_year: string;
}

export interface Subject {
    id: string;
    name: string;
    code: string;
}

export interface Student {
    id: string;
    first_name: string;
    last_name: string;
    enrollment_number: string;
    date_of_birth?: string;
    class_id?: string;
    parent_id?: string;
}

export interface Exam {
    id: string;
    title: string;
    term: ExamTerm;
    academic_year: string;
    date: string;
}

export interface Mark {
    id: string;
    student_id: string;
    subject_id: string;
    exam_id: string;
    teacher_id?: string;
    score: number;
    total_possible: number;
    remarks?: string;
}
