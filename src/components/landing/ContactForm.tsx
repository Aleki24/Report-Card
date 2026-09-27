"use client";

import { useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { FormField, FormGrid, InputField, TextareaField } from '@/components/ui/FormField';
import { contactSchema, type ContactField, type ContactInput } from '@/lib/contact';

const EMPTY: Required<ContactInput> = { name: '', email: '', schoolName: '', message: '' };

type Errors = Partial<Record<ContactField, string>>;

/** The public contact form: validated in place, with a clear sent state. */
export function ContactForm() {
  const [values, setValues] = useState<Required<ContactInput>>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (field: ContactField) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues(v => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = contactSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as ContactField;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? 'We couldn’t send your message. Please try again.');
        return;
      }
      setValues(EMPTY);
      setSent(true);
    } catch {
      setFormError('You seem to be offline. Try again, or email us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <p className="font-heading text-lg font-bold text-foreground">Message sent</p>
        <p className="max-w-sm text-sm text-muted-foreground">Thanks for reaching out. We usually reply within one working day.</p>
        <button type="button" className="btn-secondary mt-2" onClick={() => setSent(false)}>Send another message</button>
      </div>
    );
  }

  const field = (name: ContactField) => ({
    id: `contact-${name}`,
    value: values[name],
    onChange: set(name),
    error: Boolean(errors[name]),
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {formError && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{formError}</p>
      )}
      <FormGrid>
        <FormField label="Full name" htmlFor="contact-name" required error={errors.name} span="half">
          <InputField {...field('name')} autoComplete="name" placeholder="John Kamau" maxLength={120} />
        </FormField>
        <FormField label="Email address" htmlFor="contact-email" required error={errors.email} span="half">
          <InputField {...field('email')} type="email" autoComplete="email" placeholder="john@school.ac.ke" maxLength={200} />
        </FormField>
        <FormField label="School name" htmlFor="contact-schoolName" error={errors.schoolName} span="full">
          <InputField {...field('schoolName')} autoComplete="organization" placeholder="Nairobi Academy" maxLength={160} />
        </FormField>
        <FormField label="Message" htmlFor="contact-message" required error={errors.message} hint="Tell us about your school and what you need." span="full">
          <TextareaField {...field('message')} rows={6} className="resize-y" maxLength={4000} />
        </FormField>
      </FormGrid>
      <button type="submit" className="btn-primary w-full sm:w-fit" disabled={submitting}>
        {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {submitting ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
