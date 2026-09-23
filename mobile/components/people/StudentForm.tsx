import React, { useState } from 'react';
import { Text } from 'react-native';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import { Button, ButtonRow, Card, ChipSelect, ErrorBanner, TextField } from '@/components/ui';
import type { GradeStream } from '@/lib/types';

export const STUDENT_STATUSES = ['ACTIVE', 'TRANSFERRED', 'GRADUATED', 'DEACTIVATED'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export interface StudentFormValues {
    first_name: string;
    last_name: string;
    admission_number: string;
    gender: string;
    date_of_birth: string;
    grade_stream_id: string | null;
    guardian_name: string;
    guardian_phone: string;
    guardian_email: string;
    status: StudentStatus;
}

export const EMPTY_STUDENT: StudentFormValues = {
    first_name: '',
    last_name: '',
    admission_number: '',
    gender: '',
    date_of_birth: '',
    grade_stream_id: null,
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    status: 'ACTIVE',
};

export interface AddStudentResult {
    name: string;
    username?: string;
    invite_code?: string;
}

/** Same checks the web runs before saving, so bad data can't silently break SMS later. */
function validate(v: StudentFormValues): string | null {
    if (!v.first_name.trim() || !v.last_name.trim()) return 'First and last name are required.';
    const name = v.guardian_name.trim();
    if (name && /^[\d\s\-+()]+$/.test(name) && name.replace(/\D/g, '').length >= 7) {
        return 'Guardian name looks like a phone number — put the number in Guardian phone instead.';
    }
    if (v.guardian_phone.trim()) {
        const digits = v.guardian_phone.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 12) return "Guardian phone doesn't look right. Use a format like 0712345678.";
    }
    if (v.date_of_birth.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(v.date_of_birth.trim())) return 'Date of birth must be YYYY-MM-DD.';
    return null;
}

const blankToNull = (s: string) => (s.trim() ? s.trim() : null);

export function StudentForm({
    studentId,
    initial,
    streams,
    onSaved,
    onCancel,
}: {
    /** Present when editing an existing student. */
    studentId?: string;
    initial: StudentFormValues;
    streams: readonly GradeStream[];
    onSaved: (result: AddStudentResult) => void;
    onCancel: () => void;
}) {
    const api = useApi();
    const [v, setV] = useState<StudentFormValues>(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const set = <K extends keyof StudentFormValues>(key: K, value: StudentFormValues[K]) => setV((prev) => ({ ...prev, [key]: value }));

    const save = async () => {
        const problem = validate(v);
        if (problem) {
            setError(problem);
            return;
        }
        const stream = streams.find((s) => s.id === v.grade_stream_id);
        const common = {
            first_name: v.first_name.trim(),
            last_name: v.last_name.trim(),
            admission_number: blankToNull(v.admission_number),
            gender: blankToNull(v.gender),
            date_of_birth: blankToNull(v.date_of_birth),
            grade_stream_id: v.grade_stream_id,
            guardian_name: blankToNull(v.guardian_name),
            guardian_phone: blankToNull(v.guardian_phone),
            guardian_email: blankToNull(v.guardian_email),
        };
        setSaving(true);
        setError(null);
        try {
            if (studentId) {
                await api.patch('/api/admin/update-student', { ...common, student_id: studentId, status: v.status });
                onSaved({ name: `${common.first_name} ${common.last_name}` });
            } else {
                const academicLevelId = stream?.grades?.academic_level_id;
                if (!academicLevelId) throw new Error('Choose a class so the curriculum is known.');
                const res = await api.post<Omit<AddStudentResult, 'name'>>('/api/admin/add-student', { ...common, academic_level_id: academicLevelId });
                onSaved({ ...res, name: `${common.first_name} ${common.last_name}` });
            }
        } catch (err) {
            setError(errorMessage(err, 'Failed to save the student'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card style={{ marginBottom: spacing.lg }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.foreground, marginBottom: spacing.md }}>{studentId ? 'Edit student' : 'Add student'}</Text>
            {error ? <ErrorBanner message={error} /> : null}
            <TextField label="First name" value={v.first_name} onChangeText={(t) => set('first_name', t)} autoCapitalize="words" />
            <TextField label="Last name" value={v.last_name} onChangeText={(t) => set('last_name', t)} autoCapitalize="words" />
            <TextField label="Admission number" value={v.admission_number} onChangeText={(t) => set('admission_number', t)} autoCapitalize="characters" />
            <ChipSelect label="Class" options={streams.map((s) => ({ value: s.id, label: s.full_name }))} value={v.grade_stream_id} onChange={(id) => set('grade_stream_id', id)} />
            <ChipSelect
                label="Gender"
                options={[
                    { value: 'MALE', label: 'Male' },
                    { value: 'FEMALE', label: 'Female' },
                ]}
                value={v.gender || null}
                onChange={(g) => set('gender', g)}
            />
            <TextField label="Date of birth (YYYY-MM-DD)" value={v.date_of_birth} onChangeText={(t) => set('date_of_birth', t)} />
            <TextField label="Guardian name" value={v.guardian_name} onChangeText={(t) => set('guardian_name', t)} autoCapitalize="words" />
            <TextField label="Guardian phone" value={v.guardian_phone} onChangeText={(t) => set('guardian_phone', t)} keyboardType="phone-pad" placeholder="0712345678" />
            <TextField label="Guardian email" value={v.guardian_email} onChangeText={(t) => set('guardian_email', t)} keyboardType="email-address" autoCapitalize="none" />
            {studentId ? (
                <ChipSelect label="Status" wrap options={STUDENT_STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} value={v.status} onChange={(s) => set('status', s)} />
            ) : null}
            <ButtonRow>
                <Button variant="secondary" label="Cancel" onPress={onCancel} />
                <Button label={studentId ? 'Save' : 'Add student'} onPress={save} loading={saving} />
            </ButtonRow>
        </Card>
    );
}
