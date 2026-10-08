import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
import { X } from 'lucide-react-native';
import { Button } from '@/components/ui';
import { ToastViewport, useToast } from '@/components/Toast';
import { useApi } from '@/lib/api';
import type { ViewableFile } from '@/lib/viewableFile';
import { VIEWER_BASE_URL, VIEWER_ERROR, VIEWER_READY, previewKind, viewerHtml } from '@/lib/fileViewerHtml';
import { errorMessage } from '@/lib/format';
import { openFileExternally } from '@/lib/openAttachment';
import { saveToDevice } from '@/lib/saveFile';
import { fonts, makeStyles, spacing, useTheme } from '@/lib/theme';

interface FileViewerApi {
    /** Shows the file inside the app, with Save and Open in another app. */
    view: (file: ViewableFile) => void;
}

const FileViewerContext = createContext<FileViewerApi | null>(null);

/** Opens files in the in-app viewer (see FileViewerProvider). */
export function useFileViewer(): FileViewerApi {
    const ctx = useContext(FileViewerContext);
    if (!ctx) throw new Error('useFileViewer must be used within a FileViewerProvider');
    return ctx;
}

/**
 * Lets any screen show a homework file or exam paper inside the app, before
 * (or instead of) saving it: opening one used to download it first, asking
 * for a folder, or hand it to another app.
 */
export function FileViewerProvider({ children }: { children: React.ReactNode }) {
    const [file, setFile] = useState<ViewableFile | null>(null);
    const api = useMemo<FileViewerApi>(() => ({ view: setFile }), []);
    return (
        <FileViewerContext.Provider value={api}>
            {children}
            {file ? <ViewerSheet key={`${file.name}:${JSON.stringify(file.source)}`} file={file} onClose={() => setFile(null)} /> : null}
        </FileViewerContext.Provider>
    );
}

type ViewerState =
    | { phase: 'loading' }
    | { phase: 'showing'; html: string; rendered: boolean }
    | { phase: 'unsupported' }
    | { phase: 'failed'; message: string };

/** "Fractions worksheet (2).pdf" → a cache file name that is safe on every phone. */
const cacheName = (name: string) => `view-${Date.now()}-${name.replace(/[^\w.() -]+/g, '_')}`;

function ViewerSheet({ file, onClose }: { file: ViewableFile; onClose: () => void }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const [state, setState] = useState<ViewerState>({ phase: 'loading' });
    const [local, setLocal] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const kind = previewKind(file.type);
    const mimeType = file.type ?? 'application/octet-stream';

    useEffect(() => {
        let cancelled = false;
        let fetched: File | null = null;
        void (async () => {
            try {
                fetched = await api.fetchFile(file.source, cacheName(file.name));
                if (cancelled) return;
                setLocal(fetched);
                if (!kind || !file.type) return setState({ phase: 'unsupported' });
                const base64 = await fetched.base64();
                if (!cancelled) setState({ phase: 'showing', html: viewerHtml(kind, base64, file.type), rendered: false });
            } catch (err) {
                if (!cancelled) setState({ phase: 'failed', message: errorMessage(err, 'The file could not be opened.') });
            }
        })();
        // The copy only lives while the viewer is open.
        return () => {
            cancelled = true;
            try { if (fetched?.exists) fetched.delete(); } catch { /* already gone */ }
        };
    }, [api, file, kind]);

    const onMessage = useCallback((e: WebViewMessageEvent) => {
        const message = e.nativeEvent.data;
        if (message === VIEWER_READY) setState((s) => (s.phase === 'showing' ? { ...s, rendered: true } : s));
        else if (message.startsWith(VIEWER_ERROR)) setState({ phase: 'unsupported' });
    }, []);

    const openElsewhere = async () => {
        if (!local) return;
        setBusy(true);
        try { await openFileExternally(local, mimeType, file.name); }
        catch (err) { toast.error(errorMessage(err, 'No app on this phone can open this file.')); }
        finally { setBusy(false); }
    };

    const save = async () => {
        if (!local) return;
        setBusy(true);
        try {
            // Saving hands its file over (and deletes it), so it gets a copy.
            const copy = new File(Paths.cache, cacheName(file.name));
            await local.copy(copy);
            const saved = await saveToDevice(copy, file.name, mimeType);
            if (saved.folder !== 'Files') toast.show(`Saved to ${saved.folder}`, 'success', saved.name);
        } catch (err) {
            toast.error(errorMessage(err, 'Could not save the file.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <Text style={styles.title} numberOfLines={2}>{file.name}</Text>
                    <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.close}>
                        <X size={20} color={colors.foreground} />
                    </Pressable>
                </View>
                <View style={styles.body}>
                    {state.phase === 'showing' ? (
                        <WebView
                            originWhitelist={['*']}
                            source={{ html: state.html, baseUrl: VIEWER_BASE_URL }}
                            onMessage={onMessage}
                            javaScriptEnabled
                            setSupportMultipleWindows={false}
                            setBuiltInZoomControls
                            setDisplayZoomControls={false}
                            style={styles.web}
                        />
                    ) : null}
                    {state.phase === 'loading' || (state.phase === 'showing' && !state.rendered) ? (
                        <View style={styles.overlay} pointerEvents="none">
                            <ActivityIndicator color={colors.primary} />
                            <Text style={styles.message}>Opening…</Text>
                        </View>
                    ) : null}
                    {state.phase === 'unsupported' || state.phase === 'failed' ? (
                        <View style={styles.overlay}>
                            <Text style={styles.message}>
                                {state.phase === 'failed'
                                    ? state.message
                                    : 'This file can’t be shown in the app. Open it in another app, or save it to your phone.'}
                            </Text>
                        </View>
                    ) : null}
                </View>
                <View style={styles.footer}>
                    <Button variant="secondary" label="Open in another app" onPress={() => void openElsewhere()} disabled={!local || busy} />
                    <Button label="Save to phone" onPress={() => void save()} disabled={!local || busy} loading={busy} />
                </View>
            </SafeAreaView>
            {/* The screen's toasts sit behind this sheet; show them here too. */}
            <ToastViewport />
        </Modal>
    );
}

const useStyles = makeStyles((colors) => ({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    title: { flex: 1, fontSize: 16, fontFamily: fonts.bold, color: colors.foreground },
    close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.mutedBg },
    body: { flex: 1, backgroundColor: '#e5e7eb' },
    web: { flex: 1, backgroundColor: '#e5e7eb' },
    overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
    message: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular, color: '#374151', textAlign: 'center' },
    footer: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
}));
