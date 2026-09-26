"use client";

import Link from 'next/link';
import React, { useId, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, FileSignature, KeyRound, PenLine, School, Trophy, Upload, type LucideIcon } from 'lucide-react';
import { CardHeading } from '@/components/ui/CardHeading';
import { FormField, InputField } from '@/components/ui';
import { shrinkImageToDataUrl } from '@/lib/client/shrink-image';
import { PASS_MARK, PASS_MARK_MAX, PASS_MARK_MIN } from '@/lib/pass-mark';
import { cn } from '@/lib/utils';
import { SENIOR_RANK_GROUPS, SENIOR_RANK_GROUP_OPTIONS, type SeniorRankGroup } from '@/lib/ranking';

/** The school row as the Settings profile tab edits it. */
export interface SchoolProfile {
  id?: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo_url?: string;
  motto: string;
  principal_name: string;
  principal_signature_url?: string;
  /** Empty while the admin is mid-edit; saved as the default when left blank. */
  pass_mark: number | null;
  min_combination_group_size?: number;
  overall_grading_system_id?: string | null;
  cbc_ranking_enabled?: boolean;
  senior_rank_group?: SeniorRankGroup;
}

interface SchoolFormProps {
  school: SchoolProfile;
  setSchool: React.Dispatch<React.SetStateAction<SchoolProfile>>;
}

type TextKey = 'name' | 'address' | 'phone' | 'email' | 'motto' | 'principal_name';
type ImageKey = 'logo_url' | 'principal_signature_url';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * An image the school stores inline for its PDFs: a preview, an upload button
 * and a remove link. Uploads are shrunk in the browser before they are kept.
 */
function ImageUploadRow({ label, description, value, onChange, fallbackIcon: Fallback, maxSide, previewClassName }: {
  label: string;
  description: string;
  value?: string;
  onChange: (next: string) => void;
  fallbackIcon: LucideIcon;
  maxSide: number;
  previewClassName: string;
}) {
  const [processing, setProcessing] = useState(false);
  const noun = label.toLowerCase();

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choose an image file (PNG or JPG).'); return; }
    if (file.size > MAX_UPLOAD_BYTES) { toast.error('That image is over 8 MB. Choose a smaller one.'); return; }
    setProcessing(true);
    try {
      onChange(await shrinkImageToDataUrl(file, maxSide));
    } catch {
      toast.error('Could not read that image. Try a PNG or JPG.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl bg-muted/40 p-4 sm:flex-row sm:items-center">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL, not a static asset
        <img src={value} alt={label} className={cn('shrink-0 rounded-xl border border-border bg-white object-contain', previewClassName)} />
      ) : (
        <div className={cn('flex shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-card text-muted-foreground', previewClassName)} aria-hidden>
          <Fallback className="size-8" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mb-3 text-xs text-muted-foreground">{description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-secondary h-9 cursor-pointer text-xs">
            <Upload className="size-3.5" aria-hidden />{processing ? 'Processing…' : value ? `Change ${noun}` : `Upload ${noun}`}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={processing} onChange={e => void upload(e)} />
          </label>
          {value && (
            <button type="button" className="text-xs font-medium text-destructive hover:underline" onClick={() => onChange('')}>Remove</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A titled block of the profile form, divided from the one above. */
function FormSection({ icon, hue, title, description, children }: {
  icon: LucideIcon;
  hue: 'amber' | 'violet' | 'emerald';
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-border pt-6">
      <CardHeading icon={icon} hue={hue} title={title} description={description} />
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function SchoolForm({ school, setSchool }: SchoolFormProps) {
  const id = useId();
  const set = (key: TextKey, value: string) => setSchool(prev => ({ ...prev, [key]: value }));
  const setImage = (key: ImageKey) => (value: string) => setSchool(prev => ({ ...prev, [key]: value }));
  const passMarkInvalid = school.pass_mark != null && (school.pass_mark < PASS_MARK_MIN || school.pass_mark > PASS_MARK_MAX);

  return (
    <div className="space-y-5">
      <ImageUploadRow
        label="Logo"
        description="Printed on report cards and receipts. A square PNG with a clear background works best."
        value={school.logo_url}
        onChange={setImage('logo_url')}
        fallbackIcon={School}
        maxSide={320}
        previewClassName="size-20"
      />

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

      <FormSection icon={FileSignature} hue="violet" title="Report cards" description="What every report card prints besides the results.">
        <FormField label="School motto" htmlFor={`${id}-motto`} hint="Printed under the school name.">
          <InputField id={`${id}-motto`} value={school.motto} onChange={e => set('motto', e.target.value)} placeholder="e.g. Strive to excel" maxLength={120} />
        </FormField>
        <FormField label="Principal's name" htmlFor={`${id}-principal`} hint="Printed on the principal's signature line.">
          <InputField id={`${id}-principal`} value={school.principal_name} onChange={e => set('principal_name', e.target.value)} placeholder="e.g. Mrs. Jane Wanjiku" maxLength={100} />
        </FormField>
        <ImageUploadRow
          label="Signature"
          description="The principal's signature, laid over their signature line so cards come out signed. Sign on white paper and photograph it close up."
          value={school.principal_signature_url}
          onChange={setImage('principal_signature_url')}
          fallbackIcon={PenLine}
          maxSide={480}
          previewClassName="h-16 w-40"
        />
        <FormField
          label="Pass mark (%)"
          htmlFor={`${id}-pass`}
          hint={`A mark at or above this counts as a pass in pass rates on the dashboard and in Analytics. Leave blank for ${PASS_MARK}%.`}
          error={passMarkInvalid ? `Enter a mark from ${PASS_MARK_MIN} to ${PASS_MARK_MAX}.` : undefined}
        >
          <InputField
            id={`${id}-pass`}
            className="sm:w-40"
            type="number"
            inputMode="decimal"
            min={PASS_MARK_MIN}
            max={PASS_MARK_MAX}
            step="any"
            value={school.pass_mark ?? ''}
            placeholder={String(PASS_MARK)}
            onChange={e => { const v = parseFloat(e.target.value); setSchool(prev => ({ ...prev, pass_mark: Number.isNaN(v) ? null : v })); }}
          />
        </FormField>
      </FormSection>

      <FormSection icon={School} hue="emerald" title="CBC Senior School" description="How subject combinations are grouped on class reports.">
        <FormField
          label="Minimum learners per subject combination"
          htmlFor={`${id}-min`}
          hint="The Ministry default is 15: a combination with at least this many learners gets its own report document when class reports are split by combination."
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
      </FormSection>

      <RankingSettings school={school} setSchool={setSchool} />

      <FormSection icon={KeyRound} hue="amber" title="Invite codes" description="Each teacher and learner gets a personal code when you add them, so a code can only open the account it was made for.">
        <Link
          href="/dashboard/people"
          className="group flex items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm transition-colors hover:border-primary"
        >
          <span className="min-w-0">
            <span className="block font-medium">Issue, resend and print codes on the People page</span>
            <span className="block text-xs text-muted-foreground">Print a class&apos;s codes in one go from there.</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      </FormSection>
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
