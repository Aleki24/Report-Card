import { Directory, File } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** A downloaded document, where it was saved and how to open it again. */
export interface SavedFile {
    uri: string;
    name: string;
    mimeType: string;
    /** The folder's name as the phone shows it, e.g. "Download". */
    folder: string;
}

const FOLDER_KEY = 'skulbase.download-folder';

/** "content://…/tree/primary%3ADownload%2FSkulbase" → "Download/Skulbase". */
function folderLabel(uri: string): string {
    const tree = decodeURIComponent(uri.split('/tree/')[1] ?? '');
    return tree.split(':').pop() || 'your folder';
}

/** The folder the person chose once; asked again only if access was lost. */
async function downloadFolder(forceAsk: boolean): Promise<Directory> {
    const saved = forceAsk ? null : await SecureStore.getItemAsync(FOLDER_KEY).catch(() => null);
    if (saved) return new Directory(saved);
    const picked = await Directory.pickDirectoryAsync();
    await SecureStore.setItemAsync(FOLDER_KEY, picked.uri).catch(() => undefined);
    return picked;
}

/**
 * Saves a downloaded document where the person keeps files. On Android the
 * first download asks which folder (Downloads, say) and remembers it; on
 * iPhone the share sheet's "Save to Files" is the way to save.
 */
export async function saveToDevice(file: File, name: string, mimeType: string): Promise<SavedFile> {
    if (Platform.OS !== 'android') {
        await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined });
        return { uri: file.uri, name, mimeType, folder: 'Files' };
    }
    const bytes = await file.bytes();
    const write = (dir: Directory) => {
        const out = dir.createFile(name.replace(/\.[^.]+$/, ''), mimeType);
        out.write(bytes);
        return { uri: out.uri, name, mimeType, folder: folderLabel(dir.uri) };
    };
    try {
        return write(await downloadFolder(false));
    } catch {
        // The remembered folder was removed or its permission revoked: ask again.
        return write(await downloadFolder(true));
    } finally {
        file.delete();
    }
}

/** Opens a saved document in the phone's viewer (a PDF reader for report cards). */
export async function openSavedFile(saved: SavedFile): Promise<void> {
    if (Platform.OS !== 'android') return;
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: saved.uri,
        type: saved.mimeType,
        // FLAG_GRANT_READ_URI_PERMISSION: the viewer may read our file.
        flags: 1,
    });
}
