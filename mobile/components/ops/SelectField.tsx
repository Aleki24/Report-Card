import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import type { LookupOption, LookupType } from '@shared/ops/lookups';
import { PickerField } from '@/components/Choice';
import { useLookup } from '@/lib/ops';
import { spacing, fonts, makeStyles } from '@/lib/theme';

interface SelectFieldProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly LookupOption[];
    placeholder?: string;
    loading?: boolean;
    /** Offer a "None" row (optional fields). */
    clearable?: boolean;
    required?: boolean;
    hint?: string;
}

/**
 * A picker you can search: schools have hundreds of learners, and scrolling
 * a list of 900 names is unusable. The option sheet adds a search box to
 * long lists.
 */
export function SelectField({ label, value, onChange, options, placeholder = 'Select…', loading, clearable, required, hint }: SelectFieldProps) {
    const styles = useStyles();
    const choices = useMemo(() => {
        const mapped = options.map((o) => ({ value: o.id, label: o.label, hint: o.hint }));
        return clearable ? [{ value: '', label: 'None' }, ...mapped] : mapped;
    }, [options, clearable]);
    return (
        <View style={styles.field}>
            <PickerField
                compact
                label={label ? `${label}${required ? ' *' : ''}` : undefined}
                options={choices}
                value={value || null}
                onChange={onChange}
                placeholder={loading ? 'Loading…' : placeholder}
            />
            {hint && !options.find((o) => o.id === value)?.hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
    );
}

/** A SelectField fed by `/api/ops/lookups` (learners, staff, classes, subjects, terms…). */
export function LookupField({ lookup, params, filter, ...rest }: Omit<SelectFieldProps, 'options' | 'loading'> & {
    lookup: LookupType;
    params?: Record<string, string | undefined>;
    filter?: (o: LookupOption) => boolean;
}) {
    const { options, loading } = useLookup(lookup, params);
    const shown = useMemo(() => (filter ? options.filter(filter) : options), [options, filter]);
    return <SelectField {...rest} options={shown} loading={loading} />;
}

const useStyles = makeStyles((colors) => ({
    field: { marginBottom: spacing.md },
    hint: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 4 },
}));
