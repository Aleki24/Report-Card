/**
 * Reading a picked file's contents: from the device on phones, from the
 * browser's File in the web build. Shaped for `parseTabularData`.
 */
import { File } from 'expo-file-system';
import type { PickedFile } from './api';

export function readPicked(picked: PickedFile): { bytes: () => Promise<ArrayBuffer>; text: () => Promise<string> } {
    if (picked.blob) {
        const blob = picked.blob;
        return { bytes: () => blob.arrayBuffer(), text: () => blob.text() };
    }
    const file = new File(picked.uri);
    return { bytes: () => file.arrayBuffer(), text: () => file.text() };
}

/** Spreadsheet and CSV types a roster or mark list may come as. */
export const TABULAR_TYPES = [
    'text/csv',
    'text/comma-separated-values',
    'text/tab-separated-values',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
] as const;
