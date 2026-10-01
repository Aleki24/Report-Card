/**
 * Small values kept on the device across restarts (a driver's GPS fixes
 * waiting to upload). A JSON file per key in the app's documents folder on
 * phones; localStorage in the web build. Synchronous, like the web's
 * localStorage, and never throws: a full or blocked store keeps the value in
 * memory only.
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const fileFor = (key: string) => new File(Paths.document, `${key.replace(/[^a-zA-Z0-9-]+/g, '_')}.json`);

export function readJson<T>(key: string, fallback: T): T {
    try {
        if (Platform.OS === 'web') {
            const raw = window.localStorage.getItem(key);
            return raw === null ? fallback : (JSON.parse(raw) as T);
        }
        const file = fileFor(key);
        return file.exists ? (JSON.parse(file.textSync()) as T) : fallback;
    } catch {
        return fallback;
    }
}

export function writeJson(key: string, value: unknown): void {
    try {
        const text = JSON.stringify(value);
        if (Platform.OS === 'web') {
            window.localStorage.setItem(key, text);
            return;
        }
        const file = fileFor(key);
        if (!file.exists) file.create({ intermediates: true });
        file.write(text);
    } catch {
        /* storage full or unavailable */
    }
}

export function removeKey(key: string): void {
    try {
        if (Platform.OS === 'web') window.localStorage.removeItem(key);
        else {
            const file = fileFor(key);
            if (file.exists) file.delete();
        }
    } catch {
        /* nothing to remove */
    }
}
