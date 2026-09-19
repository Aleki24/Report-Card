'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Form primitives.
 *
 * Every dashboard form used to spell out its own `<label>` + `<input
 * className="input-field w-full">` pair, which is why the spacing
 * drifted: labels sat four pixels off their box and rows were packed tighter
 * than the fields themselves. That vertical rhythm lives here now, so changing
 * it once changes it everywhere.
 */

type Span = 'half' | 'full';

/**
 * Grid placement is opt-in — these components are also used outside a FormGrid.
 *
 * Two columns wait for `md` (769px) rather than `sm` (481px): at 481px a half
 * field is only 200px wide, which is narrower than a phone gets in one column,
 * so the split made the form harder to use rather than easier.
 */
const SPAN: Record<Span, string> = {
    half: 'col-span-2 md:col-span-1',
    full: 'col-span-2',
};

interface FormFieldProps {
    label: string;
    /**
     * Ties the label to its control so clicking the label focuses it and screen
     * readers announce the pair. Pass the same value as the control's `id`.
     */
    htmlFor?: string;
    required?: boolean;
    /** Shown below the control; an `error` replaces it. */
    hint?: string;
    error?: string;
    span?: Span;
    className?: string;
    children: React.ReactNode;
}

export function FormField({
    label,
    htmlFor,
    required,
    hint,
    error,
    span,
    className,
    children,
}: FormFieldProps) {
    return (
        <div className={cn('flex flex-col gap-2', span && SPAN[span], className)}>
            <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
                {label}
                {required && (
                    <span aria-hidden="true" className="ml-0.5 text-destructive">
                        *
                    </span>
                )}
            </label>
            {children}
            {(error || hint) && (
                <p
                    className={cn(
                        'text-[11px] leading-snug',
                        error ? 'text-destructive' : 'text-muted-foreground',
                    )}
                >
                    {error || hint}
                </p>
            )}
        </div>
    );
}

interface FormGridProps {
    className?: string;
    children: React.ReactNode;
}

/**
 * Two columns from `sm` up, one below. The row gap is deliberately larger than
 * the column gap: side-by-side fields read as a pair, stacked ones need the
 * separation.
 */
export function FormGrid({ className, children }: FormGridProps) {
    return <div className={cn('grid grid-cols-2 gap-x-4 gap-y-5', className)}>{children}</div>;
}

export type InputFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
    error?: boolean;
};

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
    ({ error, className, ...props }, ref) => (
        <input
            ref={ref}
            aria-invalid={error || undefined}
            className={cn('input-field w-full', error && 'border-destructive', className)}
            {...props}
        />
    ),
);
InputField.displayName = 'InputField';

export type TextareaFieldProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    error?: boolean;
};

export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
    ({ error, className, rows = 3, ...props }, ref) => (
        <textarea
            ref={ref}
            rows={rows}
            aria-invalid={error || undefined}
            className={cn('input-field w-full', error && 'border-destructive', className)}
            {...props}
        />
    ),
);
TextareaField.displayName = 'TextareaField';

export interface SelectOption {
    id: string;
    label: string;
    disabled?: boolean;
}

export type SelectFieldProps = Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    'onChange' | 'value'
> & {
    value: string;
    /** The selected id, not the event — every caller wanted the id. */
    onChange: (value: string) => void;
    options: readonly SelectOption[];
    /** Label for the empty choice. Pass null to drop it on a required select. */
    placeholder?: string | null;
    error?: boolean;
};

export function SelectField({
    value,
    onChange,
    options,
    placeholder = '— Select —',
    error,
    className,
    ...props
}: SelectFieldProps) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            aria-invalid={error || undefined}
            className={cn('input-field w-full', error && 'border-destructive', className)}
            {...props}
        >
            {placeholder !== null && <option value="">{placeholder}</option>}
            {options.map(opt => (
                <option key={opt.id} value={opt.id} disabled={opt.disabled}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}
