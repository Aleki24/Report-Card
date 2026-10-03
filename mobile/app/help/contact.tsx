import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { CircleCheck, Mail, Phone } from 'lucide-react-native';
import { CONTACT_DETAILS, contactSchema, type ContactField, type ContactInput } from '@shared/contact';
import { publicPost } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useOptionalCurrentUser } from '@/lib/UserContext';
import { colors, fonts, spacing } from '@/lib/theme';
import { BackLink, Button, Card, ErrorBanner, IconTile, ListCard, ListRow, Screen, ScreenHeader, TextField } from '@/components/ui';

type Errors = Partial<Record<ContactField, string>>;

/** "Contact us" from the web, checked with the same schema the server uses (/api/contact). */
export default function ContactScreen() {
    const user = useOptionalCurrentUser();
    const profile = user?.profile;
    const [values, setValues] = useState<Required<ContactInput>>({
        name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : '',
        email: profile?.email ?? '',
        schoolName: user?.schoolName ?? '',
        message: '',
    });
    const [errors, setErrors] = useState<Errors>({});
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const set = (field: ContactField) => (text: string) => {
        setValues((v) => ({ ...v, [field]: text }));
        setErrors((e) => ({ ...e, [field]: undefined }));
    };

    const send = async () => {
        const parsed = contactSchema.safeParse(values);
        if (!parsed.success) {
            const next: Errors = {};
            for (const issue of parsed.error.issues) {
                const field = issue.path[0] as ContactField;
                next[field] ??= issue.message;
            }
            setErrors(next);
            return;
        }
        setError(null);
        setSending(true);
        try {
            await publicPost('/api/contact', parsed.data);
            setSent(true);
        } catch (err) {
            setError(errorMessage(err, 'Could not send your message. Please try again.'));
        } finally {
            setSending(false);
        }
    };

    return (
        <Screen>
            <BackLink />
            <ScreenHeader title="Contact support" description="Tell us what you need and we’ll reply by email, usually within a working day." />
            {sent ? (
                <Card style={styles.sent}>
                    <CircleCheck size={32} color={colors.success} />
                    <Text style={styles.sentTitle}>Message sent</Text>
                    <Text style={styles.sentBody}>Thanks, {values.name.split(' ')[0] || 'there'}. We’ll reply to {values.email}.</Text>
                </Card>
            ) : (
                <Card>
                    {error ? <ErrorBanner message={error} /> : null}
                    <TextField label="Full name" value={values.name} onChangeText={set('name')} placeholder="John Kamau" autoCapitalize="words" error={errors.name} />
                    <TextField label="Email address" value={values.email} onChangeText={set('email')} placeholder="john@school.ac.ke" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
                    <TextField label="School (optional)" value={values.schoolName} onChangeText={set('schoolName')} placeholder="Nairobi Academy" autoCapitalize="words" error={errors.schoolName} />
                    <TextField label="Message" value={values.message} onChangeText={set('message')} placeholder="Tell us about your school and what you need." multiline error={errors.message} />
                    <View style={{ marginTop: spacing.sm }}>
                        <Button label="Send message" onPress={() => void send()} loading={sending} block />
                    </View>
                </Card>
            )}
            <View style={{ height: spacing.lg }} />
            <ListCard>
                <ListRow title={CONTACT_DETAILS.phoneDisplay} subtitle="Call or WhatsApp" left={<IconTile icon={Phone} />} onPress={() => void Linking.openURL(CONTACT_DETAILS.phoneHref)} />
                <ListRow title={CONTACT_DETAILS.email} subtitle="Email us" left={<IconTile icon={Mail} />} onPress={() => void Linking.openURL(`mailto:${CONTACT_DETAILS.email}`)} />
            </ListCard>
        </Screen>
    );
}

const styles = StyleSheet.create({
    sent: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    sentTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.foreground },
    sentBody: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
});
