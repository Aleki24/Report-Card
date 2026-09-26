"use client";

import { useEffect, useState } from 'react';
import { PASS_MARK, passMarkOrDefault } from '@/lib/pass-mark';

/** One request per page load, shared by every component that asks. */
let request: Promise<number> | null = null;

function loadPassMark(): Promise<number> {
    request ??= fetch('/api/school/data?type=school_profile')
        .then(res => (res.ok ? res.json() : null))
        .then((json: { data?: { pass_mark?: unknown } } | null) => passMarkOrDefault(json?.data?.pass_mark))
        .catch(() => {
            request = null; // let a later mount try again
            return PASS_MARK;
        });
    return request;
}

/**
 * The school's pass mark, set in Settings. Every role can read it, so a
 * learner's results and a teacher's exam analysis colour a pass the same way
 * the admin's dashboard counts one. The default until it loads.
 */
export function useSchoolPassMark(): number {
    const [passMark, setPassMark] = useState(PASS_MARK);
    useEffect(() => {
        let active = true;
        void loadPassMark().then(value => { if (active) setPassMark(value); });
        return () => { active = false; };
    }, []);
    return passMark;
}
