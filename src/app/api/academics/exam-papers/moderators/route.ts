import { route } from '@/lib/platform/access';
import { paperModerators } from '@/lib/academics/exam-papers-server';
import type { PaperModerator } from '@/lib/academics/exam-papers';

/** Who moderates this school's papers, so uploaders know where a paper goes. */
export const GET = route(
    'exam paper moderators',
    { module: 'exam_papers', permission: ['exam_papers.upload', 'exam_papers.moderate', 'exam_papers.manage'] },
    async ({ access }): Promise<PaperModerator[]> => paperModerators(access.schoolId, access.modules),
);
