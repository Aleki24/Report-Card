/**
 * What a school has in place, for the dashboard's setup checklist. Each item
 * is something later steps depend on: no classes means nowhere to put
 * learners, no subjects means no exams, and so on.
 */
export type SetupStatus = {
    hasCurrentTerm: boolean;
    /** Classes (grade streams), including one-class grades. */
    classes: number;
    subjectsOffered: number;
    classesWithoutClassTeacher: number;
    subjectTeacherAssignments: number;
    /** Active learners outside every class — invisible to marks and reports. */
    learnersWithoutClass: number;
};
