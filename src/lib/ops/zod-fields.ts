import { z } from 'zod';

/*
 * Field schemas shared by every operations resource. Forms send '' for a
 * blank optional input, so optional fields turn '' into null before
 * validating; without that, leaving a field empty rejected the whole form.
 */

const blankToNull = (value: unknown) => (value === '' || value === undefined ? null : value);

export const uuid = z.string().uuid('Choose an option');
export const optionalUuid = z.preprocess(blankToNull, z.string().uuid().nullable()).optional();

export const text = (max = 200) => z.string().trim().min(1, 'Required').max(max);
export const optionalText = (max = 2000) => z.preprocess(blankToNull, z.string().trim().max(max).nullable()).optional();

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date');
export const optionalDate = z.preprocess(blankToNull, isoDate.nullable()).optional();

export const isoDateTime = z.string().min(1, 'Required').refine(v => !Number.isNaN(Date.parse(v)), 'Use a valid date and time');
export const optionalDateTime = z.preprocess(blankToNull, isoDateTime.nullable()).optional();

export const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:MM');
export const optionalTime = z.preprocess(blankToNull, time.nullable()).optional();

const toNumber = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value);
export const money = z.preprocess(toNumber, z.number().min(0, 'Cannot be negative').max(1e10));
export const optionalMoney = z.preprocess(v => toNumber(blankToNull(v)), z.number().min(0).max(1e10).nullable()).optional();
export const count = (max = 1_000_000) => z.preprocess(toNumber, z.number().int('Whole number').min(0).max(max));
export const optionalCount = (max = 1_000_000) => z.preprocess(v => toNumber(blankToNull(v)), z.number().int().min(0).max(max).nullable()).optional();
export const decimal = (min: number, max: number) => z.preprocess(toNumber, z.number().min(min).max(max));

export const bool = z.preprocess(v => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

export const oneOf = <const T extends readonly [string, ...string[]]>(values: T) => z.enum(values);

/** Learner and staff ids are Clerk user ids (text), not uuids. */
export const personId = z.string().trim().min(1, 'Choose a person').max(100);
export const optionalPersonId = z.preprocess(blankToNull, z.string().trim().min(1).max(100).nullable()).optional();
