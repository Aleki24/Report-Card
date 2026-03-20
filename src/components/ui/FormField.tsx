'use client';

import React from 'react';

interface FormFieldProps {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}

export function FormField({ label, required, error, hint, children }: FormFieldProps) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)]">
                {label}
                {required && <span className="text-[var(--color-danger)] ml-1">*</span>}
            </label>
            {children}
            {hint && !error && <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>}
            {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        </div>
    );
}

interface SelectOption {
    id: string;
    label: string;
    disabled?: boolean;
}

interface SelectFieldProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function SelectField({ value, onChange, options, placeholder, disabled, className = '' }: SelectFieldProps) {
    return (
        <select
            className={`input-field w-full ${className}`}
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
        >
            <option value="">{placeholder || '-- Select --'}</option>
            {options.map(opt => (
                <option key={opt.id} value={opt.id} disabled={opt.disabled}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
}

export function InputField({ error, className = '', ...props }: InputFieldProps) {
    return (
        <input
            className={`input-field w-full ${error ? 'border-[var(--color-danger)]' : ''} ${className}`}
            {...props}
        />
    );
}
