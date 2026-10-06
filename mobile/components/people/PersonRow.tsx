import React from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { ChevronRight, MessageCircle, Phone } from 'lucide-react-native';
import { fonts, makeStyles, radius, spacing, useTheme, type Hue } from '@/lib/theme';

const HUES: readonly Hue[] = ['blue', 'violet', 'emerald', 'amber', 'rose', 'teal', 'orange', 'sky'];

/** The same person always gets the same colour. */
function hueFor(seed: string): Hue {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return HUES[h % HUES.length];
}

const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '·';

/** "0712 345 678" → "254712345678" for wa.me links. */
export function whatsappNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('0') ? `254${digits.slice(1)}` : digits;
}

/** A person's photo, or their initials on their own colour. */
export function PersonAvatar({ name, uri, size = 44 }: { name: string; uri?: string | null; size?: number }) {
    const { tones } = useTheme();
    const tone = tones[hueFor(name)];
    const frame = { width: size, height: size, borderRadius: size / 2.6 };
    if (uri) return <Image source={{ uri }} style={frame} accessibilityIgnoresInvertColors />;
    return (
        <View style={[frame, { backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: size * 0.36, fontFamily: fonts.bold, color: tone.fg }}>{initialsOf(name)}</Text>
        </View>
    );
}

/**
 * One learner, member of staff or parent in a list: photo, name, a line of
 * detail and small tags, with call and WhatsApp buttons when there is a phone.
 */
export function PersonRow({ name, detail, tags, uri, phone, badge, onPress, last }: {
    name: string;
    detail?: string | null;
    tags?: readonly (string | null | undefined | false)[];
    uri?: string | null;
    /** Shows call and WhatsApp buttons. */
    phone?: string | null;
    badge?: React.ReactNode;
    onPress?: () => void;
    last?: boolean;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    const shownTags = (tags ?? []).filter((t): t is string => !!t);
    const body = (
        <>
            <PersonAvatar name={name} uri={uri} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    {badge}
                </View>
                {detail ? <Text style={styles.detail} numberOfLines={2}>{detail}</Text> : null}
                {shownTags.length > 0 ? (
                    <View style={styles.tags}>
                        {shownTags.map((t) => <Text key={t} style={styles.tag} numberOfLines={1}>{t}</Text>)}
                    </View>
                ) : null}
            </View>
            {phone ? (
                <View style={styles.contact}>
                    <Pressable onPress={() => void Linking.openURL(`tel:${phone}`)} hitSlop={6} style={[styles.contactBtn, { backgroundColor: colors.primarySoft }]} accessibilityRole="button" accessibilityLabel={`Call ${name}`}>
                        <Phone size={16} color={colors.primary} />
                    </Pressable>
                    <Pressable onPress={() => void Linking.openURL(`https://wa.me/${whatsappNumber(phone)}`)} hitSlop={6} style={[styles.contactBtn, { backgroundColor: colors.successBg }]} accessibilityRole="button" accessibilityLabel={`WhatsApp ${name}`}>
                        <MessageCircle size={16} color={colors.success} />
                    </Pressable>
                </View>
            ) : onPress ? <ChevronRight size={18} color={colors.muted} /> : null}
        </>
    );
    return onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.row, last && styles.last, pressed && { backgroundColor: colors.mutedBg }]} accessibilityRole="button" accessibilityLabel={name}>
            {body}
        </Pressable>
    ) : <View style={[styles.row, last && styles.last]}>{body}</View>;
}

/** A small heading between groups of people, e.g. a class name and its count. */
export function GroupHeading({ title, count }: { title: string; count: number }) {
    const styles = useStyles();
    return (
        <View style={styles.group}>
            <Text style={styles.groupTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.groupCount}>{count}</Text>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    last: { borderBottomWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { flexShrink: 1, fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    detail: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    tag: { fontSize: 11, fontFamily: fonts.semibold, color: colors.muted, backgroundColor: colors.mutedBg, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden', maxWidth: 200 },
    contact: { flexDirection: 'row', gap: 6 },
    contactBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    group: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.elevated, borderBottomWidth: 1, borderBottomColor: colors.border },
    groupTitle: { fontSize: 12, fontFamily: fonts.bold, color: colors.foreground, letterSpacing: 0.3 },
    groupCount: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted },
}));
