import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { colors, fonts, radius, spacing } from '@/lib/theme';

/**
 * The web's auth frame (src/components/auth/AuthShell.tsx), shared by sign-in,
 * sign-up and activation: soft gradient backdrop, logo, heading, a white card
 * for the form and footer links. Its colours are the web auth screens' own
 * (indigo/violet call to action, slate text), not the dashboard theme.
 */
const AUTH = {
    backdrop: ['#f8fafc', '#e2e8f0', '#f1f5f9'] as const,
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
};
const CONTROL_HEIGHT = 46;

interface AuthShellProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    /** Links and notes under the card. */
    footer?: React.ReactNode;
}

/** Scrolls the focused field above the keyboard (Android 15 draws edge to edge, so the window no longer resizes). */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
    return (
        <LinearGradient colors={AUTH.backdrop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
            <SafeAreaView style={styles.fill}>
                <KeyboardAwareScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    bottomOffset={spacing.xl}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.column}>
                        <View style={styles.header}>
                            <Image source={require('@/assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
                            <Text style={styles.title} accessibilityRole="header">{title}</Text>
                            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                        </View>
                        <View style={styles.card}>{children}</View>
                        {footer ? <View style={styles.footer}>{footer}</View> : null}
                    </View>
                </KeyboardAwareScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

/** "Skulbase" in the logo's two tones, as the web's Wordmark. */
export function Wordmark() {
    return (
        <Text>
            <Text style={{ color: colors.info }}>Skul</Text>
            <Text style={{ color: colors.success }}>base</Text>
        </Text>
    );
}

interface AuthFieldProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
    label: React.ReactNode;
    /** Shown under the field. */
    hint?: React.ReactNode;
    /** A password field with a show/hide toggle, as the web's PasswordInput. */
    password?: boolean;
    invalid?: boolean;
}

export function AuthField({ label, hint, password, invalid, onFocus, onBlur, ...input }: AuthFieldProps) {
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const Toggle = revealed ? EyeOff : Eye;
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <View
                style={[
                    styles.inputFrame,
                    focused && styles.inputFocused,
                    invalid && { borderColor: AUTH.errorText },
                    input.editable === false && { opacity: 0.6 },
                ]}
            >
                <TextInput
                    {...input}
                    secureTextEntry={password && !revealed}
                    placeholderTextColor={AUTH.faint}
                    onFocus={(e) => { setFocused(true); onFocus?.(e); }}
                    onBlur={(e) => { setFocused(false); onBlur?.(e); }}
                    style={styles.input}
                />
                {password ? (
                    <Pressable
                        onPress={() => setRevealed((r) => !r)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
                        style={styles.reveal}
                    >
                        <Toggle size={18} color={AUTH.faint} />
                    </Pressable>
                ) : null}
            </View>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
    );
}

interface AuthButtonProps {
    label: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    icon?: LucideIcon;
    /** Rendered before the label instead of `icon` (the Google mark). */
    leading?: React.ReactNode;
}

/** The web's gradient call to action. */
export function AuthPrimaryButton({ label, onPress, loading, disabled, icon: Icon }: AuthButtonProps) {
    const inactive = disabled || loading;
    return (
        <Pressable
            onPress={onPress}
            disabled={inactive}
            accessibilityRole="button"
            accessibilityState={{ disabled: inactive, busy: loading }}
            style={({ pressed }) => [styles.primaryShadow, inactive ? { opacity: 0.5 } : pressed && { opacity: 0.9 }]}
        >
            <LinearGradient colors={[AUTH.accent, AUTH.accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
                {loading ? <ActivityIndicator color={colors.white} /> : (
                    <>
                        {Icon ? <Icon size={16} color={colors.white} /> : null}
                        <Text style={styles.primaryText}>{label}</Text>
                    </>
                )}
            </LinearGradient>
        </Pressable>
    );
}

/** The quiet outlined alternative (Google, secondary actions). */
export function AuthSecondaryButton({ label, onPress, loading, disabled, icon: Icon, leading }: AuthButtonProps) {
    const inactive = disabled || loading;
    return (
        <Pressable
            onPress={onPress}
            disabled={inactive}
            accessibilityRole="button"
            accessibilityState={{ disabled: inactive, busy: loading }}
            style={({ pressed }) => [styles.button, styles.secondary, (pressed || inactive) && { opacity: inactive ? 0.5 : 0.8 }]}
        >
            {loading ? <ActivityIndicator color={AUTH.secondaryText} /> : leading ?? (Icon ? <Icon size={16} color={AUTH.secondaryText} /> : null)}
            <Text style={styles.secondaryText}>{label}</Text>
        </Pressable>
    );
}

/** Google's "G", the same paths as the web's GoogleIcon. */
export function GoogleIcon({ size = 20 }: { size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </Svg>
    );
}

/** "Continue with Google" / "Sign up with Google". */
export function GoogleButton({ label = 'Continue with Google', onPress, loading, disabled }: Omit<AuthButtonProps, 'label' | 'icon' | 'leading'> & { label?: string }) {
    return <AuthSecondaryButton label={label} onPress={onPress} loading={loading} disabled={disabled} leading={<GoogleIcon />} />;
}

export function AuthDivider({ label = 'or continue with' }: { label?: string }) {
    return (
        <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{label}</Text>
            <View style={styles.dividerLine} />
        </View>
    );
}

export function AuthError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <View style={styles.error} accessibilityRole="alert">
            <Text style={styles.errorText}>{message}</Text>
        </View>
    );
}

/** An inline link in auth copy or footers. */
export function AuthLink({ label, onPress }: { label: string; onPress: () => void }) {
    return <Text onPress={onPress} accessibilityRole="link" style={styles.link}>{label}</Text>;
}

/** A line of footer text under the card; nest an AuthLink for the action. */
export function AuthFootnote({ children }: { children: React.ReactNode }) {
    return <Text style={styles.footnote}>{children}</Text>;
}

/** Spacing between a card's blocks, the web's `gap-5`. */
export function AuthStack({ children }: { children: React.ReactNode }) {
    return <View style={styles.stack}>{children}</View>;
}

export const authColors = AUTH;

const styles = StyleSheet.create({
    fill: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl + spacing.lg },
    column: { width: '100%', maxWidth: 440, alignSelf: 'center' },
    header: { alignItems: 'center', marginBottom: spacing.xl + spacing.sm },
    logo: {
        width: 64, height: 64, borderRadius: radius.xxl, marginBottom: spacing.lg + 4,
    },
    title: { fontSize: 26, fontFamily: fonts.displayHeavy, color: AUTH.heading, letterSpacing: -0.6, textAlign: 'center', marginBottom: spacing.sm },
    subtitle: { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular, color: AUTH.body, textAlign: 'center' },
    card: {
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: radius.xxl,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        padding: spacing.xl,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 20 },
        elevation: 6,
    },
    footer: { marginTop: spacing.xl, alignItems: 'center', gap: spacing.xs },
    stack: { gap: spacing.lg + 4 },
    field: { gap: spacing.sm },
    label: { fontSize: 12, fontFamily: fonts.semibold, color: AUTH.label },
    inputFrame: {
        flexDirection: 'row',
        alignItems: 'center',
        height: CONTROL_HEIGHT,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: AUTH.inputBorder,
        backgroundColor: colors.white,
    },
    inputFocused: { borderColor: AUTH.accent, borderWidth: 1.5 },
    input: { flex: 1, height: '100%', paddingHorizontal: spacing.lg, fontSize: 16, fontFamily: fonts.regular, color: AUTH.heading },
    reveal: { paddingHorizontal: spacing.md, height: '100%', justifyContent: 'center' },
    hint: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: AUTH.body },
    button: {
        height: CONTROL_HEIGHT,
        borderRadius: radius.xl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    primaryShadow: {
        borderRadius: radius.xl,
        shadowColor: AUTH.accent,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    primaryText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.white },
    secondary: { borderWidth: 1, borderColor: AUTH.hairline, backgroundColor: AUTH.secondaryBg, gap: spacing.md },
    secondaryText: { fontSize: 14, fontFamily: fonts.medium, color: AUTH.secondaryText },
    divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: AUTH.hairline },
    dividerText: { fontSize: 12, fontFamily: fonts.medium, color: AUTH.faint },
    error: { borderRadius: radius.xl, borderWidth: 1, borderColor: AUTH.errorBorder, backgroundColor: AUTH.errorBg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    errorText: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular, color: AUTH.errorText },
    link: { fontFamily: fonts.semibold, color: AUTH.accent },
    footnote: { fontSize: 12, lineHeight: 18, fontFamily: fonts.regular, color: AUTH.faint, textAlign: 'center' },
});
