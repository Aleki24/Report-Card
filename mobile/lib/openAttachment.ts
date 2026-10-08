import type { File } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** FLAG_GRANT_READ_URI_PERMISSION: the viewer app may read the file we hand it. */
const GRANT_READ = 1;

export class AttachmentOpenError extends Error {}

/**
 * Hands a downloaded file to another app: Android's viewer for its type (a
 * PDF reader, Word, Docs), or the share sheet when there is none (and on
 * iPhone), where the person picks any app that takes it. Files are shown in
 * the app first (components/FileViewer); this is its "Open in another app".
 */
export async function openFileExternally(file: File, type: string, title: string): Promise<void> {
    if (Platform.OS === 'android') {
        try {
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: file.contentUri, type, flags: GRANT_READ });
            return;
        } catch {
            // No viewer for this type: fall through to the share sheet.
        }
    }
    if (!(await Sharing.isAvailableAsync())) throw new AttachmentOpenError('No app on this phone can open this file.');
    await Sharing.shareAsync(file.uri, { mimeType: type, dialogTitle: title });
}
