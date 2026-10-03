import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { colors, spacing, fonts } from '@/lib/theme';

/**
 * A full-height sheet for a form: title, scrolling body, and a pinned
 * Cancel / Save bar — the phone's version of the web's side drawer.
 */
export function FormSheet({
    visible,
    title,
    onClose,
    onSubmit,
    submitLabel = 'Save',
    submitting,
    children,
}: {
    visible: boolean;
    title: string;
    onClose: () => void;
    /** Leave out for a read-only sheet (only Close is shown). */
    onSubmit?: () => void;
    submitLabel?: string;
    submitting?: boolean;
    children: React.ReactNode;
}) {
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
                {/* Lifts the save bar above the keyboard on both platforms (Android 15 no longer resizes the window). */}
                <KeyboardAvoidingView style={styles.flex} behavior="padding">
                    <View style={styles.header}>
                        <Text style={styles.title} numberOfLines={2}>{title}</Text>
                    </View>
                    <KeyboardAwareScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bottomOffset={spacing.lg}>
                        <View style={styles.content}>{children}</View>
                    </KeyboardAwareScrollView>
                    <View style={styles.footer}>
                        <Button label={onSubmit ? 'Cancel' : 'Close'} variant="secondary" onPress={onClose} disabled={submitting} />
                        {onSubmit ? <Button label={submitting ? 'Saving…' : submitLabel} onPress={onSubmit} loading={submitting} /> : null}
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    title: { fontSize: 18, fontFamily: fonts.display, color: colors.foreground, maxWidth: 760, width: '100%', alignSelf: 'center' },
    body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    content: { width: '100%', maxWidth: 760, alignSelf: 'center' },
    footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
});
