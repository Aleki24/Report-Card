import React from 'react';
import { useCurrentUser } from '@/lib/UserContext';
import { STUDENT_SCREENS, getStudentNav } from '@/lib/roles';
import { MoreList } from '@/components/nav';

export default function StudentMoreScreen() {
    const { viewer } = useCurrentUser();
    const { overflow } = getStudentNav(viewer);
    return <MoreList items={overflow.map((name) => ({ key: name, ...STUDENT_SCREENS[name] }))} />;
}
