import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';
import { attachmentName, attachmentTypeOf, isImageType } from '@shared/attachments';

/** FLAG_GRANT_READ_URI_PERMISSION: the viewer app may read the file we hand it. */
const GRANT_READ = 1;

export class AttachmentOpenError extends Error {}

/**
 * Opens a homework attachment (a worksheet, or a learner's hand-in) to read.
 *
 * Handing the link to the browser did not work for documents on Android:
 * Chrome downloads a PDF or Word file instead of showing it, and the reader
 * was left hunting for it in a notification. Android now downloads it into
 * the app and opens it in a viewer (a PDF reader, Word, Docs). An iPhone's
 * in-app browser shows PDFs, Office files and photos itself, and photos
 * show in the in-app browser on Android too.
 */
export async function openAttachment(url: string): Promise<void> {
    const type = attachmentTypeOf(url);
    if (Platform.OS === 'web') {
        await Linking.openURL(url);
        return;
    }
    if (Platform.OS !== 'android' || !type || isImageType(type)) {
        await WebBrowser.openBrowserAsync(url);
        return;
    }

    const target = new File(Paths.cache, attachmentName(url).replace(/[^\w.() -]+/g, '_'));
    if (target.exists) target.delete();
    let file: File;
    try {
        file = await File.downloadFileAsync(url, target);
    } catch {
        throw new AttachmentOpenError('The file could not be downloaded. Check your connection and try again.');
    }
    try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: file.contentUri, type, flags: GRANT_READ });
    } catch {
        // No viewer for this type on the phone: let the person pick any app that takes it.
        if (!(await Sharing.isAvailableAsync())) throw new AttachmentOpenError('No app on this phone can open this file.');
        await Sharing.shareAsync(file.uri, { mimeType: type, dialogTitle: attachmentName(url) });
    }
}
