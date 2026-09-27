import React from 'react';
import { Pressable, StyleSheet, Text, View, type KeyboardTypeOptions } from 'react-native';
import { enumLabel, type FieldDef, type FormValues } from '@shared/ops/form';
import { nowLocalInput, today } from '@shared/ops/format';
import { ChipSelect, TextField, ToggleRow } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import { LookupField, SelectField } from './SelectField';

const KEYBOARD: Partial<Record<FieldDef['kind'], KeyboardTypeOptions>> = {
    number: 'decimal-pad',
    numberList: 'numbers-and-punctuation',
    email: 'email-address',
    tel: 'phone-pad',
    date: 'numbers-and-punctuation',
    datetime: 'numbers-and-punctuation',
    time: 'numbers-and-punctuation',
};

const PLACEHOLDER: Partial<Record<FieldDef['kind'], string>> = {
    date: 'YYYY-MM-DD',
    datetime: 'YYYY-MM-DD HH:MM',
    time: 'HH:MM',
};

interface RecordFormProps {
    fields: readonly FieldDef[];
    values: FormValues;
    onChange: (name: string, value: string | boolean) => void;
}

/**
 * Renders the web's declared form fields (`@shared/ops/form`) with phone
 * controls: the same fields, labels, hints and choices as the web form.
 */
export function RecordForm({ fields, values, onChange }: RecordFormProps) {
    return (
        <View>
            {fields.filter((f) => f.kind !== 'hidden').map((field) => {
                const value = values[field.name];
                const text = typeof value === 'string' ? value : '';
                const set = (v: string | boolean) => onChange(field.name, v);
                const label = `${field.label}${field.required ? ' *' : ''}`;

                switch (field.kind) {
                    case 'checkbox':
                        return <ToggleRow key={field.name} label={field.label} description={field.hint} value={value === true} onValueChange={set} />;
                    case 'enum':
                        return (
                            <View key={field.name}>
                                <ChipSelect
                                    label={label}
                                    wrap
                                    value={text || (field.required ? null : '')}
                                    onChange={set}
                                    options={[
                                        ...(field.required ? [] : [{ value: '', label: '—' }]),
                                        ...field.values.map((v) => ({ value: v, label: enumLabel(field, v) })),
                                    ]}
                                />
                                {field.hint ? <Text style={styles.hint}>{field.hint}</Text> : null}
                            </View>
                        );
                    case 'lookup':
                        return <LookupField key={field.name} label={field.label} required={field.required} hint={field.hint} lookup={field.lookup} params={field.params} filter={field.filter} value={text} onChange={set} clearable={!field.required} />;
                    case 'options':
                        return <SelectField key={field.name} label={field.label} required={field.required} hint={field.hint} options={field.options} value={text} onChange={set} clearable={!field.required} />;
                    case 'date':
                    case 'datetime':
                    case 'time': {
                        const isDateTime = field.kind === 'datetime';
                        const quick = field.kind === 'date' ? { label: 'Today', value: today() } : isDateTime ? { label: 'Now', value: nowLocalInput() } : null;
                        return (
                            <View key={field.name}>
                                <TextField
                                    label={label}
                                    value={isDateTime ? text.replace('T', ' ') : text}
                                    onChangeText={(v) => set(isDateTime ? v.trim().replace(' ', 'T') : v)}
                                    placeholder={PLACEHOLDER[field.kind]}
                                    keyboardType={KEYBOARD[field.kind]}
                                    autoCapitalize="none"
                                />
                                <View style={styles.quickRow}>
                                    {field.hint ? <Text style={[styles.hint, { flex: 1 }]}>{field.hint}</Text> : <View style={{ flex: 1 }} />}
                                    {quick ? (
                                        <Pressable onPress={() => set(quick.value)} hitSlop={8}>
                                            <Text style={styles.quick}>{quick.label}</Text>
                                        </Pressable>
                                    ) : null}
                                </View>
                            </View>
                        );
                    }
                    default:
                        return (
                            <View key={field.name}>
                                <TextField
                                    label={label}
                                    value={text}
                                    onChangeText={set}
                                    placeholder={'placeholder' in field ? field.placeholder : undefined}
                                    multiline={field.kind === 'textarea'}
                                    keyboardType={KEYBOARD[field.kind]}
                                    autoCapitalize={field.kind === 'email' ? 'none' : undefined}
                                />
                                {field.hint ? <Text style={[styles.hint, { marginTop: -spacing.sm, marginBottom: spacing.md }]}>{field.hint}</Text> : null}
                            </View>
                        );
                }
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    hint: { fontSize: 11, color: colors.muted, marginBottom: spacing.sm },
    quickRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: -spacing.sm, marginBottom: spacing.md, gap: spacing.sm },
    quick: { fontSize: 12, fontWeight: '700', color: colors.primary },
});
