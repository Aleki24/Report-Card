/**
 * The web app's light theme (src/app/globals.css), converted from its oklch
 * tokens to hex so the phone app looks the same.
 */
export const colors = {
    /** --primary */
    primary: '#155dfc',
    primaryDark: '#1447e6',
    /** --primary at 15% over white: icon tiles and selected rows (`bg-primary/15`). */
    primarySoft: '#dce7ff',
    /** --background */
    background: '#f8fafc',
    /** --card */
    card: '#ffffff',
    /** --border */
    border: '#e2e8f0',
    /** --foreground */
    foreground: '#0f172b',
    /** --muted-foreground (darkened on the web for legibility) */
    muted: '#3d4e66',
    /** Placeholder text (the web's `placeholder:text-slate-400`): clearly lighter than typed text. */
    placeholder: '#90a1b9',
    /** --muted / --secondary */
    mutedBg: '#f1f5f9',
    /** --viz-good */
    success: '#16a34a',
    successBg: '#dcfce7',
    /** --destructive */
    danger: '#e7000b',
    dangerBg: '#ffe2e2',
    /** --viz-warn */
    warning: '#d97706',
    warningBg: '#fef3c7',
    /** --viz-info */
    info: '#2563eb',
    infoBg: '#dbeafe',
    /** --sidebar: the web's deep indigo navigation surface. */
    sidebar: '#262a5a',
    white: '#ffffff',
};

/**
 * The web's type pairing: Syne for display headings, Inter for everything
 * else. React Native picks a weight by family name, so each weight is its own
 * family (loaded in app/_layout.tsx) and styles set `fontFamily`, not `fontWeight`.
 */
export const fonts = {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    display: 'Syne_700Bold',
    displayHeavy: 'Syne_800ExtraBold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

/** --radius is 0.625rem (10px); sm/md/lg/xl follow the web's calc() steps, plus rounded-2xl. */
export const radius = { sm: 6, md: 8, lg: 10, xl: 14, xxl: 16 };

/** The web's `shadow-sm`, as close as React Native gets on both platforms. */
export const shadow = {
    shadowColor: '#0f172b',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
} as const;
