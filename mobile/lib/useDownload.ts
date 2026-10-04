import { useCallback } from 'react';
import { useToast } from '@/components/Toast';
import { useApi } from './api';
import { openSavedFile } from './saveFile';

/**
 * Downloads a document (report card, mark sheet, receipt) to the phone and
 * says where it went, with a button to open it. Throws like any API call.
 */
export function useDownload() {
    const api = useApi();
    const toast = useToast();
    return useCallback(async (path: string, fileName: string, mimeType?: string): Promise<void> => {
        const saved = await api.download(path, fileName, mimeType);
        if (saved.folder === 'Files') return; // iPhone: saved from the share sheet
        toast.show(`Saved to ${saved.folder}`, 'success', saved.name, {
            label: 'Open',
            onPress: () => void openSavedFile(saved).catch(() => toast.error('No app on this phone can open this file.')),
        });
    }, [api, toast]);
}
