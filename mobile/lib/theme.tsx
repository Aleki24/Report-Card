import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';

/**
 * Skulbase's two palettes. Light follows the web app (src/app/globals.css);
 * dark is a deep midnight blue rather than grey, so the brand blue and the
 * module hues still glow against it. Every key exists in both, so a screen
 * only ever names a role ("card", "muted"), never a hex value.
 */
const light = {
    scheme: 'light' as 'light' | 'dark',
    primary: '#155dfc',
    primaryDark: '#1447e6',
    /** Icon tiles and selected rows. */
    primarySoft: '#dce7ff',
    /** Filled buttons and chips: white text must stay legible. */
    primarySolid: '#155dfc',
    /** Text and icons drawn on `primary`. */
    onPrimary: '#ffffff',
    background: '#f6f8fc',
    card: '#ffffff',
    /** A step up from card: inputs, segmented controls, table heads. */
    elevated: '#f1f5f9',
    border: '#e2e8f0',
    foreground: '#0f172b',
    muted: '#45556c',
    placeholder: '#90a1b9',
    mutedBg: '#f1f5f9',
    success: '#16a34a',
    successBg: '#dcfce7',
    successText: '#016630',
    danger: '#e7000b',
    /** Filled danger buttons: white text must stay legible. */
    dangerSolid: '#e7000b',
    dangerBg: '#ffe2e2',
    dangerBorder: '#ffc9c9',
    warning: '#d97706',
    warningBg: '#fef3c7',
    warningText: '#92400e',
    warningBorder: '#fee685',
    info: '#2563eb',
    infoBg: '#dbeafe',
    infoBorder: '#bedbff',
    /** The web's deep indigo navigation surface. */
    sidebar: '#262a5a',
    white: '#ffffff',
    black: '#000000',
    /** Dims the screen behind sheets and dialogs. */
    scrim: 'rgba(15, 23, 43, 0.45)',
    /** The dashboard hero's gradient, top-left to bottom-right. */
    hero: ['#172554', '#1e40af', '#2563eb'] as readonly [string, string, string],
    shadow: '#0f172b',
    /** The sign-in screens' own frame (the web's auth pages). */
    auth: {
        backdrop: ['#f8fafc', '#e2e8f0', '#f1f5f9'] as readonly [string, string, string],
        accent: '#6366f1',
        accentEnd: '#8b5cf6',
        heading: '#0f172b',
        body: '#64748b',
        label: '#45556c',
        faint: '#90a1b9',
        inputBorder: 'rgba(0,0,0,0.10)',
        hairline: 'rgba(0,0,0,0.08)',
        secondaryBg: 'rgba(0,0,0,0.02)',
        secondaryText: '#1d293d',
        errorText: '#e7000b',
        errorBg: 'rgba(251,44,54,0.08)',
        errorBorder: 'rgba(251,44,54,0.2)',
        cardBg: 'rgba(255,255,255,0.92)',
        inputBg: '#ffffff',
    },
};

export type Palette = typeof light;

const dark: Palette = {
    scheme: 'dark',
    primary: '#5b93ff',
    primaryDark: '#3b7bff',
    primarySoft: '#1a2a4d',
    primarySolid: '#2563eb',
    onPrimary: '#ffffff',
    background: '#080d1a',
    card: '#111a2c',
    elevated: '#18233a',
    border: '#22304a',
    foreground: '#edf2fa',
    muted: '#9caac0',
    placeholder: '#5d6c85',
    mutedBg: '#18233a',
    success: '#34d399',
    successBg: '#0d2e22',
    successText: '#6ee7b7',
    danger: '#f87171',
    dangerSolid: '#dc2626',
    dangerBg: '#3a1519',
    dangerBorder: '#5c2228',
    warning: '#fbbf24',
    warningBg: '#33260b',
    warningText: '#fcd34d',
    warningBorder: '#5c4610',
    info: '#60a5fa',
    infoBg: '#12264a',
    infoBorder: '#1f3c6e',
    sidebar: '#0b1226',
    white: '#ffffff',
    black: '#000000',
    scrim: 'rgba(0, 0, 0, 0.6)',
    hero: ['#0b1530', '#132a63', '#1e3a8a'],
    shadow: '#000000',
    auth: {
        backdrop: ['#060a14', '#0d1530', '#0a1122'],
        accent: '#818cf8',
        accentEnd: '#a78bfa',
        heading: '#eef2fa',
        body: '#9caac0',
        label: '#b6c2d6',
        faint: '#5d6c85',
        inputBorder: 'rgba(255,255,255,0.12)',
        hairline: 'rgba(255,255,255,0.10)',
        secondaryBg: 'rgba(255,255,255,0.04)',
        secondaryText: '#e2e8f0',
        errorText: '#f87171',
        errorBg: 'rgba(248,113,113,0.10)',
        errorBorder: 'rgba(248,113,113,0.25)',
        cardBg: 'rgba(17,26,44,0.92)',
        inputBg: '#0c1424',
    },
};

export const palettes = { light, dark } as const;
export type SchemeName = keyof typeof palettes;

/**
 * One hue per kind of thing (the web's components/ui/tones.ts): a module's
 * tiles, figures and charts share it on every screen.
 */
export type Hue = 'sky' | 'blue' | 'violet' | 'emerald' | 'teal' | 'amber' | 'orange' | 'rose' | 'slate';

export interface Tone {
    /** Icon and figure colour. */
    fg: string;
    /** Soft tile behind the icon. */
    bg: string;
    /** Solid marker or bar. */
    solid: string;
    /** Two stops for a gradient tile. */
    gradient: readonly [string, string];
}

/** Tailwind's 500 (solid), 600 / 400 (text in light / dark), 500 at 12% / 18% (tile). */
const HUE_SWATCHES: Record<Hue, { s500: string; s600: string; s400: string; to: string }> = {
    sky: { s500: '#0ea5e9', s600: '#0284c7', s400: '#38bdf8', to: '#3b82f6' },
    blue: { s500: '#3b82f6', s600: '#2563eb', s400: '#60a5fa', to: '#8b5cf6' },
    violet: { s500: '#8b5cf6', s600: '#7c3aed', s400: '#a78bfa', to: '#d946ef' },
    emerald: { s500: '#10b981', s600: '#059669', s400: '#34d399', to: '#2dd4bf' },
    teal: { s500: '#14b8a6', s600: '#0d9488', s400: '#2dd4bf', to: '#06b6d4' },
    amber: { s500: '#f59e0b', s600: '#d97706', s400: '#fbbf24', to: '#fb923c' },
    orange: { s500: '#f97316', s600: '#ea580c', s400: '#fb923c', to: '#fb7185' },
    rose: { s500: '#f43f5e', s600: '#e11d48', s400: '#fb7185', to: '#ec4899' },
    slate: { s500: '#64748b', s600: '#475569', s400: '#cbd5e1', to: '#94a3b8' },
};

function buildTones(scheme: SchemeName): Record<Hue, Tone> {
    const entries = (Object.keys(HUE_SWATCHES) as Hue[]).map((hue): [Hue, Tone] => {
        const s = HUE_SWATCHES[hue];
        return [hue, {
            fg: scheme === 'dark' ? s.s400 : s.s600,
            bg: `${s.s500}${scheme === 'dark' ? '2e' : '1f'}`,
            solid: s.s500,
            gradient: [s.s500, s.to],
        }];
    });
    return Object.fromEntries(entries) as Record<Hue, Tone>;
}

export const tonesFor: Record<SchemeName, Record<Hue, Tone>> = { light: buildTones('light'), dark: buildTones('dark') };

/** Every weight of one family, Plus Jakarta Sans; React Native picks a weight by family name. */
export const fonts = {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    display: 'PlusJakartaSans_800ExtraBold',
    displayHeavy: 'PlusJakartaSans_800ExtraBold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 6, md: 8, lg: 10, xl: 14, xxl: 18, xxxl: 24 };

/** A soft lift for cards; dark mode leans on borders instead, so its shadow is nearly gone. */
export function shadowFor(colors: Palette) {
    return {
        shadowColor: colors.shadow,
        shadowOpacity: colors.scheme === 'dark' ? 0.3 : 0.07,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: colors.scheme === 'dark' ? 0 : 2,
    } as const;
}

type NamedStyles<T> = { [P in keyof T]: StyleSheet.NamedStyles<T>[P] };

/**
 * Styles that follow the theme: `const useStyles = makeStyles((colors) => ({ … }))`
 * at module level, `const styles = useStyles()` in the component. Each palette's
 * sheet is built once and reused.
 */
export function makeStyles<T extends NamedStyles<T>>(factory: (colors: Palette) => T): () => T {
    const cache = new Map<Palette, T>();
    return function useStyles(): T {
        const { colors } = useTheme();
        let sheet = cache.get(colors);
        if (!sheet) {
            sheet = StyleSheet.create(factory(colors));
            cache.set(colors, sheet);
        }
        return sheet;
    };
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface ThemeValue {
    colors: Palette;
    tones: Record<Hue, Tone>;
    scheme: SchemeName;
    preference: ThemePreference;
    setPreference: (preference: ThemePreference) => void;
}

const PREFERENCE_KEY = 'skulbase.theme';

function readPreference(): ThemePreference {
    try {
        const stored = SecureStore.getItem(PREFERENCE_KEY);
        return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
        // Not available (web preview): follow the system.
        return 'system';
    }
}

const ThemeContext = createContext<ThemeValue>({
    colors: light,
    tones: tonesFor.light,
    scheme: 'light',
    preference: 'system',
    setPreference: () => undefined,
});

/**
 * Light, dark, or whatever the phone uses. The choice is read synchronously
 * at start so the first frame is already in the right theme, and switching
 * repaints every screen in place: no restart, nothing lost.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const system = useColorScheme();
    const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
    const scheme: SchemeName = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

    const setPreference = useCallback((next: ThemePreference) => {
        setPreferenceState(next);
        SecureStore.setItemAsync(PREFERENCE_KEY, next).catch(() => undefined);
    }, []);

    // The window behind the app shows during transitions and the keyboard's slide.
    useEffect(() => {
        SystemUI.setBackgroundColorAsync(palettes[scheme].background).catch(() => undefined);
    }, [scheme]);

    const value = useMemo<ThemeValue>(
        () => ({ colors: palettes[scheme], tones: tonesFor[scheme], scheme, preference, setPreference }),
        [scheme, preference, setPreference],
    );
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
    return useContext(ThemeContext);
}
