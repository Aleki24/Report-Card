import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import {
    CLASS_TEACHER_URL,
    type ClassTeacherCandidate,
    type ClassTeacherCandidates,
    type SetClassTeacherRequest,
} from '@shared/class-teacher';
import type { ClassSummary } from '@shared/classes-overview';
import type { LookupOption } from '@shared/ops/lookups';
import { FormSheet } from '@/components/ops/FormSheet';
import { SelectField } from '@/components/ops/SelectField';
import { useApi } from '@/lib/api';
import { sendConfirmingReplace } from '@/lib/classTeacher';
import { askConfirm } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';
import { fonts, makeStyles, spacing } from '@/lib/theme';
import { useApiQuery } from '@/lib/useApiQuery';

function teacherHint(t: ClassTeacherCandidate, classId: string): string {
    if (t.class_id === classId) return 'Class teacher of this class';
    return t.class_name ? `Class teacher of ${t.class_name}` : 'No class yet';
}

/**
 * Gives one class a new class teacher in a single step: the old one becomes
 * a subject teacher, and a teacher picked from another class moves here. The
 * server says what will change and the admin confirms before it happens.
 */
export function ChangeClassTeacherSheet({ cls, onClose, onChanged }: {
    cls: ClassSummary;
    onClose: () => void;
    /** After a change, with what changed to tell the admin. */
    onChanged: (message: string) => void;
}) {
    const styles = useStyles();
    const api = useApi();
    const candidates = useApiQuery<ClassTeacherCandidates>(CLASS_TEACHER_URL);
    const teachers = useMemo(() => candidates.data?.teachers ?? [], [candidates.data]);
    const holder = teachers.find((t) => t.class_id === cls.id) ?? null;
    // null until the admin picks; '' is "no class teacher".
    const [picked, setPicked] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const chosen = picked ?? holder?.id ?? '';
    const options = useMemo<LookupOption[]>(
        () => teachers.map((t) => ({ id: t.id, label: t.name, hint: teacherHint(t, cls.id) })),
        [teachers, cls.id],
    );

    const save = async () => {
        if (chosen === (holder?.id ?? '')) return onClose();
        const teacher = teachers.find((t) => t.id === chosen) ?? null;
        if (!teacher && holder && !(await askConfirm(
            'Remove class teacher?',
            `${holder.name} will no longer be class teacher of ${cls.full_name} and stays on as a subject teacher.`,
            'Remove',
        ))) return;

        setSaving(true);
        setError(null);
        try {
            const done = await sendConfirmingReplace((replace) => api.put(CLASS_TEACHER_URL, {
                grade_stream_id: cls.id,
                user_id: teacher?.id ?? null,
                replace,
            } satisfies SetClassTeacherRequest));
            if (done) onChanged(teacher ? `${teacher.name} is now class teacher of ${cls.full_name}.` : `${cls.full_name} has no class teacher now.`);
        } catch (err) {
            setError(errorMessage(err, 'Could not change the class teacher.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <FormSheet
            visible
            title={`Class teacher of ${cls.full_name}`}
            onClose={onClose}
            onSubmit={() => void save()}
            submitting={saving}
            error={error ?? candidates.error}
        >
            <SelectField
                label="Class teacher"
                value={chosen}
                onChange={(v) => { setPicked(v); setError(null); }}
                options={options}
                loading={candidates.loading}
                clearable
                placeholder="Choose a teacher"
                hint={!candidates.loading && teachers.length === 0 ? 'Add teachers under Users first.' : undefined}
            />
            <Text style={styles.note}>
                A teacher keeps one class a year: picking one who already has a class moves them here and leaves that class without a class teacher.
                {holder ? ` ${holder.name} stays on as a subject teacher.` : ''}
            </Text>
        </FormSheet>
    );
}

const useStyles = makeStyles((colors) => ({
    note: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginTop: spacing.xs },
}));
