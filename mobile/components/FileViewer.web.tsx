import React, { createContext, useContext, useMemo } from 'react';
import { Linking } from 'react-native';
import { useToast } from '@/components/Toast';
import { useApi } from '@/lib/api';
import type { ViewableFile } from '@/lib/viewableFile';
import { errorMessage } from '@/lib/format';

interface FileViewerApi {
    view: (file: ViewableFile) => void;
}

const FileViewerContext = createContext<FileViewerApi | null>(null);

export function useFileViewer(): FileViewerApi {
    const ctx = useContext(FileViewerContext);
    if (!ctx) throw new Error('useFileViewer must be used within a FileViewerProvider');
    return ctx;
}

/**
 * The web build has no app web view: the browser shows the file itself, a
 * public link in a new tab and a signed-in file through its download.
 */
export function FileViewerProvider({ children }: { children: React.ReactNode }) {
    const api = useApi();
    const toast = useToast();
    const value = useMemo<FileViewerApi>(() => ({
        view: (file) => {
            const work = file.source.kind === 'url'
                ? Linking.openURL(file.source.url)
                : api.download(file.source.path, file.name, file.type ?? undefined);
            void Promise.resolve(work).catch((err: unknown) => toast.error(errorMessage(err, 'Could not open the file')));
        },
    }), [api, toast]);
    return <FileViewerContext.Provider value={value}>{children}</FileViewerContext.Provider>;
}
