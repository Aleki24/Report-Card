/**
 * What a status means, for colouring it: pages map their statuses to tones
 * once, so every list reads the same colour for "waiting", "done" and
 * "problem" on the web and in the mobile app.
 */
export type PillTone = 'neutral' | 'info' | 'good' | 'warn' | 'bad' | 'violet';
