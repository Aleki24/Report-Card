"use client";

import { CardHeading } from '@/components/ui/CardHeading';
import React, { useId, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Trophy, KeyRound, School, Upload } from 'lucide-react';
import { FormField, InputField } from '@/components/ui';
import { shrinkImageToDataUrl } from '@/lib/client/shrink-image';
import { cn } from '@/lib/utils';
import { SENIOR_RANK_GROUPS, SENIOR_RANK_GROUP_OPTIONS, type SeniorRankGroup } from '@/lib/ranking';

interface SchoolShape {
  id?: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo_url?: string;
  teacher_invite_code?: string;
  student_invite_code?: string;
  min_combination_group_size?: number;
  cbc_ranking_enabled?: boolean;
  senior_rank_group?: SeniorRankGroup;
}

interface SchoolFormProps {
  school: SchoolShape;
  setSchool: React.Dispatch<React.SetStateAction<SchoolShape>>;
}

function InviteCodeCard({ label, code, tone }: { label: string; code?: string; tone: 'good' | 'info' }) {
  const [copied, setCopied] = useState(false);
  const token = tone === 'good' ? 'var(--viz-good)' : 'var(--viz-info)';
  const has = Boolean(code);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Could not copy — select the code and copy manually.');
    }
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${token} 30%, transparent)`,
        background: `color-mix(in srgb, ${token} 7%, transparent)`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-xs font-semibold" style={{ color: token }}>{label}</label>
        <button
          type="button"
          onClick={copy}
          disabled={!has}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-foreground/5 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: token }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <input
        className="w-full bg-transparent font-mono text-base tracking-widest outline-none text-foreground"
        readOnly
        value={code || 'Not generated yet'}
        onClick={(e) => (e.target as HTMLInputElement).select()}
      />
    </div>
  );
}

export function SchoolForm({ school, setSchool }: SchoolFormProps) {
  const id = useId();
  const [processing, setProcessing] = useState(false);
  const set = (key: 'name' | 'address' | 'phone' | 'email', value: string) => setSchool(prev => ({ ...prev, [key]: value }));

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choose an image file (PNG or JPG).'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('That image is over 8 MB. Choose a smaller one.'); return; }
    setProcessing(true);
    try {
      // Stored inline for report-card PDFs, so it is shrunk first.
      const logo = await shrinkImageToDataUrl(file);
      setSchool(prev => ({ ...prev, logo_url: logo }));
    } catch {
      toast.error('Could not read that image. Try a PNG or JPG.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-4 rounded-2xl bg-muted/40 p-4 sm:flex-row sm:items-center">
        {school.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL, not a static asset
          <img src={school.logo_url} alt="School logo" className="size-20 shrink-0 rounded-xl border border-border bg-card object-contain" />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-border bg-amber-500/10 text-amber-600 dark:text-amber-400" aria-hidden><School className="size-9" /></div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">School logo</p>
          <p className="mb-3 text-xs text-muted-foreground">Printed on report cards and receipts. A square PNG with a clear background works best.</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-secondary h-9 cursor-pointer text-xs">
              <Upload className="size-3.5" aria-hidden />{processing ? 'Processing…' : school.logo_url ? 'Change logo' : 'Upload logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={processing} onChange={e => void handleLogoUpload(e)} />
            </label>
            {school.logo_url && (
              <button type="button" className="text-xs font-medium text-destructive hover:underline" onClick={() => setSchool(prev => ({ ...prev, logo_url: '' }))}>Remove</button>
            )}
          </div>
        </div>
      </div>

      <FormField label="School name" required htmlFor={`${id}-name`}>
        <InputField id={`${id}-name`} value={school.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sunrise Academy" maxLength={150} required />
      </FormField>
      <FormField label="Address" htmlFor={`${id}-address`}>
        <InputField id={`${id}-address`} value={school.address} onChange={e => set('address', e.target.value)} placeholder="e.g. P.O. Box 123, Nairobi" maxLength={300} />
      </FormField>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField label="Phone" htmlFor={`${id}-phone`}>
          <InputField id={`${id}-phone`} type="tel" inputMode="tel" value={school.phone} onChange={e => set('phone', e.target.value)} placeholder="e.g. 0700 000 000" maxLength={30} />
        </FormField>
        <FormField label="Email" htmlFor={`${id}-email`}>
          <InputField id={`${id}-email`} type="email" value={school.email} onChange={e => set('email', e.target.value)} placeholder="e.g. info@school.ac.ke" maxLength={200} />
        </FormField>
      </div>
      <FormField
        label="Minimum learners per subject combination"
        htmlFor={`${id}-min`}
        hint="CBC Senior School. The Ministry default is 15: a combination with at least this many learners gets its own report document when class reports are split by combination."
      >
        <InputField
          id={`${id}-min`}
          className="sm:w-40"
          type="number"
          min={1}
          max={200}
          value={school.min_combination_group_size ?? 15}
          onChange={e => { const v = parseInt(e.target.value, 10); setSchool(prev => ({ ...prev, min_combination_group_size: Number.isNaN(v) ? undefined : v })); }}
        />
      </FormField>

      <RankingSettings school={school} setSchool={setSchool} />

      {/* Invite Codes */}
      <div className="mt-8 border-t border-border pt-6">
        <CardHeading icon={KeyRound} hue="amber" title="Invite codes" description="Share these codes with teachers and students so they can join your school during signup." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
          <InviteCodeCard label="Teacher Invite Code" code={school.teacher_invite_code} tone="good" />
          <InviteCodeCard label="Student Invite Code" code={school.student_invite_code} tone="info" />
        </div>
      </div>
    </div>
  );
}

/** Whether CBC cards print positions, and who Senior School learners are ranked against. */
function RankingSettings({ school, setSchool }: SchoolFormProps) {
  const enabled = school.cbc_ranking_enabled ?? false;
  const group = school.senior_rank_group ?? 'GRADE';

  return (
    <fieldset className="mt-8 border-t border-border pt-6">
      <legend className="sr-only">Report card positions</legend>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
        <Trophy size={16} className="text-primary" aria-hidden /> Report card positions
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        8-4-4 report cards always show positions: in the stream, and overall across every stream of the form.
        KNEC does not rank CBC learners (KPSEA and KJSEA report performance levels, not positions), so CBC cards show
        no positions unless you switch them on.
      </p>

      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border p-4">
        <span>
          <span className="block text-sm font-medium">Show positions on CBC report cards</span>
          <span className="block text-xs text-muted-foreground">Stream position, plus an overall position across all streams of the grade.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="mt-1 size-5 shrink-0 accent-primary"
          checked={enabled}
          onChange={e => setSchool(prev => ({ ...prev, cbc_ranking_enabled: e.target.checked }))}
        />
      </label>

      {enabled && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Senior School (Grades 10–12): rank learners</p>
          <div className="grid gap-2" role="radiogroup" aria-label="Senior School ranking group">
            {SENIOR_RANK_GROUPS.map(value => {
              const option = SENIOR_RANK_GROUP_OPTIONS[value];
              const checked = group === value;
              return (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors',
                    checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name="senior_rank_group"
                      className="size-4 accent-primary"
                      value={value}
                      checked={checked}
                      onChange={() => setSchool(prev => ({ ...prev, senior_rank_group: value }))}
                    />
                    {option.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </fieldset>
  );
}
