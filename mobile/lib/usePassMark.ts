import { PASS_MARK, passMarkOrDefault } from '@shared/pass-mark';
import { useApiQuery } from './useApiQuery';

/**
 * The school's pass mark from Settings (every role may read it), so a
 * learner's chart and an admin's pass rate agree. The default until it loads.
 */
export function useSchoolPassMark(): number {
    const { data } = useApiQuery<{ pass_mark?: unknown }>('/api/school/data?type=school_profile');
    return data ? passMarkOrDefault(data.pass_mark) : PASS_MARK;
}
