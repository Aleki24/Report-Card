"use client";

import React, { useMemo, useState } from 'react';
import { Heart, Mail, MessageSquare, Phone, PhoneOff, Users } from 'lucide-react';
import { StatFilterTile } from '@/components/ui';
import { StatusBadge, UserAvatar } from '@/components/users/UserBadges';
import { humanize } from '@/components/users/userMeta';
import { useJsonList } from '@/hooks/useJsonList';
import type { ParentContact } from '@/lib/guardians';
import { LoadError, NoMatches, ResultCount, SearchBox, Toolbar } from './PeopleUi';
import { admNoLabel } from './peopleTypes';

type Reach = 'ALL' | 'SIBLINGS' | 'NO_PHONE' | 'EMAIL';

const REACH_TEST: Record<Reach, (p: ParentContact) => boolean> = {
  ALL: () => true,
  SIBLINGS: p => p.students.length > 1,
  NO_PHONE: p => !p.phone,
  EMAIL: p => !!p.email,
};

const PAGE = 30;

function ParentCard({ parent }: { parent: ParentContact }) {
  const [first = '', ...rest] = parent.name.split(/\s+/);
  const children = parent.students.length;
  return (
    <li className="flex flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-500/30 hover:shadow-md">
      <div className="flex items-start gap-3">
        <UserAvatar firstName={first} lastName={rest.join(' ')} role="PENDING" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-tight">{parent.name}</h3>
          <p className={parent.phone ? 'truncate text-xs text-muted-foreground' : 'text-xs font-medium text-amber-600 dark:text-amber-400'}>{parent.phone || 'No phone — no SMS'}</p>
          {parent.email && <p className="truncate text-xs text-muted-foreground">{parent.email}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-rose-500/12 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
          {children} {children === 1 ? 'child' : 'children'}
        </span>
      </div>

      <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
        {parent.students.map(s => (
          <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{s.first_name} {s.last_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{s.grade_stream?.full_name || 'No class'} · {admNoLabel(s.admission_number)}</p>
            </div>
            <StatusBadge active={s.status === 'ACTIVE'} label={humanize(s.status)} />
          </li>
        ))}
      </ul>

      {(parent.phone || parent.email) && (
        <div className="mt-auto flex gap-2 pt-4">
          {parent.phone && (
            <>
              <a href={`tel:${parent.phone}`} className="btn-secondary h-9 flex-1 text-xs" aria-label={`Call ${parent.name}`}><Phone className="size-3.5" aria-hidden="true" />Call</a>
              <a href={`sms:${parent.phone}`} className="btn-secondary h-9 flex-1 text-xs" aria-label={`Text ${parent.name}`}><MessageSquare className="size-3.5" aria-hidden="true" />SMS</a>
            </>
          )}
          {parent.email && <a href={`mailto:${parent.email}`} className="btn-secondary h-9 flex-1 text-xs" aria-label={`Email ${parent.name}`}><Mail className="size-3.5" aria-hidden="true" />Email</a>}
        </div>
      )}
    </li>
  );
}

export function ParentsSection() {
  const parents = useJsonList<ParentContact>('/api/school/data?type=parents', 'Could not load parents.');
  const [search, setSearch] = useState('');
  const [reach, setReach] = useState<Reach>('ALL');
  const [limit, setLimit] = useState(PAGE);

  const all = parents.rows;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return all.filter(p =>
      REACH_TEST[reach](p)
      && (!q
        || p.name.toLowerCase().includes(q)
        || p.email.toLowerCase().includes(q)
        || (digits.length >= 3 && p.phone.replace(/\D/g, '').includes(digits))
        || p.students.some(s => `${s.first_name} ${s.last_name} ${s.admission_number ?? ''}`.toLowerCase().includes(q))));
  }, [all, search, reach]);

  const stats = useMemo(() => ({
    total: all.length,
    siblings: all.filter(REACH_TEST.SIBLINGS).length,
    noPhone: all.filter(REACH_TEST.NO_PHONE).length,
    email: all.filter(REACH_TEST.EMAIL).length,
  }), [all]);

  if (parents.error) return <LoadError title="Couldn't load parents" message={parents.error} onRetry={parents.retry} />;

  const choose = (next: Reach) => () => { setReach(next); setSearch(''); setLimit(PAGE); };
  const tiles = [
    { key: 'all', icon: Heart, hue: 'rose', label: 'Parents', value: stats.total, hint: 'guardian contacts', selected: reach === 'ALL' && !search, onClick: choose('ALL') },
    { key: 'siblings', icon: Users, hue: 'orange', label: 'Several children', value: stats.siblings, hint: 'siblings in school', selected: reach === 'SIBLINGS', onClick: choose('SIBLINGS') },
    { key: 'nophone', icon: PhoneOff, hue: 'amber', label: 'No phone', value: stats.noPhone, hint: "can't get SMS", selected: reach === 'NO_PHONE', onClick: choose('NO_PHONE') },
    { key: 'email', icon: Mail, hue: 'sky', label: 'With email', value: stats.email, hint: 'reachable by email', selected: reach === 'EMAIL', onClick: choose('EMAIL') },
  ] as const;

  const shown = filtered.slice(0, limit);

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {tiles.map(({ key, ...tile }) => <StatFilterTile key={key} loading={parents.loading} {...tile} />)}
      </div>

      <Toolbar label="Parent filters">
        <SearchBox value={search} onChange={v => { setSearch(v); setLimit(PAGE); }} placeholder="Search parent, phone, email or child" />
      </Toolbar>

      {parents.loading ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => <li key={i} className="skeleton-bone h-48 rounded-2xl" />)}
        </ul>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card">
          {all.length === 0
            ? <NoMatches hue="rose" icon={<Heart className="size-6" />} title="No parents yet" description="Guardian details added to students appear here, one card per guardian." />
            : <NoMatches hue="rose" icon={<Heart className="size-6" />} title="No parents match" description="Nobody matches that search." onClear={choose('ALL')} />}
        </div>
      ) : (
        <>
          <ResultCount shown={filtered.length} total={all.length} noun={all.length === 1 ? 'parent' : 'parents'} />
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map(p => <ParentCard key={p.id} parent={p} />)}
          </ul>
          {filtered.length > shown.length && (
            <div className="mt-5 flex justify-center">
              <button type="button" className="btn-secondary" onClick={() => setLimit(l => l + PAGE)}>
                Show more ({(filtered.length - shown.length).toLocaleString()} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
