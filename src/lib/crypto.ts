import crypto from 'crypto';

/**
 * Encrypts payment-gateway credentials (M-Pesa/Pesapal consumer secrets,
 * Daraja passkey) before they're stored in school_payment_settings. The key
 * lives only in the server's environment, never in the database — so
 * reading the row (via the Supabase dashboard, a DB backup, or a leaked
 * service-role key) doesn't hand over usable credentials on its own.
 */

const ALGORITHM = 'aes-256-gcm';
const FORMAT_VERSION = 'v1';

function getKey(): Buffer {
    const raw = process.env.PAYMENT_SECRETS_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error('PAYMENT_SECRETS_ENCRYPTION_KEY is not set — generate one with `openssl rand -hex 32` and set it in the environment.');
    }
    const key = Buffer.from(raw, 'hex');
    if (key.length !== 32) {
        throw new Error('PAYMENT_SECRETS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
    }
    return key;
}

export function encryptSecret(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [FORMAT_VERSION, iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(stored: string): string {
    const [version, ivB64, authTagB64, ciphertextB64] = stored.split(':');
    if (version !== FORMAT_VERSION || !ivB64 || !authTagB64 || !ciphertextB64) {
        throw new Error('Unrecognized encrypted secret format.');
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
}
