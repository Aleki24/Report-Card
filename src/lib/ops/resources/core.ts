import { z } from 'zod';
import { defineResource } from '../resource';
import { optionalDate, optionalUuid, personId, oneOf } from '../zod-fields';
import { DUTY_KEYS, SCOPE_TYPES, type DutyKey } from '@/lib/platform/permissions';

export const userDuties = defineResource({
    table: 'user_duties',
    module: null,
    label: { singular: 'Duty', plural: 'Duties' },
    read: ['duties.manage'],
    write: ['duties.manage'],
    schema: z.object({
        user_id: personId,
        duty: oneOf(DUTY_KEYS as [DutyKey, ...DutyKey[]]),
        scope_type: z.preprocess(v => (v === '' ? null : v), z.enum(SCOPE_TYPES).nullable()).optional(),
        scope_id: optionalUuid,
        starts_on: optionalDate,
        ends_on: optionalDate,
    }),
    select: '*, user:users!user_duties_user_id_fkey(first_name, last_name, role)',
    order: { column: 'created_at', ascending: false },
    filters: ['user_id', 'duty'],
    userRefs: ['user_id'],
    createdByColumn: 'created_by',
    audit: true,
});
