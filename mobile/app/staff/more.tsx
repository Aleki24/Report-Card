import React from 'react';
import { useCurrentUser } from '@/lib/UserContext';
import { STAFF_SCREENS, getStaffNav } from '@/lib/roles';
import { MoreList } from '@/components/nav';

/** Everything the role and duties can open that isn't on the tab bar — the web's "More" sheet. */
export default function MoreScreen() {
    const { viewer } = useCurrentUser();
    const { overflow } = getStaffNav(viewer);
    return <MoreList description="Everything else your role and duties can open." items={overflow.map((name) => ({ key: name, ...STAFF_SCREENS[name] }))} />;
}
