import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '@clerk/clerk-expo';
import { Camera } from 'lucide-react-native';
import { Avatar } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useCurrentUser } from '@/lib/UserContext';
import { errorMessage, fullName, initials } from '@/lib/format';
import { fonts, makeStyles, spacing, useTheme } from '@/lib/theme';

/**
 * The signed-in person's photo with a camera button: choose a picture,
 * crop it square, and it becomes their account picture everywhere they sign
 * in (the app's home, the web's menu).
 */
export function ProfilePhoto({ subtitle }: { subtitle?: string | null }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const toast = useToast();
    const { user } = useUser();
    const { profile, avatarUrl, reload } = useCurrentUser();
    const [busy, setBusy] = useState(false);

    const change = async () => {
        if (!user || busy) return;
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { toast.error('Allow photo access to choose a picture.'); return; }
        const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
        const asset = picked.canceled ? null : picked.assets[0];
        if (!asset?.base64) return;
        setBusy(true);
        try {
            await user.setProfileImage({ file: `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` });
            await user.reload();
            reload();
            toast.success('Profile photo updated.');
        } catch (err) {
            toast.error(errorMessage(err, 'Could not update your photo'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={styles.row}>
            <Pressable onPress={() => void change()} accessibilityRole="button" accessibilityLabel="Change profile photo" style={styles.photo}>
                <Avatar label={initials(profile)} size={76} uri={avatarUrl} />
                <View style={[styles.camera, { backgroundColor: colors.primarySolid, borderColor: colors.background }]}>
                    {busy ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Camera size={14} color={colors.onPrimary} />}
                </View>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={2}>{fullName(profile)}</Text>
                <Text style={styles.sub} numberOfLines={1}>{subtitle ?? profile?.email ?? '—'}</Text>
                <Text onPress={() => void change()} style={styles.link}>{avatarUrl ? 'Change photo' : 'Add a photo'}</Text>
            </View>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg },
    photo: { position: 'relative' },
    camera: { position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 18, fontFamily: fonts.display, color: colors.foreground },
    sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
    link: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, marginTop: 6, alignSelf: 'flex-start' },
}));
