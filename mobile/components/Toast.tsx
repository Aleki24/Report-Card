import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, fonts } from '@/lib/theme';

export type ToastTone = 'success' | 'danger' | 'info' | 'warning';

interface ToastState {
    id: number;
    message: string;
    detail?: string;
    tone: ToastTone;
}

interface ToastApi {
    show: (message: string, tone?: ToastTone, detail?: string) => void;
    success: (message: string) => void;
    error: (message: string, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE: Record<ToastTone, { bg: string; fg: string }> = {
    success: { bg: colors.successBg, fg: colors.success },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    info: { bg: colors.infoBg, fg: colors.info },
    warning: { bg: colors.warningBg, fg: colors.warning },
};

/**
 * The outcome of an action ("Saved.", "No copies available") shown briefly
 * above the tab bar — the phone's equivalent of the web's toasts, so screens
 * ported from the web report outcomes the same way.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastState | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const insets = useSafeAreaInsets();

    const show = useCallback((message: string, tone: ToastTone = 'info', detail?: string) => {
        if (timer.current) clearTimeout(timer.current);
        const id = Date.now();
        setToast({ id, message, detail, tone });
        timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), detail ? 8000 : 3500);
    }, []);

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const api = useMemo<ToastApi>(() => ({
        show,
        success: (m) => show(m, 'success'),
        error: (m, d) => show(m, 'danger', d),
    }), [show]);

    const tone = toast ? TONE[toast.tone] : null;

    return (
        <ToastContext.Provider value={api}>
            {children}
            {toast && tone ? (
                <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
                    <Pressable
                        onPress={() => setToast(null)}
                        accessibilityRole="alert"
                        accessibilityLiveRegion="polite"
                        style={[styles.toast, { backgroundColor: tone.bg, borderColor: tone.fg }]}
                    >
                        <Text style={[styles.message, { color: tone.fg }]}>{toast.message}</Text>
                        {toast.detail ? <Text style={[styles.detail, { color: tone.fg }]}>{toast.detail}</Text> : null}
                    </Pressable>
                </View>
            ) : null}
        </ToastContext.Provider>
    );
}

export function useToast(): ToastApi {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
    toast: { maxWidth: 560, width: '100%', borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
    message: { fontSize: 14, fontFamily: fonts.bold },
    detail: { fontFamily: fonts.regular, fontSize: 12, marginTop: 4 },
});
