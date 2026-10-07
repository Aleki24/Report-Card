import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, fonts, useTheme } from '@/lib/theme';
import { badgeColors } from './ui';

export type ToastTone = 'success' | 'danger' | 'info' | 'warning';

interface ToastState {
    id: number;
    message: string;
    detail?: string;
    tone: ToastTone;
    action?: ToastAction;
}

/** A button on the toast, e.g. "Open" after a download. */
export interface ToastAction { label: string; onPress: () => void }

interface ToastApi {
    show: (message: string, tone?: ToastTone, detail?: string, action?: ToastAction) => void;
    success: (message: string) => void;
    error: (message: string, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
/** The toast on show, read by every viewport (the screen's, and an open sheet's). */
const ToastStateContext = createContext<{ toast: ToastState | null; dismiss: () => void }>({ toast: null, dismiss: () => undefined });


/**
 * The outcome of an action ("Saved.", "No copies available") shown briefly
 * above the tab bar — the phone's equivalent of the web's toasts, so screens
 * ported from the web report outcomes the same way.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastState | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback((message: string, tone: ToastTone = 'info', detail?: string, action?: ToastAction) => {
        if (timer.current) clearTimeout(timer.current);
        const id = Date.now();
        setToast({ id, message, detail, tone, action });
        timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), detail || action ? 8000 : 3500);
    }, []);

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const api = useMemo<ToastApi>(() => ({
        show,
        success: (m) => show(m, 'success'),
        error: (m, d) => show(m, 'danger', d),
    }), [show]);

    const dismiss = useCallback(() => setToast(null), []);
    const state = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

    return (
        <ToastContext.Provider value={api}>
            <ToastStateContext.Provider value={state}>
                {children}
                <ToastViewport />
            </ToastStateContext.Provider>
        </ToastContext.Provider>
    );
}

/**
 * Where the toast shows. The screen has one; a sheet (a React Native Modal)
 * draws over it, so FormSheet renders its own as well — otherwise every
 * error raised while a form is open ("Upload failed", "Choose the subject")
 * was hidden behind the form and the person saw nothing happen.
 */
export function ToastViewport() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { toast, dismiss } = useContext(ToastStateContext);
    if (!toast) return null;
    const tone = badgeColors(colors, toast.tone);
    return (
        <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
            <Pressable
                onPress={dismiss}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[styles.toast, { backgroundColor: tone.bg, borderColor: tone.fg }]}
            >
                <Text style={[styles.message, { color: tone.fg }]}>{toast.message}</Text>
                {toast.detail ? <Text style={[styles.detail, { color: tone.fg }]}>{toast.detail}</Text> : null}
                {toast.action ? (
                    <Pressable
                        onPress={() => { const run = toast.action?.onPress; dismiss(); run?.(); }}
                        accessibilityRole="button"
                        style={[styles.action, { borderColor: tone.fg }]}
                    >
                        <Text style={[styles.actionText, { color: tone.fg }]}>{toast.action.label}</Text>
                    </Pressable>
                ) : null}
            </Pressable>
        </View>
    );
}

export function useToast(): ToastApi {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
}

const styles = StyleSheet.create({
    action: { alignSelf: 'flex-start', marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 6 },
    actionText: { fontFamily: fonts.bold, fontSize: 13 },
    wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
    toast: { maxWidth: 560, width: '100%', borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
    message: { fontSize: 14, fontFamily: fonts.bold },
    detail: { fontFamily: fonts.regular, fontSize: 12, marginTop: 4 },
});
