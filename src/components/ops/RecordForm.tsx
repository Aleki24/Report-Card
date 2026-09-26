"use client";

import React from 'react';
import { FormField, FormGrid, InputField, SelectField, TextareaField } from '@/components/ui/FormField';
import { LookupSelect, SearchableSelect } from './SearchableSelect';
import { enumLabel, type FieldDef, type FormValues } from './fields';

const INPUT_TYPE = { text: 'text', number: 'number', date: 'date', datetime: 'datetime-local', time: 'time', email: 'email', tel: 'tel' } as const;

interface RecordFormProps {
    fields: readonly FieldDef[];
    values: FormValues;
    onChange: (name: string, value: string | boolean) => void;
    idPrefix: string;
}

/** Renders declared fields in the app's two-column form grid. */
export function RecordForm({ fields, values, onChange, idPrefix }: RecordFormProps) {
    return (
        <FormGrid>
            {fields.map(field => {
                const id = `${idPrefix}-${field.name}`;
                const value = values[field.name];
                const text = typeof value === 'string' ? value : '';
                const set = (v: string | boolean) => onChange(field.name, v);
                const span = field.span ?? (field.kind === 'textarea' ? 'full' : 'half');

                if (field.kind === 'checkbox') {
                    return (
                        <label key={field.name} htmlFor={id} className="col-span-2 flex items-center gap-2.5 text-sm text-foreground @xl:col-span-1 @xl:self-end @xl:pb-2">
                            <input id={id} type="checkbox" checked={value === true} onChange={e => set(e.target.checked)} className="size-4 accent-primary" />
                            {field.label}
                        </label>
                    );
                }

                let control: React.ReactNode;
                switch (field.kind) {
                    case 'textarea':
                        control = <TextareaField id={id} value={text} onChange={e => set(e.target.value)} rows={3} />;
                        break;
                    case 'enum':
                        control = (
                            <SelectField
                                id={id}
                                value={text}
                                onChange={set}
                                placeholder={field.required ? null : '—'}
                                options={field.values.map(v => ({ id: v, label: enumLabel(field, v) }))}
                            />
                        );
                        break;
                    case 'lookup':
                        control = <LookupSelect id={id} lookup={field.lookup} params={field.params} filter={field.filter} value={text} onChange={set} clearable={!field.required} />;
                        break;
                    case 'options':
                        control = <SearchableSelect id={id} options={field.options} value={text} onChange={set} clearable={!field.required} />;
                        break;
                    case 'numberList':
                        control = <InputField id={id} inputMode="decimal" value={text} placeholder={field.placeholder} onChange={e => set(e.target.value)} />;
                        break;
                    default:
                        control = (
                            <InputField
                                id={id}
                                type={INPUT_TYPE[field.kind]}
                                step={field.kind === 'number' ? field.step ?? 'any' : undefined}
                                inputMode={field.kind === 'number' ? 'decimal' : undefined}
                                placeholder={field.placeholder}
                                value={text}
                                onChange={e => set(e.target.value)}
                            />
                        );
                }

                return (
                    <FormField key={field.name} label={field.label} htmlFor={id} required={field.required} hint={field.hint} span={span}>
                        {control}
                    </FormField>
                );
            })}
        </FormGrid>
    );
}
